#!/usr/bin/env python3
"""Confere no navegador que a CSP/Trusted Types nao quebraram nada.

Serve a copia local, abre cada pagina no Edge (Playwright) e verifica:
  - nenhuma violacao de CSP/Trusted Types e nenhum erro no console;
  - os scripts do site rodaram (contador chamado, pixel da OpenAI iniciado,
    cardapio montado);
  - depois de uma interacao, Google, Meta e OpenAI baixam o SDK e tentam
    enviar o evento.
Os envios (GA, Meta, OpenAI) e o contador sao interceptados e respondidos
localmente: o teste nao suja as metricas.

    tools/analytics/.venv/Scripts/python.exe tools/seguranca/testar_navegador.py
"""

from __future__ import annotations

import functools
import http.server
import os
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
PAGINAS = ["", "en/", "conheca/", "cardapio/", "almoco-executivo/", "como-chegar/", "fish-and-chips/",
           "en/fish-and-chips/", "guia/beira-mar/", "por-do-sol/", "reservas/", "reveillon/", "eventos/",
           "privacidade/"]
SEM_MARKETING = {"eventos/", "privacidade/"}
SEM_PIXEL_META = {"cardapio/"}
UA = ("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/155.0.0.0 Mobile Safari/537.36")
INTERCEPTADOS = {
    "ga": "google-analytics.com/g/collect",
    "meta": "facebook.com/tr",
    "openai": "bzr.openai.com/v1/sdk/events",
    "contador": "/rest/v1/rpc/register_site_visit",
}
VIOLACOES_JS = """
window.__violacoes = [];
document.addEventListener('securitypolicyviolation', function (e) {
  window.__violacoes.push(e.violatedDirective + ' ' + (e.blockedURI || '') + ' ' + (e.sample || ''));
});
"""


class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main() -> int:
    alvos = sys.argv[1:] or PAGINAS
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Silencioso, directory=str(RAIZ)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    # SITE_BASE=https://www.sirfisher.com.br/ compara com o site publicado.
    base = os.environ.get("SITE_BASE") or f"http://127.0.0.1:{srv.server_address[1]}/"
    falhas = 0
    with sync_playwright() as p:
        # O Pixel da Meta nao envia nada se navigator.webdriver for true.
        navegador = p.chromium.launch(channel="msedge", headless=True,
                                      args=["--disable-blink-features=AutomationControlled"])
        for pagina in alvos:
            ctx = navegador.new_context(viewport={"width": 412, "height": 900}, is_mobile=True, has_touch=True,
                                         user_agent=UA)  # sem "HeadlessChrome": a Meta descarta
            ctx.add_init_script(VIOLACOES_JS)
            vistos, erros, sdks = {k: 0 for k in INTERCEPTADOS}, [], set()

            def rota(route, req):
                for nome, trecho in INTERCEPTADOS.items():
                    if trecho in req.url:
                        vistos[nome] += 1
                        corpo = "123" if nome == "contador" else ""
                        return route.fulfill(status=200, body=corpo, content_type="application/json")
                return route.continue_()

            ctx.route("**/*", rota)
            page = ctx.new_page()
            page.on("console", lambda m: erros.append(m.text[:160]) if m.type == "error" else None)
            page.on("pageerror", lambda e: erros.append("pageerror: " + str(e)[:160]))
            page.on("request", lambda r: sdks.add(nome) if (nome := next(
                (n for n, t in (("gtag", "googletagmanager.com/gtag/js"), ("fbevents", "fbevents.js"),
                                ("oaiq", "oaiq.min.js")) if t in r.url), None)) else None)
            page.goto(base + pagina, wait_until="load")
            page.wait_for_timeout(1500)
            estado = page.evaluate("""() => ({
                oaiq: typeof window.oaiq === 'function',
                itens: document.querySelectorAll('.item').length,
                violacoes: window.__violacoes})""")
            page.mouse.move(100, 200)
            page.mouse.wheel(0, 400)
            page.wait_for_timeout(int(os.environ.get("ESPERA_MS", "6000")))
            estado["violacoes"] = page.evaluate("window.__violacoes")

            problemas = list(estado["violacoes"]) + erros
            if pagina not in SEM_MARKETING:
                esperados = {"gtag", "oaiq"} | (set() if pagina in SEM_PIXEL_META else {"fbevents"})
                faltam = esperados - sdks
                if faltam:
                    problemas.append(f"SDK nao carregou: {sorted(faltam)}")
                if not vistos["ga"]:
                    problemas.append("GA nao enviou evento")
                if pagina not in SEM_PIXEL_META and not vistos["meta"]:
                    problemas.append("Meta nao enviou evento")
                if not estado["oaiq"]:
                    problemas.append("atribuicao.js nao iniciou o pixel da OpenAI")
            if pagina not in ("eventos/", "conheca/") and not vistos["contador"]:
                problemas.append("contador de visitas nao rodou")
            if pagina == "cardapio/" and not estado["itens"]:
                problemas.append("cardapio nao montou os itens")
            rotulo = f"/{pagina:<20}"
            resumo = f"GA {vistos['ga']} · Meta {vistos['meta']} · OpenAI {vistos['openai']} · contador {vistos['contador']}"
            if problemas:
                falhas += 1
                print(f"{rotulo} FALHOU ({resumo})")
                for x in problemas:
                    print("    " + x)
            else:
                print(f"{rotulo} ok ({resumo})")
            ctx.close()
        navegador.close()
    srv.shutdown()
    return 1 if falhas else 0


if __name__ == "__main__":
    raise SystemExit(main())
