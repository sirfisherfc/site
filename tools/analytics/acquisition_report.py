"""Aquisição, intenções e resultados, sem exportar dados pessoais ou financeiros."""
from datetime import date, datetime, timedelta, timezone
import json
import os
from pathlib import Path
import re
import unicodedata
from urllib.parse import quote
from urllib.request import Request, urlopen

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import DateRange, Dimension, Filter, FilterExpression, Metric, OrderBy, RunReportRequest
from google.auth.transport.requests import Request as AuthRequest
from google.oauth2 import service_account

PROPERTY_ID = "properties/353205396"
WORKSPACE = Path(__file__).resolve().parents[3]
INTENTS = {"click_menu", "click_reservation", "click_maps", "click_whatsapp", "click_phone"}
RESULTS = {"reservation_confirmed", "visit_realized"}


def periods(days, end):
    if not 1 <= days <= 366:
        raise ValueError("Informe de 1 a 366 dias.")
    start = end - timedelta(days=days - 1)
    return [("Atual", start, end), ("Anterior", start - timedelta(days=days), start - timedelta(days=1))]


def ga_report(client, start, end, dimensions, metrics, hostname=None):
    host_filter = None if hostname is None else FilterExpression(filter=Filter(
        field_name="hostName", string_filter=Filter.StringFilter(
            match_type=Filter.StringFilter.MatchType.EXACT, value=hostname)))
    response = client.run_report(RunReportRequest(
        property=PROPERTY_ID, date_ranges=[DateRange(start_date=start.isoformat(), end_date=end.isoformat())],
        dimensions=[Dimension(name=d) for d in dimensions], metrics=[Metric(name=m) for m in metrics],
        dimension_filter=host_filter, limit=10000,
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name=metrics[0]), desc=True)]))
    return [dict(zip(dimensions, [d.value for d in row.dimension_values]),
                 **dict(zip(metrics, [m.value for m in row.metric_values]))) for row in response.rows]


def query_group(query):
    text = "".join(c for c in unicodedata.normalize("NFKD", query.lower()) if not unicodedata.combining(c))
    if re.search(r"fisher|fischer|sirfish", text):
        return "Marca"
    if "por do sol" in text:
        return "Informacional: por do sol"
    if re.search(r"restaurante|almoco|peixe|camarao|frutos|fish|chips|jantar|menu|cardapio", text):
        return "Comercial sem marca"
    return "Outras consultas"


def search_report(credentials, start, end, dimensions):
    credentials.refresh(AuthRequest())
    url = "https://www.googleapis.com/webmasters/v3/sites/" + quote("sc-domain:sirfisher.com.br", safe="") + "/searchAnalytics/query"
    body = {"startDate": start.isoformat(), "endDate": end.isoformat(), "dimensions": dimensions,
            "dataState": "final", "type": "web", "rowLimit": 25000}
    request = Request(url, data=json.dumps(body).encode(), headers={
        "Authorization": "Bearer " + credentials.token, "Content-Type": "application/json"})
    with urlopen(request, timeout=30) as response:
        return json.load(response).get("rows", [])


def operations_report(start, end):
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    local_env = WORKSPACE / "reservas/.env.local"
    if not token and local_env.exists():
        for line in local_env.read_text(encoding="utf-8").splitlines():
            if line.startswith("SUPABASE_ACCESS_TOKEN="):
                token = line.split("=", 1)[1].strip().strip("\"'")
    if not token:
        raise ValueError("Acesso local de leitura do Supabase indisponível.")
    query = """
      with first_visits as (
        select customer_id, min(reservation_date) as first_date
        from public.reservations where status = 'compareceu' group by customer_id
      )
      select
        (select count(*) from public.reservations where source = 'public_site'
         and (created_at at time zone 'America/Fortaleza')::date between $1::date and $2::date) as public_reservations_created,
        (select count(*) from public.reservations where source = 'public_site'
         and ga_client_id is not null and ga_session_id is not null
         and (created_at at time zone 'America/Fortaleza')::date between $1::date and $2::date) as created_with_ga_identifiers,
        count(*) as attended_reservations,
        count(distinct r.customer_id) as customers_with_recorded_attendance,
        count(distinct r.customer_id) filter (where f.first_date between $1::date and $2::date) as first_recorded_attendance_customers
      from public.reservations r left join first_visits f on f.customer_id = r.customer_id
      where r.status = 'compareceu' and r.reservation_date between $1::date and $2::date
    """
    request = Request("https://api.supabase.com/v1/projects/lucpxoynpvogkvzepagi/database/query/read-only",
        data=json.dumps({"query": query, "parameters": [start.isoformat(), end.isoformat()]}).encode(),
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def get_report(days=30, end=None, hostname="www.sirfisher.com.br", include_search=True, include_operations=False):
    # Margem de três dias para consolidação; --end-date reproduz meses fechados.
    end = end or datetime.now(timezone(timedelta(hours=-3))).date() - timedelta(days=3)
    credentials = service_account.Credentials.from_service_account_file(
        str(Path(__file__).with_name("service_account.json")), scopes=[
            "https://www.googleapis.com/auth/analytics.readonly", "https://www.googleapis.com/auth/webmasters.readonly"])
    client = BetaAnalyticsDataClient(credentials=credentials)
    print(f"SIR FISHER — AQUISIÇÃO E RESULTADOS | site: {hostname}")
    for name, start, finish in periods(days, end):
        print(f"\n{name}: {start:%d/%m/%Y} a {finish:%d/%m/%Y}")
        # Sem dimensão: não somar usuários que reaparecem em vários canais.
        print("GA4, total direto:", json.dumps(ga_report(client, start, finish, [],
            ["sessions", "activeUsers", "newUsers", "screenPageViews", "engagementRate"], hostname), ensure_ascii=False))
        print("Canais (linhas não são usuários únicos somáveis):")
        for row in ga_report(client, start, finish, ["sessionSource", "sessionMedium"], ["sessions", "activeUsers"], hostname)[:20]:
            print(" ", json.dumps(row, ensure_ascii=False))
        print("Intenções no site (cliques, não clientes):")
        for row in ga_report(client, start, finish, ["eventName"], ["eventCount", "totalUsers"], hostname):
            if row["eventName"] in INTENTS:
                print(" ", json.dumps(row, ensure_ascii=False))
        # Measurement Protocol pode não informar hostname. Mostrar os resultados
        # da propriedade separadamente, sem eliminar eventos legítimos do servidor.
        print("Resultados GA4 da propriedade, sujeitos à cobertura:")
        for row in ga_report(client, start, finish, ["eventName"], ["eventCount", "totalUsers"]):
            if row["eventName"] in RESULTS:
                print(" ", json.dumps(row, ensure_ascii=False))
        print("Resultados por origem da sessão informada pelo GA4:")
        for row in ga_report(client, start, finish, ["eventName", "sessionSource", "sessionMedium"], ["eventCount"]):
            if row["eventName"] in RESULTS:
                print(" ", json.dumps(row, ensure_ascii=False))
        if include_search:
            print("Search Console, pesquisa web:", json.dumps(search_report(credentials, start, finish, []), ensure_ascii=False))
            groups = {}
            for row in search_report(credentials, start, finish, ["query"]):
                group = groups.setdefault(query_group(row["keys"][0]), {"clicks": 0, "impressions": 0})
                for metric in group:
                    group[metric] += row[metric]
            print("Consultas visíveis por grupo:", json.dumps(groups, ensure_ascii=False))
            print("Consultas ocultadas por privacidade não entram nos grupos; não são o total da propriedade.")
        if include_operations:
            print("Operação, somente agregados:", json.dumps(operations_report(start, finish), ensure_ascii=False))
    print("\nNovo usuário GA4 não significa cliente novo. Primeiro comparecimento registrado exclui visitas anteriores sem reserva.")
    print("Cliques, reservas e visitas são etapas diferentes. Valores estimados dos eventos não são faturamento.")
    print("A classificação de click_menu foi alterada em 06/10/2026; considerar isso ao comparar engajamento e key events.")
