"""Avisa os buscadores do protocolo IndexNow (Bing e outros) sobre URLs alteradas.

O Bing alimenta o Copilot; o IndexNow faz o Bing rever uma pagina em horas, em
vez de esperar o proximo rastreamento. O Google nao participa do protocolo e
continua recebendo o sitemap pelo Search Console.

A chave e publica por definicao: fica no arquivo <chave>.txt na raiz do site,
e o buscador confere que o dono do dominio a publicou. So entram URLs que estao
no sitemap (as paginas com noindex ficam de fora).

Uso:
  python tools/indexnow/avisar.py --desde <commit>   # paginas alteradas desde o commit
  python tools/indexnow/avisar.py --todas            # todas as URLs do sitemap
  ... --simular                                      # mostra o pedido sem enviar
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
HOST = "www.sirfisher.com.br"
ENDPOINT = "https://api.indexnow.org/indexnow"
CHAVE = re.compile(r"^[0-9a-f]{32}$")


def chave(raiz: Path = RAIZ) -> str:
    arquivos = [p for p in raiz.glob("*.txt") if CHAVE.match(p.stem) and p.read_text(encoding="utf-8").strip() == p.stem]
    if len(arquivos) != 1:
        sys.exit(f"Esperava um unico arquivo de chave IndexNow na raiz; achei {len(arquivos)}.")
    return arquivos[0].stem


def urls_do_sitemap(raiz: Path = RAIZ) -> list[str]:
    texto = (raiz / "sitemap.xml").read_text(encoding="utf-8")
    return re.findall(r"<loc>([^<]+)</loc>", texto)


def url_do_arquivo(caminho: str) -> str | None:
    """index.html -> https://host/ ; x/y/index.html -> https://host/x/y/ ; outros -> None."""
    caminho = caminho.replace("\\", "/")
    if caminho == "index.html":
        return f"https://{HOST}/"
    if caminho.endswith("/index.html"):
        return f"https://{HOST}/{caminho[:-len('index.html')]}"
    return None


def alterados_desde(commit: str) -> list[str]:
    if not commit or set(commit) == {"0"}:
        return []
    saida = subprocess.run(["git", "diff", "--name-only", commit, "HEAD"], cwd=RAIZ,
                           capture_output=True, text=True, check=True).stdout
    return [linha.strip() for linha in saida.splitlines() if linha.strip()]


def selecionar(arquivos: list[str], sitemap: list[str]) -> list[str]:
    permitidas = set(sitemap)
    urls = {url_do_arquivo(a) for a in arquivos}
    return [u for u in sitemap if u in urls and u in permitidas]


def pedido(urls: list[str], chave_: str) -> dict:
    return {"host": HOST, "key": chave_, "keyLocation": f"https://{HOST}/{chave_}.txt", "urlList": urls}


def enviar(corpo: dict) -> int:
    dados = json.dumps(corpo).encode()
    req = urllib.request.Request(ENDPOINT, data=dados, method="POST",
                                 headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


def main() -> int:
    parser = argparse.ArgumentParser(description="IndexNow para as paginas do sitemap.")
    parser.add_argument("--desde", default="", help="Commit anterior; envia as paginas alteradas depois dele.")
    parser.add_argument("--todas", default="false", nargs="?", const="true",
                        help="Envia todas as URLs do sitemap (aceita true/false, para o workflow).")
    parser.add_argument("--simular", action="store_true")
    args = parser.parse_args()

    sitemap = urls_do_sitemap()
    if str(args.todas).lower() == "true":
        urls = sitemap
    else:
        urls = selecionar(alterados_desde(args.desde), sitemap)
    if not urls:
        print("Nenhuma pagina do sitemap mudou; nada a enviar.")
        return 0
    corpo = pedido(urls, chave())
    print(f"{len(urls)} URL(s): " + ", ".join(urls))
    if args.simular:
        print("Simulacao; nada enviado.")
        return 0
    status = enviar(corpo)
    print(f"IndexNow respondeu HTTP {status}.")
    # 200 = recebido; 202 = recebido, chave ainda em validacao.
    return 0 if status in (200, 202) else 1


if __name__ == "__main__":
    sys.exit(main())
