#!/usr/bin/env python3
"""Monitor semanal de velocidade e qualidade do site (PageSpeed + dados reais).

Mede no celular as paginas principais e le os dados de campo do Google
(CrUX, os mesmos do relatorio Core Web Vitals do Search Console). Escreve um
resumo e sai com erro quando algo piora, para o GitHub avisar por e-mail:

  - dados reais da origem fora da faixa "boa" (LCP, INP ou CLS);
  - desempenho de laboratorio abaixo de LIMITE_DESEMPENHO;
  - acessibilidade, boas praticas ou SEO abaixo de 100 (SEO da Conheca e
    noindex de proposito e fica de fora).

Roda toda segunda pelo workflow monitorar-velocidade (segredo
PAGESPEED_API_KEY no repositorio). Local: le a chave do gestao/.env.

    python tools/analytics/monitorar.py
"""

from __future__ import annotations

import importlib.util
import os
import sys
import time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("pagespeed", AQUI / "pagespeed.py")
pagespeed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pagespeed)

SITE = "https://www.sirfisher.com.br/"
PAGINAS = {"": "Home", "cardapio/": "Cardápio", "almoco-executivo/": "Almoço executivo",
           "reservas/": "Reservas", "reveillon/": "Réveillon", "eventos/": "Eventos",
           "fish-and-chips/": "Fish & chips", "por-do-sol/": "Pôr do sol", "como-chegar/": "Como chegar",
           "guia/beira-mar/": "Guia Beira-Mar", "en/": "Home EN", "conheca/": "Conheça"}
SEO_FORA = {"conheca/"}  # noindex: pagina de entrada dos anuncios
LIMITE_DESEMPENHO = 80
CAMPO = {"LARGEST_CONTENTFUL_PAINT_MS": "LCP", "INTERACTION_TO_NEXT_PAINT": "INP",
         "CUMULATIVE_LAYOUT_SHIFT_SCORE": "CLS"}


def medir(url: str) -> dict:
    for tentativa in range(3):  # o PageSpeed as vezes devolve nota nula
        dados = pagespeed.medir(url, "mobile")
        cats = dados["lighthouseResult"]["categories"]
        if all(c["score"] is not None for c in cats.values()):
            return dados
        time.sleep(5)
    return dados


def nota(cat: dict) -> int | None:
    return None if cat["score"] is None else round(cat["score"] * 100)


def main() -> int:
    linhas, alertas, origem = [], [], None
    for caminho, nome in PAGINAS.items():
        dados = medir(SITE + caminho)
        lh = dados["lighthouseResult"]
        n = {k: nota(v) for k, v in lh["categories"].items()}
        lcp = lh["audits"]["largest-contentful-paint"].get("displayValue", "").replace("\xa0", " ")
        linhas.append(f"| {nome} | {n['performance']} | {n['accessibility']} | {n['best-practices']} | {n['seo']} | {lcp} |")
        if n["performance"] is None or n["performance"] < LIMITE_DESEMPENHO:
            alertas.append(f"{nome}: desempenho {n['performance']} (mínimo {LIMITE_DESEMPENHO})")
        for cat in ("accessibility", "best-practices", "seo"):
            if cat == "seo" and caminho in SEO_FORA:
                continue
            if n[cat] is None or n[cat] < 100:
                alertas.append(f"{nome}: {cat} {n[cat]}")
        origem = origem or dados.get("originLoadingExperience", {}).get("metrics")

    campo = []
    for chave, rotulo in CAMPO.items():
        m = (origem or {}).get(chave)
        if not m:
            campo.append(f"{rotulo}: sem dados")
            continue
        valor = m["percentile"] / 100 if chave.startswith("CUMULATIVE") else m["percentile"]
        campo.append(f"{rotulo} {valor} ({m['category']})")
        if m["category"] != "FAST":
            alertas.append(f"dados reais: {rotulo} {valor} fora da faixa boa ({m['category']})")

    resumo = ["## Velocidade e qualidade do site (celular)", "",
              "Dados reais do Google, origem (p75, 28 dias): " + " · ".join(campo), "",
              "| Página | Desempenho | Acessibilidade | Boas práticas | SEO | LCP |",
              "|---|---|---|---|---|---|", *linhas, ""]
    resumo += (["### Alertas", *[f"- {a}" for a in alertas]] if alertas else ["Nenhum alerta."])
    texto = "\n".join(resumo) + "\n"
    print(texto)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(texto)
    return 1 if alertas else 0


if __name__ == "__main__":
    raise SystemExit(main())
