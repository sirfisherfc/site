#!/usr/bin/env python3
"""Auditoria de acessibilidade do site: regras WCAG (axe-core) e teclado.

Serve a copia local do site, abre cada pagina no Edge (Playwright) no
celular e no desktop, nos temas claro e escuro, e verifica:

  - axe-core (mesmo motor do PageSpeed), regras WCAG 2.1 A/AA, incluindo
    contraste de todos os textos, nao so os que o PageSpeed amostra;
  - teclado: percorre a pagina com Tab e aponta foco invisivel (sem contorno),
    foco em elemento escondido/fora da tela, controle sem nome acessivel,
    armadilha de foco (o Tab volta ao inicio antes de chegar ao fim) e saltos
    para tras na ordem visual.

Uso (o Playwright esta no ambiente tools/analytics/.venv, ignorado pelo Git):

    tools/analytics/.venv/Scripts/python.exe tools/acessibilidade/auditar.py
    ... auditar.py cardapio/ reservas/      # so algumas paginas

Sai com codigo 1 se houver violacao do axe ou problema de teclado.
"""

from __future__ import annotations

import functools
import http.server
import json
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
PAGINAS = ["", "en/", "conheca/", "cardapio/", "en/menu/", "almoco-executivo/", "como-chegar/",
           "fish-and-chips/", "en/fish-and-chips/", "guia/beira-mar/", "por-do-sol/", "reservas/",
           "reveillon/", "eventos/", "privacidade/", "qr/"]
AXE = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js"
TELAS = {"celular": {"width": 412, "height": 915}, "desktop": {"width": 1350, "height": 900}}

FOCO_JS = """() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  // Identidade propria: dois links com o mesmo texto nao sao o mesmo elemento.
  if (!el.dataset.auditoria) el.dataset.auditoria = String(++window.__auditoria || (window.__auditoria = 1));
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const nome = (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText
               || el.getAttribute('alt') || el.value || '').trim().replace(/\\s+/g, ' ').slice(0, 50);
  const rotulado = !!(nome || el.getAttribute('aria-labelledby') || (el.labels && el.labels.length)
               || (el.id && document.querySelector(`label[for="${el.id}"]`)));
  const anel = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
  const visivel = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden'
               && r.bottom > -1 && r.right > -1 && r.left < innerWidth + 1;
  let sel = el.tagName.toLowerCase();
  if (el.id) sel += '#' + el.id;
  else if (el.classList.length) sel += '.' + [...el.classList].slice(0, 2).join('.');
  return {id: el.dataset.auditoria, sel, nome, rotulado, anel, visivel, y: r.top + scrollY, x: r.left};
}"""


class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def servir():
    handler = functools.partial(Silencioso, directory=str(RAIZ))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}/"


def teclado(page, limite=120):
    problemas, vistos, ordem = [], [], []
    for _ in range(limite):
        page.keyboard.press("Tab")
        f = page.evaluate(FOCO_JS)
        if not f:
            if vistos:
                break  # saiu do ultimo elemento: o ciclo da pagina terminou
            continue
        for _ in range(6):  # rolagem suave ate o elemento focado: ate 1,5 s
            if f["visivel"]:
                break
            page.wait_for_timeout(250)
            f = page.evaluate(FOCO_JS)
        chave = f["id"]
        if vistos and chave == vistos[-1]:
            continue  # Tab interno de um controle composto (dia/mes/ano da data)
        if vistos and chave == vistos[0]:
            break  # deu a volta: chegou ao fim da pagina e recomecou
        if chave in vistos[1:]:
            problemas.append(f"armadilha de foco perto de {f['sel']} ('{f['nome']}')")
            break
        vistos.append(chave)
        ordem.append(f)
        if not f["visivel"]:
            problemas.append(f"foco em elemento invisivel/fora da tela: {f['sel']} ('{f['nome']}')")
        elif not f["anel"]:
            problemas.append(f"foco sem indicador visivel: {f['sel']} ('{f['nome']}')")
        if not f["rotulado"]:
            problemas.append(f"controle sem nome acessivel: {f['sel']}")
    for a, b in zip(ordem, ordem[1:]):
        # Subir para o topo da coluna seguinte (mais a direita) e leitura normal.
        if a["visivel"] and b["visivel"] and b["y"] < a["y"] - 400 and b["x"] <= a["x"] + 50:
            problemas.append(f"foco volta {int(a['y'] - b['y'])} px para cima: "
                             f"{a['sel']} ('{a['nome']}') -> {b['sel']} ('{b['nome']}')")
    return problemas, len(ordem)


def main() -> int:
    alvos = sys.argv[1:] or PAGINAS
    srv, base = servir()
    total = 0
    with sync_playwright() as p:
        navegador = p.chromium.launch(channel="msedge", headless=True)
        for pagina in alvos:
            for tela, viewport in TELAS.items():
                for tema in ("light", "dark"):
                    ctx = navegador.new_context(viewport=viewport, color_scheme=tema, locale="pt-BR",
                                                is_mobile=tela == "celular", has_touch=tela == "celular")
                    page = ctx.new_page()
                    page.goto(base + pagina, wait_until="load")
                    page.wait_for_timeout(300)
                    page.add_script_tag(url=AXE)
                    resultado = page.evaluate("""() => axe.run(document, {
                        runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']}})""")
                    achados = []
                    for v in resultado["violations"]:
                        for n in v["nodes"][:4]:
                            alvo = " ".join(n["target"]) if isinstance(n["target"][0], str) else json.dumps(n["target"])
                            achados.append(f"[{v['id']}] {alvo} :: {n.get('failureSummary', '').splitlines()[-1].strip()[:140]}")
                    if tema == "light":  # a ordem do teclado nao muda com o tema
                        problemas, focaveis = teclado(page)
                        achados += [f"[teclado] {x}" for x in problemas]
                    rotulo = f"/{pagina:<20} {tela:8} {tema:5}"
                    if achados:
                        total += len(achados)
                        print(f"{rotulo} {len(achados)} problema(s)")
                        for a in achados:
                            print("    " + a)
                    else:
                        print(f"{rotulo} ok" + (f" ({focaveis} focaveis)" if tema == "light" else ""))
                    ctx.close()
        navegador.close()
    srv.shutdown()
    print(f"\nTotal: {total} problema(s).")
    return 1 if total else 0


if __name__ == "__main__":
    raise SystemExit(main())
