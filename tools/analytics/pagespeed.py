#!/usr/bin/env python3
"""Mede uma pagina no PageSpeed Insights (celular e desktop) e resume.

Usa PAGESPEED_API_KEY, da variavel de ambiente ou do gestao/.env (ignorado
pelo Git). Sem a chave, a cota anonima costuma estar esgotada (HTTP 429).
O OAuth do Perfil da Empresa nao serve: falta escopo (HTTP 403).

    python site/tools/analytics/pagespeed.py
    python site/tools/analytics/pagespeed.py https://www.sirfisher.com.br/cardapio/ --estrategia mobile

O escore de laboratorio oscila alguns pontos entre execucoes: compare mais de
uma rodada. Teste com www; sem www entra o redirecionamento (~0,8 s no celular).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ENV = Path(__file__).resolve().parents[3] / "gestao" / ".env"
METRICAS = ("first-contentful-paint", "largest-contentful-paint", "total-blocking-time",
            "cumulative-layout-shift", "speed-index")


def chave() -> str:
    if os.environ.get("PAGESPEED_API_KEY"):
        return os.environ["PAGESPEED_API_KEY"]
    if ENV.exists():
        for linha in ENV.read_text(encoding="utf-8").splitlines():
            if linha.startswith("PAGESPEED_API_KEY="):
                return linha.split("=", 1)[1].strip()
    sys.exit("PAGESPEED_API_KEY ausente (gestao/.env ou variavel de ambiente).")


def medir(url: str, estrategia: str) -> dict:
    params = [("url", url), ("strategy", estrategia), ("locale", "pt_BR"), ("key", chave())]
    params += [("category", c) for c in ("performance", "accessibility", "best-practices", "seo")]
    req = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"PageSpeed recusou ({estrategia}): HTTP {e.code}")


def resumir(dados: dict, estrategia: str) -> None:
    lh = dados["lighthouseResult"]
    a = lh["audits"]
    # O PageSpeed as vezes devolve score nulo numa execucao instavel: repetir.
    notas = " · ".join(f"{k} {'n/d' if v['score'] is None else round(v['score'] * 100)}"
                       for k, v in lh["categories"].items())
    print(f"== {estrategia}: {notas}")
    print("   " + " · ".join(f"{a[m]['title']} {a[m].get('displayValue', '')}".replace("\xa0", " ") for m in METRICAS))
    campo = dados.get("loadingExperience", {}).get("metrics", {})
    if campo:
        print("   campo (CrUX):", ", ".join(f"{k} {v.get('percentile')} {v.get('category')}" for k, v in campo.items()))
    for cat in lh["categories"].values():
        for ref in cat["auditRefs"]:
            x = a[ref["id"]]
            if x.get("score") is not None and x["score"] < 0.9 and x.get("scoreDisplayMode") not in (
                    "notApplicable", "manual", "informative"):
                print(f"   [{cat['id']}] {x['title']} {x.get('displayValue', '')}".replace("\xa0", " "))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("url", nargs="?", default="https://www.sirfisher.com.br/")
    parser.add_argument("--estrategia", choices=("mobile", "desktop", "ambas"), default="ambas")
    parser.add_argument("--json", type=Path, help="Pasta para salvar as respostas completas.")
    args = parser.parse_args()
    for estrategia in (("mobile", "desktop") if args.estrategia == "ambas" else (args.estrategia,)):
        dados = medir(args.url, estrategia)
        if args.json:
            args.json.mkdir(parents=True, exist_ok=True)
            (args.json / f"psi_{estrategia}.json").write_text(json.dumps(dados), encoding="utf-8")
        resumir(dados, estrategia)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
