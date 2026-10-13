#!/usr/bin/env python3
"""Gera a politica de scripts (CSP) e o Trusted Types de cada pagina.

Cada pagina leva, logo apos o viewport, um <meta> Content-Security-Policy
com o hash de todos os seus blocos <script> e 'strict-dynamic': so roda
script escrito no proprio HTML, e o que ele inserir (Google, Meta, OpenAI e
os arquivos de assets/js, carregados por um bloco no fim do body). Um script
injetado por terceiros, sem hash, e bloqueado. 'https:' e 'unsafe-inline'
so valem em navegadores antigos, que ignoram hashes e strict-dynamic.

Junto vai a politica padrao de Trusted Types: HTML e scripts passam como
antes, mas endereco de script so carrega de https:, da propria origem ou
blob:. Bloqueia javascript: e data: em src de script.

Recusa (sai com erro) o que essa politica bloquearia sem aviso:
<script src> escrito no HTML, atributos on*= e links javascript:.

Roda no .githooks/pre-commit (depois de versionar_assets) e no workflow
verificar-assets. Uso manual:

    python tools/seguranca/csp.py              # atualiza
    python tools/seguranca/csp.py --verificar  # so confere
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
FORA = {"tools", "_materiais", "Fotos", "node_modules", ".git", ".github", ".githooks"}
# Pagina interna de conferencia (iframes da home em varias larguras), sem script.
EXCLUIDAS = {"preview.html"}

POLITICA_TT = """  <script>
    // Trusted Types: politica padrao do site (tools/seguranca/csp.py).
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
      window.trustedTypes.createPolicy('default', {
        createHTML: function (s) { return s; },
        createScript: function (s) { return s; },
        createScriptURL: function (u) {
          var url = new URL(u, location.href);
          if (url.protocol === 'https:' || url.protocol === 'blob:' || url.origin === location.origin) return u;
          throw new TypeError('Script bloqueado pela politica do site: ' + url.protocol);
        }
      });
    }
  </script>
"""
COMENTARIO = ("  <!-- Seguranca: CSP com hash dos scripts desta pagina e Trusted Types.\n"
              "       Gerado por tools/seguranca/csp.py no pre-commit; nao edite a mao. -->\n")
META = re.compile(r'[ \t]*<meta http-equiv="Content-Security-Policy" content="[^"]*"\s*/?>\r?\n')
VIEWPORT = re.compile(r'(<meta name="viewport"[^>]*>\r?\n)')
SCRIPT = re.compile(r"<script(?P<attrs>[^>]*)>(?P<corpo>.*?)</script>", re.S)
PROIBIDOS = [
    (re.compile(r"<script[^>]*\ssrc=", re.I), "<script src> no HTML (use o bloco que insere assets/js no fim do body)"),
    (re.compile(r"<[a-z][^>]*\son[a-z]+\s*=", re.I), "atributo on*= (use addEventListener num bloco de script)"),
    (re.compile(r"""(href|src|action)\s*=\s*["']\s*javascript:""", re.I), "endereco javascript:"),
]


def hashes(html: str) -> list[str]:
    saida = []
    for m in SCRIPT.finditer(html):
        if "application/ld+json" in m["attrs"]:
            continue  # bloco de dados, nao executa
        corpo = m["corpo"].replace("\r\n", "\n")  # o GitHub serve LF
        digest = base64.b64encode(hashlib.sha256(corpo.encode("utf-8")).digest()).decode()
        saida.append(f"'sha256-{digest}'")
    return saida


def politica(html: str) -> str:
    return ("script-src " + " ".join(hashes(html)) + " 'strict-dynamic' https: 'unsafe-inline'; "
            "object-src 'none'; base-uri 'self'; require-trusted-types-for 'script'")


def processar(html: str) -> str:
    if "trustedTypes.createPolicy('default'" not in html:
        html, n = VIEWPORT.subn(lambda m: m[1] + COMENTARIO + POLITICA_TT, html, count=1)
        if not n:
            raise ValueError("pagina sem <meta name=\"viewport\">")
    html = META.sub("", html)
    # O meta entra logo antes do comentario/politica, antes de qualquer script.
    alvo = html.index(COMENTARIO) + len(COMENTARIO)
    meta = f'  <meta http-equiv="Content-Security-Policy" content="{politica(html)}" />\n'
    return html[:alvo] + meta + html[alvo:]


def main() -> int:
    parser = argparse.ArgumentParser(description="CSP com hashes e Trusted Types por pagina.")
    modo = parser.add_mutually_exclusive_group()
    modo.add_argument("--verificar", action="store_true")
    modo.add_argument("--listar", action="store_true")
    args = parser.parse_args()

    paginas = sorted(p for p in RAIZ.rglob("*.html") if not FORA.intersection(p.relative_to(RAIZ).parts)
                     and str(p.relative_to(RAIZ)).replace("\\", "/") not in EXCLUIDAS)
    erros, alterados = [], []
    for pagina in paginas:
        with open(pagina, encoding="utf-8", newline="") as f:
            atual = f.read()
        nome = str(pagina.relative_to(RAIZ)).replace("\\", "/")
        for padrao, motivo in PROIBIDOS:
            for m in padrao.finditer(atual):
                linha = atual.count("\n", 0, m.start()) + 1
                erros.append(f"{nome}:{linha}: {motivo}")
        novo = processar(atual)
        # Idempotente: o meta nao entra no proprio hash, entao uma segunda
        # passada sobre o resultado tem de dar o mesmo texto.
        if novo != atual:
            alterados.append((pagina, nome, novo))
    for e in erros:
        print("erro: " + e, file=sys.stderr)
    if erros:
        return 1
    if args.verificar:
        if alterados:
            print("CSP desatualizada em:\n  " + "\n  ".join(n for _, n, _ in alterados)
                  + "\nRode: python tools/seguranca/csp.py", file=sys.stderr)
            return 1
        print("CSP em dia.")
        return 0
    for pagina, _, novo in alterados:
        with open(pagina, "w", encoding="utf-8", newline="") as f:
            f.write(novo)
    nomes = [n for _, n, _ in alterados]
    if args.listar:
        if nomes:
            sys.stdout.buffer.write(("\n".join(nomes) + "\n").encode("utf-8"))
    else:
        print(f"{len(nomes)} pagina(s) atualizada(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
