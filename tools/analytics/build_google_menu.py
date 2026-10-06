"""Converte o cardápio público para FoodMenus do Google Business Profile.

Não inclui alérgenos, pesos em conferência ou serviços que não são pratos.
Não acessa credenciais nem publica: a atualização deve usar OAuth autorizado.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def money(cents: int) -> dict:
    if not isinstance(cents, int) or cents < 0:
        raise ValueError("Preço precisa ser inteiro não negativo em centavos.")
    return {"currencyCode": "BRL", "units": cents // 100,
            "nanos": (cents % 100) * 10_000_000}


def label(name: str, description: str = "") -> list[dict]:
    if not name or len(name) > 140 or len(description) > 1000:
        raise ValueError("Nome ou descrição fora dos limites do Google.")
    result = {"displayName": name, "languageCode": "pt"}
    if description:
        result["description"] = description
    return [result]


def build_menu(data: dict) -> dict:
    sections = []
    for category in data["categorias"]:
        items = []
        for product in data["produtos"]:
            if (product["categoria"] != category["id"] or
                    not product.get("disponivel", True) or
                    "servico" in product.get("etiquetas", [])):
                continue
            variants = product.get("variantes", [])
            first = variants[0] if variants else None
            item = {
                "labels": label(product["nome"] + (" — " + first["nome"] if first else ""),
                                product.get("descricao") or ""),
                "attributes": {"price": money(first["preco_centavos"] if first
                                               else product["preco"]["centavos"])},
            }
            if len(variants) > 1:
                item["options"] = [{
                    "labels": label(product["nome"] + " — " + variant["nome"]),
                    "attributes": {"price": money(variant["preco_centavos"])},
                } for variant in variants[1:]]
            items.append(item)
        if items:
            section_name = "Adicionais" if category["id"] == "extras" else category["nome"]
            sections.append({"labels": label(section_name), "items": items})
    return {"menus": [{
        "labels": label("Cardápio do Sir Fisher", "Peixes, frutos do mar, petiscos e bebidas na Beira-Mar de Fortaleza."),
        "sourceUrl": "https://www.sirfisher.com.br/cardapio/",
        "cuisines": ["BRAZILIAN", "SEAFOOD"],
        "sections": sections,
    }]}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path(__file__).resolve().parents[2] / "cardapio/dados/cardapio.json")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.source.read_text(encoding="utf-8"))
    args.output.write_text(json.dumps(build_menu(data), ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
