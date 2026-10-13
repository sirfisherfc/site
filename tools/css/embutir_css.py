#!/usr/bin/env python3
"""Embute o CSS da home dentro do index.html, minificado.

A home e a pagina que o PageSpeed mede e a porta de entrada do QR Code. Com o
CSS dentro do HTML, a primeira pintura nao espera mais dois arquivos externos
(o GitHub Pages so deixa o navegador guardar cada arquivo por 10 minutos).

Os arquivos de origem continuam sendo assets/css/style.css e desktop.css, que
as outras paginas carregam por <link>. Depois de editar qualquer um deles,
rode:

    python tools/css/embutir_css.py             # regrava o bloco no index.html
    python tools/css/embutir_css.py --verificar # falha se o bloco estiver velho
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
PAGINA = RAIZ / "index.html"
ORIGENS = (RAIZ / "assets/css/style.css", RAIZ / "assets/css/desktop.css")
BLOCO = re.compile(r'(<style id="css-embutido">)(.*?)(</style>)', re.S)


def minificar(css: str) -> str:
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"\s+", " ", css)
    css = re.sub(r"\s*([{};,>])\s*", r"\1", css)
    css = css.replace(";}", "}")
    # O CSS mora em assets/css/; embutido, os caminhos partem da raiz.
    css = css.replace('url("../', 'url("./assets/')
    return css.strip()


def gerar() -> str:
    return "".join(minificar(p.read_text(encoding="utf-8")) for p in ORIGENS)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--verificar", action="store_true", help="So confere se o bloco embutido esta atualizado.")
    args = parser.parse_args()

    html = PAGINA.read_text(encoding="utf-8")
    achado = BLOCO.search(html)
    if not achado:
        print('index.html sem <style id="css-embutido">.', file=sys.stderr)
        return 1
    css = gerar()
    if achado.group(2) == css:
        print("CSS embutido atualizado.")
        return 0
    if args.verificar:
        print("CSS embutido desatualizado: rode python tools/css/embutir_css.py", file=sys.stderr)
        return 1
    novo = html[: achado.start(2)] + css + html[achado.end(2):]
    PAGINA.write_text(novo, encoding="utf-8", newline="")
    print(f"CSS embutido regravado ({len(css)} bytes).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
