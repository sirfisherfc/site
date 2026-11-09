"""Mantem a lista visivel de perguntas frequentes igual ao FAQPage de cada pagina.

O JSON-LD FAQPage e a fonte. Para mudar uma pergunta ou resposta, edite o bloco
FAQPage da pagina; este script reescreve o trecho visivel entre os marcadores

    <!-- faq:inicio estilo=aberto -->      (h3 + p, texto sempre a mostra)
    <!-- faq:inicio estilo=detalhes -->    (details/summary, como na home)
    <!-- faq:fim -->

Motivos: o Google so aceita FAQPage com o conteudo visivel na pagina, e o Bing
recomenda nao esconder respostas importantes. Toda pagina com FAQPage precisa
dos marcadores, e todo par de marcadores precisa de um FAQPage.

Uso:
  python tools/faq/sincronizar_faq.py              # reescreve o que estiver diferente
  python tools/faq/sincronizar_faq.py --verificar  # so confere (CI)
  python tools/faq/sincronizar_faq.py --listar     # reescreve e lista os arquivos (pre-commit)
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
FORA = {"tools", "_materiais", "Fotos", "node_modules", ".git", ".github", ".githooks"}
LD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
MARCAS = re.compile(r"(?P<ind>[ \t]*)<!-- faq:inicio estilo=(?P<estilo>aberto|detalhes) -->(?P<corpo>.*?)<!-- faq:fim -->", re.S)
ESTILOS = ("aberto", "detalhes")


def perguntas(pagina: str) -> list[tuple[str, str]] | None:
    """Pares (pergunta, resposta) do primeiro FAQPage, ou None se nao houver."""
    for bloco in LD.findall(pagina):
        dado = json.loads(bloco)
        if isinstance(dado, dict) and dado.get("@type") == "FAQPage":
            return [(q["name"], q["acceptedAnswer"]["text"]) for q in dado.get("mainEntity", [])]
    return None


def renderizar(itens: list[tuple[str, str]], estilo: str, ind: str, nl: str) -> str:
    texto = lambda s: html.escape(s, quote=False)
    if estilo == "aberto":
        blocos = [f"{ind}<h3>{texto(q)}</h3>{nl}{ind}<p>{texto(a)}</p>{nl}" for q, a in itens]
        return nl + nl.join(blocos) + ind
    blocos = [f"{ind}<details>{nl}{ind}  <summary>{texto(q)}</summary>{nl}{ind}  <p>{texto(a)}</p>{nl}{ind}</details>{nl}"
              for q, a in itens]
    return nl + "".join(blocos) + ind


def processar(pagina: str) -> tuple[str, list[str]]:
    """Devolve (pagina reescrita, erros)."""
    nl = "\r\n" if "\r\n" in pagina else "\n"
    itens = perguntas(pagina)
    marcas = list(MARCAS.finditer(pagina))
    if itens is None and not marcas:
        return pagina, []
    if itens is None:
        return pagina, ["marcadores faq sem bloco FAQPage"]
    if not marcas:
        return pagina, ["FAQPage sem os marcadores <!-- faq:inicio estilo=... --> e <!-- faq:fim -->"]
    if len(marcas) > 1:
        return pagina, ["mais de um par de marcadores faq"]
    m = marcas[0]
    novo = renderizar(itens, m["estilo"], m["ind"], nl)
    inicio = m.start("corpo")
    return pagina[:inicio] + novo + pagina[m.end("corpo"):], []


def main() -> int:
    parser = argparse.ArgumentParser(description="FAQ visivel gerado a partir do FAQPage de cada pagina.")
    modo = parser.add_mutually_exclusive_group()
    modo.add_argument("--verificar", action="store_true")
    modo.add_argument("--listar", action="store_true")
    args = parser.parse_args()

    paginas = sorted(p for p in RAIZ.rglob("*.html") if not FORA.intersection(p.relative_to(RAIZ).parts))
    erros, alterados = [], []
    for caminho in paginas:
        with open(caminho, encoding="utf-8", newline="") as f:
            atual = f.read()
        nome = str(caminho.relative_to(RAIZ)).replace("\\", "/")
        novo, problemas = processar(atual)
        erros += [f"{nome}: {p}" for p in problemas]
        if not problemas and novo != atual:
            alterados.append((caminho, nome, novo))
    for e in erros:
        print("erro: " + e, file=sys.stderr)
    if erros:
        return 1
    if args.verificar:
        if alterados:
            print("FAQ visivel diferente do FAQPage em:\n  " + "\n  ".join(n for _, n, _ in alterados)
                  + "\nRode: python tools/faq/sincronizar_faq.py", file=sys.stderr)
            return 1
        print("FAQ visivel em dia com o FAQPage.")
        return 0
    for caminho, nome, novo in alterados:
        with open(caminho, "w", encoding="utf-8", newline="") as f:
            f.write(novo)
        print(nome if args.listar else f"atualizado: {nome}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
