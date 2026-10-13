#!/usr/bin/env python3
"""Versiona as referencias a assets pelo conteudo do arquivo (?v=<hash>).

O Cloudflare guarda por um ano, no navegador, todo /assets/... pedido com
?v=. Este script grava em cada referencia um hash curto do arquivo: trocar
uma foto, uma fonte, um CSS ou um JS muda o hash, e o navegador baixa a
versao nova sem que ninguem precise lembrar de nada. Referencias sem ?v=
(como as fotos que o cardapio.js monta) seguem com o cache curto da origem.

Ordem: url() dentro de assets/css/*.css, depois o CSS embutido da home
(tools/css/embutir_css.py), depois src/href/srcset de todas as paginas.

Roda sozinho antes de cada commit (.githooks/pre-commit) e e conferido no
GitHub (workflow verificar-assets). Uso manual:

    python tools/cache/versionar_assets.py              # atualiza
    python tools/cache/versionar_assets.py --verificar  # so confere
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True  # o import do embutir_css nao deixa __pycache__ no repo
RAIZ = Path(__file__).resolve().parents[2]
FORA = {"tools", "_materiais", "Fotos", "node_modules", ".git", ".github", ".githooks"}
TEXTO = {".css", ".js", ".svg", ".json", ".html", ".txt", ".xml"}
EXT = r"(?:css|js|woff2|woff|ttf|avif|webp|jpe?g|png|svg|gif|ico|json|mp4|webm|pdf)"

# ./assets/x.ext ou ../../assets/x.ext em atributos, srcset e url() embutido.
REF_HTML = re.compile(
    r"(?P<pre>[\"'\s,(])(?P<caminho>(?:\.{1,2}/)+assets/[A-Za-z0-9_\-./]+?\." + EXT + r")"
    r"(?P<versao>\?v=[A-Za-z0-9_\-]*)?(?=[\"'\s,)#])")
# url("../fonts/x.woff2") dentro de assets/css/.
REF_CSS = re.compile(
    r"(?P<pre>url\(\s*[\"']?)(?P<caminho>\.\./[A-Za-z0-9_\-./]+?\." + EXT + r")"
    r"(?P<versao>\?v=[A-Za-z0-9_\-]*)?(?=[\"')#])")


def carregar_embutir():
    spec = importlib.util.spec_from_file_location("embutir_css", RAIZ / "tools" / "css" / "embutir_css.py")
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


class Versionador:
    def __init__(self):
        self.novos: dict[Path, str] = {}   # conteudo ja versionado, ainda nao gravado
        self.faltando: set[str] = set()

    def ler(self, arquivo: Path) -> str:
        if arquivo in self.novos:
            return self.novos[arquivo]
        with open(arquivo, encoding="utf-8", newline="") as f:
            return f.read()

    def hash(self, arquivo: Path) -> str:
        if arquivo.suffix.lower() in TEXTO:
            # Normaliza CRLF: o hash e o mesmo no Windows (autocrlf) e no GitHub.
            dados = self.ler(arquivo).replace("\r\n", "\n").encode("utf-8")
        else:
            dados = arquivo.read_bytes()
        return hashlib.sha256(dados).hexdigest()[:10]

    def trocar(self, texto: str, base: Path, padrao: re.Pattern, origem: Path) -> str:
        def troca(m: re.Match) -> str:
            alvo = (base / m["caminho"]).resolve()
            if not alvo.is_file():
                self.faltando.add(f"{origem.relative_to(RAIZ)}: {m['caminho']}")
                return m.group(0)
            return f"{m['pre']}{m['caminho']}?v={self.hash(alvo)}"
        return padrao.sub(troca, texto)

    def propor(self, arquivo: Path, novo: str):
        if novo != self.ler(arquivo):
            self.novos[arquivo] = novo

    def executar(self) -> list[Path]:
        for css in sorted((RAIZ / "assets" / "css").glob("*.css")):
            self.propor(css, self.trocar(self.ler(css), css.parent, REF_CSS, css))

        # CSS embutido da home, refeito a partir do CSS ja versionado.
        embutir = carregar_embutir()
        home = RAIZ / "index.html"
        html = self.ler(home)
        bloco = embutir.BLOCO.search(html)
        if bloco:
            css = "".join(embutir.minificar(self.ler(p).replace("\r\n", "\n")) for p in embutir.ORIGENS)
            self.propor(home, html[: bloco.start(2)] + css + html[bloco.end(2):])

        paginas = [p for p in RAIZ.rglob("*.html")
                   if not FORA.intersection(p.relative_to(RAIZ).parts)]
        for pagina in sorted(paginas):
            self.propor(pagina, self.trocar(self.ler(pagina), pagina.parent, REF_HTML, pagina))
        return sorted(self.novos)

    def gravar(self):
        for arquivo, texto in self.novos.items():
            with open(arquivo, "w", encoding="utf-8", newline="") as f:
                f.write(texto)


def main() -> int:
    parser = argparse.ArgumentParser(description="Versiona referencias a assets pelo conteudo.")
    modo = parser.add_mutually_exclusive_group()
    modo.add_argument("--verificar", action="store_true", help="Nao grava; falha se algo estiver desatualizado.")
    modo.add_argument("--listar", action="store_true", help="Grava e imprime so os arquivos alterados (para o hook).")
    args = parser.parse_args()

    v = Versionador()
    alterados = v.executar()
    for item in sorted(v.faltando):
        print(f"aviso: asset inexistente referenciado em {item}", file=sys.stderr)
    nomes = [str(a.relative_to(RAIZ)).replace("\\", "/") for a in alterados]

    if args.verificar:
        if nomes:
            print("Versoes de assets desatualizadas em:\n  " + "\n  ".join(nomes)
                  + "\nRode: python tools/cache/versionar_assets.py", file=sys.stderr)
            return 1
        print("Versoes de assets em dia.")
        return 0
    v.gravar()
    if args.listar:
        # Bytes com "\n" puro: no Windows o print usaria "\r\n" e o hook leria
        # nomes de arquivo com "\r" no fim.
        if nomes:
            sys.stdout.buffer.write(("\n".join(nomes) + "\n").encode("utf-8"))
    else:
        print(f"{len(nomes)} arquivo(s) atualizado(s)." + ("\n  " + "\n  ".join(nomes) if nomes else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
