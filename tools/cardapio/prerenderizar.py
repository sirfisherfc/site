#!/usr/bin/env python3
"""Escreve o catalogo do cardapio direto no HTML (cardapio/index.html).

O cardapio.js desenha a lista a partir do bloco CARDAPIO-DADOS. Quem le a
pagina sem executar JavaScript (Semrush, Bing em parte, os robos de busca de
IA) via so o esqueleto: sem h1, 68 palavras e nenhum prato ou preco. Este
script grava, entre os marcadores CATALOGO-ESTATICO dentro do <main>, a mesma
marcacao que o cardapio.js monta em portugues. Quando o script roda, troca o
conteudo do <main> por uma copia igual: nada pisca nem muda de lugar, e a
foto nao e baixada de novo (o versionar_assets.py pula este bloco para os
enderecos continuarem iguais aos do script).

Textos fixos e icones de alergeno sao lidos do proprio cardapio.js, para nao
existirem duas copias. Roda no .githooks/pre-commit (antes do versionar_assets
e do csp.py) e e conferido no workflow verificar-assets. Uso manual:

    python tools/cardapio/prerenderizar.py              # atualiza
    python tools/cardapio/prerenderizar.py --verificar  # so confere
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
PAGINA = RAIZ / "cardapio" / "index.html"
SCRIPT = RAIZ / "assets" / "js" / "cardapio.js"

DADOS = re.compile(r'<script type="application/json" id="cardapio-dados">(.*?)</script>', re.S)
BLOCO = re.compile(r"(<!-- CATALOGO-ESTATICO:INICIO -->)(.*?)(\n[ \t]*<!-- CATALOGO-ESTATICO:FIM -->)", re.S)
TEXTO_JS = r"'((?:[^'\\]|\\.)*)'"


def objeto_js(fonte: str, nome: str, chave: str) -> dict[str, str]:
    """Pares chave: 'texto' de um objeto literal do cardapio.js (so linhas simples)."""
    corpo = re.search(r"var " + nome + r" = \{(.*?)\n  \};", fonte, re.S)
    if not corpo:
        sys.exit(f"prerenderizar: {nome} nao encontrado em assets/js/cardapio.js")
    pares = re.findall(r"^\s*" + chave + r":\s*" + TEXTO_JS + r",?\s*$", corpo.group(1), re.M)
    return {k: v.replace("\\'", "'") for k, v in pares}


def esc(texto) -> str:
    if texto is None:
        return ""
    return (str(texto).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "&#39;"))


def dinheiro(centavos) -> str:
    if centavos is None:
        return ""
    return "R$ " + f"{centavos / 100:.2f}".replace(".", ",")


class Catalogo:
    """Porta, em portugues, as funcoes de desenho da lista do cardapio.js."""

    def __init__(self, fonte_js: str):
        self.ui = objeto_js(fonte_js, "UI_PT", r"(\w+)")
        self.glifos = objeto_js(fonte_js, "GLIFOS", r"'([^']+)'")
        self.descricoes = objeto_js(fonte_js, "DESCRICOES_ALERGENOS", r"'([^']+)'")
        faltando = {"verDetalhes", "semEstoque", "contem", "legendaTitulo", "legendaIntro",
                    "legendaAviso", "voltarTopo"} - set(self.ui)
        if faltando or not self.glifos:
            sys.exit(f"prerenderizar: textos ausentes no cardapio.js: {sorted(faltando) or 'GLIFOS'}")

    def brasao(self) -> str:
        return ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
                'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z"/>'
                '<path d="M8.5 12c1.5-2 3.5-3 5-3s2.5.6 2.5 1.5-1 1.5-2.5 1.5-3.5 1-5 3"/></svg>')

    def foto(self, p) -> str:
        classe = "item__foto"
        if not p.get("foto"):
            return (f'<div class="{classe} {classe}--vazia" role="img" '
                    f'aria-label="Ainda sem foto deste prato">{self.brasao()}</div>')
        f = p["foto"]
        if f.get("url"):
            return (f'<div class="{classe}"><img src="{esc(f["url"])}" alt="{esc(f.get("alt") or "")}" '
                    'loading="lazy" decoding="async"></div>')
        base = "../assets/img/" + f["base"] + "-"
        larguras = f["larguras"]
        candidatas = [240] + larguras if larguras[0] == 440 else larguras

        def conj(ext):
            return ", ".join(f"{base}{w}.{ext} {w}w" for w in candidatas)

        return (f'<div class="{classe}"><picture>'
                f'<source type="image/avif" srcset="{esc(conj("avif"))}" sizes="112px">'
                f'<source type="image/webp" srcset="{esc(conj("webp"))}" sizes="112px">'
                f'<img src="{esc(base + str(larguras[0]) + ".jpg")}" alt="{esc(f["alt"])}" '
                f'loading="lazy" decoding="async" width="{larguras[0]}" height="{larguras[0]}">'
                '</picture></div>')

    @staticmethod
    def preco(p) -> str:
        if p["preco"]["tipo"] in ("ausente", "faixa"):
            return ""
        return f'<span class="item__preco">{dinheiro(p["preco"]["centavos"])}</span>'

    @staticmethod
    def porcao(p) -> str:
        texto = (p.get("porcao") or {}).get("texto")
        return f'<span class="item__porcao">{esc(texto)}</span>' if texto else ""

    def selos(self, p) -> str:
        selos = []
        if not p["disponivel"]:
            selos.append(f'<span class="selo selo--esgotado">{esc(self.ui["semEstoque"])}</span>')
        for a in p["adicionais"]:
            selos.append(f'<span class="selo selo--adicional">{esc(a["nome"])} + '
                         f'{dinheiro(a["preco_centavos"])}</span>')
        return "".join(selos)

    def alergenos(self, p) -> str:
        a = p.get("alimentar")
        if not a or not a.get("declarados"):
            return ""
        partes = []
        for rotulo in a["declarados"]:
            glifo = self.glifos.get(rotulo, '<circle cx="12" cy="12" r="8"/>')
            partes.append(f'<span class="item__alergeno" title="{esc(self.ui["contem"] + " " + rotulo)}">'
                          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
                          f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{glifo}</svg>'
                          f'<span>{esc(rotulo)}</span></span>')
        return '<div class="item__alergenos">' + "".join(partes) + "</div>"

    @staticmethod
    def variantes(p) -> str:
        if not p["variantes"]:
            return ""
        return ('<ul class="variantes">' + "".join(
            f'<li><b>{esc(v["nome"])}</b><span>{dinheiro(v["preco_centavos"])}</span></li>'
            for v in p["variantes"]) + "</ul>")

    @staticmethod
    def abertura(p, tipo) -> str:
        return (f'<li class="item item--{tipo}{"" if p["disponivel"] else " item--indisponivel"}" '
                f'id="item-{esc(p["id"])}"><a class="item__link" href="#p-{esc(p["id"])}">')

    def prato(self, p) -> str:
        return (self.abertura(p, "prato") + self.foto(p) +
                '<div class="item__texto">'
                f'<h3 class="item__nome">{esc(p["nome"])}</h3>' +
                (f'<p class="item__descritor">{esc(p["descritor"])}</p>' if p.get("descritor") else "") +
                (f'<p class="item__descricao">{esc(p["descricao"])}</p>' if p.get("descricao") else "") +
                '<div class="item__dados">' + self.preco(p) + self.porcao(p) + "</div>" +
                self.alergenos(p) + self.variantes(p) +
                '<div class="item__rodape">' + self.selos(p) +
                f'<span class="item__abrir">{esc(self.ui["verDetalhes"])}'
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
                'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'
                "</span></div></div></a></li>")

    def bebida(self, p) -> str:
        medida = []
        texto_porcao = (p.get("porcao") or {}).get("texto")
        if texto_porcao:
            medida.append(esc(texto_porcao))
        if p.get("descritor") and p["descritor"] != (texto_porcao or ""):
            medida.append(esc(p["descritor"]))
        if p.get("descricao"):
            medida.append(esc(p["descricao"]))
        if not p["disponivel"]:
            medida.insert(0, f'<b>{esc(self.ui["semEstoque"])}</b>')
        return (self.abertura(p, "bebida") +
                f'<h3 class="item__nome">{esc(p["nome"])}</h3>' + self.preco(p) +
                (f'<p class="item__medida">{" · ".join(medida)}</p>' if medida else "") +
                self.alergenos(p) + self.variantes(p) + "</a></li>")

    def extra(self, p) -> str:
        return (self.abertura(p, "extra") +
                f'<h3 class="item__nome">{esc(p["nome"])}</h3>' + self.preco(p) +
                (f'<p class="item__descricao">{esc(p["descritor"])}</p>' if p.get("descritor") else "") +
                self.alergenos(p) + "</a></li>")

    def secao(self, cat, produtos) -> str:
        item, lista = {"beber": (self.bebida, "lista--bebidas"),
                       "extras": (self.extra, "lista--extras")}.get(cat.get("grupo"), (self.prato, "lista--pratos"))
        da_cat = [p for p in produtos if p["categoria"] == cat["id"]]
        if not da_cat:
            return ""

        def ul(itens):
            return f'<ul class="lista {lista}">' + "".join(item(p) for p in itens) + "</ul>"

        if cat.get("subgrupos"):
            corpo = ""
            for sub in cat["subgrupos"]:
                do_sub = [p for p in da_cat if p.get("subgrupo") == sub["id"]]
                if do_sub:
                    corpo += f'<h3 class="subgrupo">{esc(sub["nome"])}</h3>' + ul(do_sub)
            soltos = [p for p in da_cat if not p.get("subgrupo")]
            if soltos:
                corpo += ul(soltos)
        else:
            corpo = ul(da_cat)
        return (f'<section class="secao" id="c-{esc(cat["id"])}" '
                f'aria-labelledby="t-{esc(cat["id"])}" data-categoria="{esc(cat["nome"])}">'
                '<div class="secao__cabeca">'
                f'<h2 id="t-{esc(cat["id"])}">{esc(cat["nome"])}</h2>' +
                (f'<p class="secao__resumo">{esc(cat["resumo"])}</p>' if cat.get("resumo") else "") +
                "</div>" + corpo + "</section>")

    def legenda(self) -> str:
        itens = "".join(
            '<div class="legenda-alergenos__item">'
            '<span class="legenda-alergenos__icone" aria-hidden="true">'
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
            f'stroke-linecap="round" stroke-linejoin="round">{glifo}</svg>'
            "</span>"
            '<div class="legenda-alergenos__info">'
            f"<strong>{esc(rotulo)}</strong>" +
            (f"<small>{esc(self.descricoes[rotulo])}</small>" if self.descricoes.get(rotulo) else "") +
            "</div></div>"
            for rotulo, glifo in self.glifos.items())
        return ('<section class="legenda-alergenos" id="legenda-alergenos" aria-labelledby="t-legenda-alergenos">'
                '<div class="legenda-alergenos__cabeca">'
                f'<h2 id="t-legenda-alergenos">{esc(self.ui["legendaTitulo"])}</h2>'
                f'<p>{esc(self.ui["legendaIntro"])}</p>'
                "</div>"
                f'<div class="legenda-alergenos__grid">{itens}</div>'
                f'<div class="legenda-alergenos__aviso">{self.ui["legendaAviso"]}</div>'
                "</section>")

    def voltar_topo(self) -> str:
        return ('<a class="voltar-topo" href="#topo" id="btn-voltar-topo">'
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
                'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>'
                f"{esc(self.ui['voltarTopo'])}</a>")

    def html(self, dados) -> str:
        # Mesma sequencia de desenharCatalogo(); quebras de linha so entre blocos.
        blocos = [self.secao(c, dados["produtos"]) for c in dados["categorias"]]
        return "\n".join(b for b in blocos if b) + "\n" + self.legenda() + self.voltar_topo()


def main() -> int:
    parser = argparse.ArgumentParser(description="Catalogo do cardapio escrito no HTML.")
    modo = parser.add_mutually_exclusive_group()
    modo.add_argument("--verificar", action="store_true")
    modo.add_argument("--listar", action="store_true")
    args = parser.parse_args()

    with open(PAGINA, encoding="utf-8", newline="") as f:
        atual = f.read()
    dados_m, bloco_m = DADOS.search(atual), BLOCO.search(atual)
    if not dados_m or not bloco_m:
        print("prerenderizar: bloco cardapio-dados ou marcadores CATALOGO-ESTATICO ausentes "
              "em cardapio/index.html", file=sys.stderr)
        return 1
    nl = "\r\n" if "\r\n" in atual else "\n"
    catalogo = Catalogo(SCRIPT.read_text(encoding="utf-8"))
    conteudo = catalogo.html(json.loads(dados_m.group(1))).replace("\n", nl)
    novo = atual[: bloco_m.start(2)] + nl + conteudo + atual[bloco_m.end(2):]

    if args.verificar:
        if novo != atual:
            print("Catalogo estatico do cardapio desatualizado.\n"
                  "Rode: python tools/cardapio/prerenderizar.py", file=sys.stderr)
            return 1
        print("Catalogo estatico do cardapio em dia.")
        return 0
    if novo != atual:
        with open(PAGINA, "w", encoding="utf-8", newline="") as f:
            f.write(novo)
    if args.listar:
        if novo != atual:
            sys.stdout.buffer.write(b"cardapio/index.html\n")
    else:
        print("cardapio/index.html " + ("atualizado." if novo != atual else "ja estava em dia."))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
