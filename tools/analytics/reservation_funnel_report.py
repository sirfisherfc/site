"""Funil GA4 sequencial e coorte operacional, somente agregados e leitura.

Usa os SDKs Google ja instalados no .venv de analytics. Nao envia eventos,
nao exporta identificadores e nao faz correspondencia individual de clientes.
"""
from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path
from urllib.request import Request, urlopen

from google.analytics.data_v1alpha import AlphaAnalyticsDataClient
from google.analytics.data_v1alpha.types import RunFunnelReportRequest
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import RunReportRequest
from google.api_core.exceptions import InvalidArgument
from google.oauth2 import service_account

from supabase_credentials import PORTAL_REF, access_token

PROPERTY_ID = "properties/353205396"
FORTALEZA = timezone(timedelta(hours=-3), name="America/Fortaleza")
INSTRUMENTED_FROM = date(2026, 10, 22)
STEPS = (
    "reservation_form_view", "reservation_form_start",
    "reservation_submit_attempt", "reservation_confirmed",
)
DIAGNOSTICS = ("reservation_unavailable", "reservation_error")
CUSTOM_DIMENSIONS = ("customEvent:form_kind", "customEvent:cta_position",
                     "customEvent:reservation_stage", "customEvent:reservation_reason")
STATUSES = {"confirmada", "cancelada_cliente", "cancelada_restaurante",
            "compareceu", "no_show", "desistiu", "recusada"}
OPERATIONS_SQL = """
with cohort as (
  select status,
    nullif(btrim(ga_client_id), '') is not null
    and nullif(btrim(ga_session_id), '') is not null as has_ga_identifiers
  from public.reservations
  where source = 'public_site'
    and created_at >= ($1::date::timestamp at time zone 'America/Fortaleza')
    and created_at < (($2::date + 1)::timestamp at time zone 'America/Fortaleza')
), status_counts as (
  select status, count(*) as total from cohort group by status
)
select count(*) as reservations_created,
  count(*) filter (where has_ga_identifiers) as created_with_ga_identifiers,
  coalesce((select jsonb_object_agg(status, total) from status_counts), '{}'::jsonb)
    as current_status_counts
from cohort
"""


class ReportReadError(RuntimeError):
    """Contexto seguro, sem mensagens/payloads do provedor."""
    def __init__(self, stage, cause_type):
        self.stage = stage
        self.cause_type = cause_type
        super().__init__(stage)


def read_stage(stage, callback):
    try:
        return callback()
    except Exception as error:
        raise ReportReadError(stage, type(error).__name__) from None


def period(start=None, end=None, days=None, now=None):
    now = now or datetime.now(FORTALEZA)
    end = end or now.astimezone(FORTALEZA).date() - timedelta(days=3)
    if start is not None and days is not None:
        raise ValueError("Use --start/--end ou --days/--end-date.")
    if start is None:
        days = 7 if days is None else days
        if not 1 <= days <= 366:
            raise ValueError("Informe de 1 a 366 dias.")
        start = end - timedelta(days=days - 1)
    if not isinstance(start, date) or not isinstance(end, date):
        raise ValueError("Informe datas ISO AAAA-MM-DD.")
    if not 0 <= (end - start).days < 366:
        raise ValueError("O intervalo deve ter de 1 a 366 dias e inicio anterior ao fim.")
    if end > now.astimezone(FORTALEZA).date():
        raise ValueError("A data final nao pode estar no futuro de Fortaleza.")
    return start, end


def funnel_request(start, end, breakdown=None):
    request = {
        "property": PROPERTY_ID,
        "date_ranges": [{"start_date": start.isoformat(), "end_date": end.isoformat()}],
        "funnel": {"is_open_funnel": False, "steps": [
            {"name": event, "is_directly_followed_by": False, "filter_expression": {
                "funnel_event_filter": {"event_name": event,
                    "funnel_parameter_filter_expression": {"funnel_parameter_filter": {
                        "event_parameter_name": "form_kind",
                        "string_filter": {"match_type": "EXACT", "value": "standard", "case_sensitive": True},
                    }}}}}
            for event in STEPS]},
        "limit": 10000,
    }
    if breakdown:
        request["funnel_breakdown"] = {"breakdown_dimension": {"name": breakdown}, "limit": 15}
    return RunFunnelReportRequest(request)


def funnel_rows(response):
    """Preserva o total reservado; nunca soma usuarios de recortes distintos."""
    table = response.funnel_table
    dimensions = [header.name for header in table.dimension_headers]
    metrics = [header.name for header in table.metric_headers]
    allowed_dimensions = {"funnelStepName", "deviceCategory", "sessionSourceMedium", *CUSTOM_DIMENSIONS}
    allowed_metrics = {"activeUsers", "funnelStepCompletionRate", "funnelStepAbandonments", "funnelStepAbandonmentRate"}
    if not set(dimensions) <= allowed_dimensions or not set(metrics) <= allowed_metrics:
        raise ValueError("Cabecalhos inesperados no funil agregado.")
    rows = []
    for row in table.rows:
        entry = dict(zip(dimensions, [value.value for value in row.dimension_values]))
        for name, value in zip(metrics, row.metric_values):
            entry[name] = int(value.value) if name in {"activeUsers", "funnelStepAbandonments"} else float(value.value)
        rows.append(entry)
    sampling = [{"samples_read": int(item.samples_read_count), "sampling_space": int(item.sampling_space_size)}
                for item in table.metadata.sampling_metadatas]
    totals = dict.fromkeys(STEPS, 0)
    breakdowns = set(dimensions) - {"funnelStepName"}
    for row in rows:
        if any(row.get(name) != "RESERVED_TOTAL" for name in breakdowns):
            continue
        step = row.get("funnelStepName", "").split(". ", 1)[-1]
        if step in totals:
            totals[step] = row.get("activeUsers", 0)
    return {"rows": rows, "observed_total_by_step": totals, "sampling": sampling}


def pending_dimension(error):
    # Uma dimensao recem-registrada pode aparecer no metadata antes de aceitar
    # consultas. Somente esse erro permite omitir o recorte opcional.
    return isinstance(error, InvalidArgument) and any(
        name in str(error) for name in ("customEvent:", "form_kind", "cta_position", "reservation_reason", "reservation_stage"))


def event_counts(beta, start, end):
    # reservation_confirmed ja era exclusivo da reserva comum; Reveillon usa
    # outros eventos. Sem filtro novo, preserva a linha de base anterior a 22/10.
    filters = [{"filter": {"field_name": "eventName", "in_list_filter": {"values": [*STEPS, *DIAGNOSTICS]}}}]
    request = RunReportRequest(property=PROPERTY_ID,
        date_ranges=[{"start_date": start.isoformat(), "end_date": end.isoformat()}],
        dimensions=[{"name": "eventName"}],
        metrics=[{"name": "eventCount"}, {"name": "totalUsers"}],
        dimension_filter={"and_group": {"expressions": filters}}, limit=1000)
    response = beta.run_report(request, retry=None, timeout=30)
    rows = []
    for row in response.rows:
        name = row.dimension_values[0].value
        rows.append({"eventName": name, "eventCount": int(row.metric_values[0].value),
                     "totalUsers": int(row.metric_values[1].value)})
    metadata = response.metadata
    return {"rows": rows, "scope": "standard_reservations_including_legacy_confirmations",
            "ga4_time_zone": metadata.time_zone or "not_reported",
            "subject_to_thresholding": bool(metadata.subject_to_thresholding),
            "data_loss_from_other_row": bool(metadata.data_loss_from_other_row)}


def operations_report(start, end):
    # Destino fixo: nao aceita projeto/SQL arbitrarios via argumento.
    request = Request(f"https://api.supabase.com/v1/projects/{PORTAL_REF}/database/query/read-only",
        data=json.dumps({"query": OPERATIONS_SQL, "parameters": [start.isoformat(), end.isoformat()]}).encode(),
        headers={"Authorization": "Bearer " + access_token(), "Content-Type": "application/json"})
    with urlopen(request, timeout=30) as response:
        payload = json.load(response)
    if not isinstance(payload, list) or len(payload) != 1:
        raise ValueError("Resposta operacional agregada invalida.")
    row = payload[0]
    created = int(row["reservations_created"])
    identified = int(row["created_with_ga_identifiers"])
    statuses = row["current_status_counts"]
    if isinstance(statuses, str):
        statuses = json.loads(statuses)
    if not isinstance(statuses, dict) or not set(statuses) <= STATUSES:
        raise ValueError("Status operacional inesperado.")
    statuses = {name: int(value) for name, value in statuses.items()}
    if not 0 <= identified <= created or any(value < 0 for value in statuses.values()) or sum(statuses.values()) != created:
        raise ValueError("Totais operacionais agregados inconsistentes.")
    return {"source": "public_site", "cohort_time_zone": "America/Fortaleza",
            "cohort_date_field": "created_at", "reservations_created": created,
            "created_with_ga_identifiers": identified, "current_status_counts": statuses}


def collect_report(start, end, alpha, beta, include_operations=True):
    notes = [
        "Funil fechado de usuarios GA4 em sequencia; permite eventos intermediarios. Nao exige a mesma sessao ou a mesma reserva.",
        "Cada etapa exige o parametro de evento form_kind=standard; nao inclui o funil do Reveillon.",
        "A contagem isolada de reservation_confirmed inclui o legado sem form_kind; esse evento ja era exclusivo da reserva comum.",
        "Contagens por evento nao sao um funil; usuarios por recorte nao sao somaveis.",
        "A API limita cada recorte do funil a 15 valores; o total reservado e mostrado separadamente.",
        "GA4 e banco sao contagens paralelas com cobertura parcial; nao e auditoria individual nem prova de igualdade.",
        "Status operacionais sao os atuais da coorte criada no periodo; nao sao eventos ocorridos nesse periodo.",
        "Ausencia de evento pode ser bloqueio da tag, identificador ausente, consolidacao ou abandono; nao comprova desistência.",
        "Nenhuma receita, taxa de comparecimento ou retorno financeiro e inferido deste relatorio.",
    ]
    if start < INSTRUMENTED_FROM:
        notes.append("As novas etapas comecaram em 22/10/2026; os dias anteriores nao possuem essa instrumentacao.")
    if end >= datetime.now(FORTALEZA).date() - timedelta(days=2):
        notes.append("A janela inclui dados recentes/parciais, sujeitos a consolidacao. Dimensoes novas podem levar 24-48 h.")
    metadata = read_stage("ga4_metadata", lambda: beta.get_metadata(name=PROPERTY_ID + "/metadata", retry=None, timeout=30))
    dimensions = {item.api_name for item in metadata.dimensions}
    report = {"property": PROPERTY_ID, "start": start.isoformat(), "end": end.isoformat(),
              "instrumented_from": INSTRUMENTED_FROM.isoformat(),
              "custom_dimensions_available": sorted(dimensions.intersection(CUSTOM_DIMENSIONS)),
              "notes": notes, "ga4_funnels": {}}
    report["ga4_event_counts"] = read_stage("ga4_event_counts", lambda: event_counts(beta, start, end))
    for label, breakdown in (("total", None), ("device", "deviceCategory"), ("session_source_medium", "sessionSourceMedium"),
                             ("cta_position", "customEvent:cta_position")):
        if breakdown in CUSTOM_DIMENSIONS and breakdown not in dimensions:
            report["ga4_funnels"][label] = {"available": False, "reason": "custom_dimension_pending"}
            continue
        try:
            response = alpha.run_funnel_report(funnel_request(start, end, breakdown), retry=None, timeout=30)
            report["ga4_funnels"][label] = {"available": True, **funnel_rows(response)}
        except InvalidArgument as error:
            if breakdown in CUSTOM_DIMENSIONS and pending_dimension(error):
                report["ga4_funnels"][label] = {"available": False, "reason": "custom_dimension_pending"}
            else:
                raise ReportReadError("ga4_funnel_" + label, type(error).__name__) from None
        except Exception as error:
            raise ReportReadError("ga4_funnel_" + label, type(error).__name__) from None
    if include_operations:
        report["operations_creation_cohort"] = read_stage("operations_creation_cohort", lambda: operations_report(start, end))
    zone = report["ga4_event_counts"]["ga4_time_zone"]
    if zone != "America/Fortaleza":
        notes.append("O fuso retornado pelo GA4 e " + zone + "; o banco usa Fortaleza. Conferir equivalencia das datas antes de comparar.")
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description="Funil de reserva comum GA4 + coorte operacional, somente agregados.")
    parser.add_argument("--start", "--start-date", dest="start", type=date.fromisoformat)
    parser.add_argument("--end", "--end-date", dest="end", type=date.fromisoformat)
    parser.add_argument("--days", type=int)
    parser.add_argument("--no-operations", action="store_true", help="Consulta apenas o GA4, sem banco.")
    args = parser.parse_args(argv)
    try:
        start, end = period(args.start, args.end, args.days)
    except ValueError as error:
        parser.error(str(error))
    try:
        credentials = service_account.Credentials.from_service_account_file(
            str(Path(__file__).with_name("service_account.json")),
            scopes=["https://www.googleapis.com/auth/analytics.readonly"])
        report = collect_report(start, end, AlphaAnalyticsDataClient(credentials=credentials),
                                BetaAnalyticsDataClient(credentials=credentials), not args.no_operations)
    except Exception as error:
        # A mensagem bruta de um SDK pode incluir payloads. Nunca imprimi-la.
        print(json.dumps({"error": "Consulta nao concluida; verificar acesso ou contrato da API.",
                          "stage": error.stage if isinstance(error, ReportReadError) else "initialize",
                          "error_type": error.cause_type if isinstance(error, ReportReadError) else type(error).__name__}, ensure_ascii=False))
        return 2
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
