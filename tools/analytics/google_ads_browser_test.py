"""Testa consentimento e destinos sem carregar SDKs ou enviar dados externos.

python -X utf8 tools/analytics/google_ads_browser_test.py
Os hosts publicos sao simulados por arquivos locais em um contexto isolado.
"""
from pathlib import Path
from urllib.parse import urlparse, unquote
import mimetypes

from playwright.sync_api import sync_playwright

SITE = Path(__file__).resolve().parents[2]
WORKSPACE = SITE.parent
PORTAL = WORKSPACE / 'reservas'
SCREENSHOTS = WORKSPACE / 'gestao/tmp/google-ads-2026-11-03'
GA = 'G-F40Z5Y9QT6'
ADS = 'AW-10856025003'


def commands(page):
    return page.evaluate('() => (window.dataLayer || []).map(x => Array.from(x))')


def ads_config(page):
    return [x for x in commands(page) if x[:2] == ['config', ADS]]


def events(page, name):
    return [x for x in commands(page) if x[:2] == ['event', name]]


def consent(page):
    rows = [x for x in commands(page) if x[0] == 'consent']
    return rows[-1][2]


def route(context):
    def serve(request_route):
        request = request_route.request
        url = urlparse(request.url)
        root = {'www.sirfisher.com.br': SITE, 'reservas.sirfisher.com.br': PORTAL}.get(url.hostname)
        if root and request.method == 'GET':
            relative = unquote(url.path).lstrip('/')
            file = (root / relative).resolve()
            if file.is_relative_to(root) and file.is_dir():
                file = file / 'index.html'
            if file.is_relative_to(root) and file.is_file():
                content_type = mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
                return request_route.fulfill(body=file.read_bytes(), content_type=content_type)
            return request_route.fulfill(status=404, body='fixture not found')
        if url.hostname == 'lucpxoynpvogkvzepagi.supabase.co' and url.path.endswith('/fn_revoke_advertising_consent'):
            return request_route.fulfill(body='true', content_type='application/json')
        if url.hostname == 'www.googletagmanager.com' and url.path == '/gtag/js':
            return request_route.fulfill(body='/* SDK externo bloqueado no teste. */', content_type='text/javascript')
        return request_route.abort()
    context.route('**/*', serve)


def ready(page, url):
    page.goto(url, wait_until='domcontentloaded')
    page.wait_for_function('() => !!window.sfGoogleAds')
    page.locator('.sf-gads-preferences').wait_for()


def main():
    assert (SITE / 'assets/js/google-ads.js').read_bytes() == (PORTAL / 'assets/js/google-ads.js').read_bytes()
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        route(context)
        context.add_cookies([
            {'name': '_ga', 'value': 'fixture-analytics', 'domain': '.sirfisher.com.br', 'path': '/', 'secure': True},
            {'name': '_ga_F40Z5Y9QT6', 'value': 'fixture-analytics-session', 'domain': '.sirfisher.com.br', 'path': '/', 'secure': True},
            {'name': '_fbp', 'value': 'fixture-meta-browser', 'domain': '.sirfisher.com.br', 'path': '/', 'secure': True},
            {'name': '_fbc', 'value': 'fixture-meta-click', 'domain': '.sirfisher.com.br', 'path': '/', 'secure': True},
            {'name': '_gcl_aw', 'value': 'fixture-advertising', 'domain': '.sirfisher.com.br', 'path': '/', 'secure': True},
        ])
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)) if 'google-ads.js' in (error.stack or '') else None)
        ready(page, 'https://www.sirfisher.com.br/?gclid=fixture&email=private-fixture')
        rows = commands(page)
        assert rows[0][:2] == ['consent', 'default']
        assert all(consent(page)[key] == 'denied' for key in ('ad_storage', 'ad_user_data', 'ad_personalization'))
        assert len(ads_config(page)) == 1
        assert ads_config(page)[0][2]['allow_enhanced_conversions'] is False
        assert ads_config(page)[0][2]['page_location'] == 'https://www.sirfisher.com.br/'
        cookie_names = {c['name'] for c in context.cookies()}
        previous_names = {'_ga', '_ga_F40Z5Y9QT6', 'sf_attribution_v1'}
        assert previous_names <= cookie_names and not {'_gcl_aw','_fbp','_fbc'} & cookie_names, cookie_names
        assert page.evaluate('typeof window.fbq === "undefined" && typeof window.oaiq === "undefined"')
        shown = events(page, 'publicidade_aviso_exibido')
        assert len(shown) == 1 and shown[0][2] == {'send_to': GA}, shown
        preserved ={c['name']: c['value'] for c in context.cookies() if c['name'] in previous_names}
        desktop_box = page.locator('.sf-gads-banner').bounding_box()
        assert desktop_box['width'] <= 421 and desktop_box['height'] <= 170
        assert page.locator('.sf-gads-description').evaluate('e => e.offsetHeight / parseFloat(getComputedStyle(e).lineHeight)') <= 2.1
        page.screenshot(path=str(SCREENSHOTS / 'desktop.png'), full_page=False)

        page.locator('.sf-gads-deny').click()
        after_denial = {c['name']: c['value'] for c in context.cookies() if c['name'] in preserved}
        assert after_denial == preserved, 'Recusa Google modificou cookies existentes'
        assert consent(page)['ad_storage'] == 'denied'
        assert 'analytics_storage' not in consent(page), 'Recusa Google alterou o consentimento analitico'
        assert len(events(page, 'publicidade_recusada')) == 1 and not events(page, 'publicidade_aceita')
        page.locator('.sf-gads-preferences').click()

        # Eventos existentes recebem um destino GA4 sem alterar o objeto original.
        assert page.evaluate("""() => {
            const original = {form_kind: 'standard', reservation_id: 'fixture'};
            gtag('event', 'reservation_confirmed', original);
            const row = Array.from(dataLayer[dataLayer.length - 1]);
            return row[2].send_to === 'G-F40Z5Y9QT6' && !original.send_to;
        }""")
        page.locator('.sf-gads-allow').click()
        assert consent(page)['ad_storage'] == 'granted'
        accepted = events(page, 'publicidade_aceita')
        assert len(accepted) == 1 and accepted[0][2] == {'send_to': GA}, accepted
        assert page.evaluate('sfGoogleAds.snapshot().advertising_consent && typeof fbq === \"function\"')
        choice = next(c for c in context.cookies() if c['name'] == 'sf_advertising_v2')
        assert choice['value'].startswith('granted.') and choice['domain'] == '.sirfisher.com.br' and choice['secure']
        assert len(ads_config(page)) == 1
        assert page.evaluate('sfGoogleAds.snapshot().advertising_consent_at !== null')

        ready(page, 'https://reservas.sirfisher.com.br/')
        assert consent(page)['ad_personalization'] == 'granted'
        assert page.locator('.sf-gads-banner').is_hidden()
        assert not events(page, 'publicidade_aviso_exibido'), 'Aviso contado depois da escolha'
        rows = commands(page)
        saved_update = next(i for i, x in enumerate(rows) if x[:2] == ['consent', 'update'])
        ad_index = next(i for i, x in enumerate(rows) if x[:2] == ['config', ADS])
        assert saved_update < ad_index

        ready(page, 'https://www.sirfisher.com.br/privacidade/')
        assert not ads_config(page)  # Preferencias funcionam sem instalar medicao nesta pagina.
        page.locator('.sf-gads-preferences').click()
        page.locator('.sf-gads-deny').click()
        ready(page, 'https://reservas.sirfisher.com.br/')
        assert consent(page)['ad_personalization'] == 'denied'
        assert page.locator('.sf-gads-banner').is_hidden()
        page.evaluate("document.documentElement.lang='en'")
        page.wait_for_function("document.querySelector('.sf-gads-allow').textContent === 'Allow'")

        page.goto('https://reservas.sirfisher.com.br/cancelar.html?token=private-fixture', wait_until='domcontentloaded')
        assert not ads_config(page)
        assert page.evaluate('typeof window.fbq') == 'undefined'
        ga_config = next(x for x in commands(page) if x[:2] == ['config', GA])
        assert ga_config[2]['page_location'] == 'https://reservas.sirfisher.com.br/cancelar.html'
        assert not errors, errors
        context.close()

        # Nova visita em celular, incluindo cookies bloqueados pelo navegador.
        mobile = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        route(mobile)
        mobile.add_init_script("""Object.defineProperty(Document.prototype, 'cookie', {
            configurable: true,
            get() { throw new Error('cookies blocked in fixture'); },
            set() { throw new Error('cookies blocked in fixture'); }
        });""")
        page = mobile.new_page()
        ready(page, 'https://www.sirfisher.com.br/en/')
        assert page.locator('.sf-gads-banner').is_visible()
        box = page.locator('.sf-gads-banner').bounding_box()
        assert box['x'] >= 0 and box['x'] + box['width'] <= 391
        assert box['height'] <= 170
        assert page.locator('.sf-gads-description').evaluate('e => e.offsetHeight / parseFloat(getComputedStyle(e).lineHeight)') <= 2.1
        page.screenshot(path=str(SCREENSHOTS / 'mobile.png'), full_page=False)
        page.locator('.sf-gads-deny').click()
        assert consent(page)['ad_user_data'] == 'denied'
        page.locator('.sf-gads-preferences').click()
        page.locator('.sf-gads-allow').click()
        assert consent(page)['ad_storage'] == 'granted'
        assert len(ads_config(page)) == 1
        mobile.close()

        for width in [320, 360, 390, 430]:
            compact = browser.new_context(viewport={'width': width, 'height': 844}, is_mobile=True)
            route(compact)
            compact.add_cookies([{'name': 'sf_google_ads_v1', 'value': 'granted',
                                 'domain': '.sirfisher.com.br', 'path': '/', 'secure': True}])
            sample = compact.new_page()
            ready(sample, 'https://www.sirfisher.com.br/')
            assert sample.locator('.sf-gads-banner').is_visible(), 'Autorizacao antiga de Google foi ampliada'
            assert sample.evaluate('typeof fbq === "undefined" && typeof oaiq === "undefined"')
            assert sample.locator('.sf-gads-description').evaluate(
                'e => e.offsetHeight / parseFloat(getComputedStyle(e).lineHeight)') <= 2.1
            compact.close()
        browser.close()
    print('OK: consentimento, escolha entre subdominios, recusa, eventos GA4, URLs privadas, idioma e celular; sem SDKs externos ou reservas reais.')


if __name__ == '__main__':
    main()
