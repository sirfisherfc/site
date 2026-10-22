"""Testes offline: requests reais dos SDKs, coorte SQL e resposta agregada.

A fixture SQL usa SQLite em memoria; somente casts de datas/fuso e nomes JSON
do Postgres sao adaptados. A validacao real no portal continua sendo leitura.
"""
from datetime import date, datetime, timedelta, timezone
from io import BytesIO
import json
from pathlib import Path
import socket
import sqlite3
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import reservation_funnel_report as report
from google.analytics.data_v1alpha.types import RunFunnelReportRequest, RunFunnelReportResponse
from google.analytics.data_v1beta.types import RunReportRequest, RunReportResponse
from google.api_core.exceptions import InvalidArgument


def count_response(standard=True):
    dimensions = [{"name": "eventName"}] + ([{"name": "customEvent:form_kind"}] if standard else [])
    return RunReportResponse(dimension_headers=dimensions,
        metric_headers=[{"name": "eventCount"}, {"name": "totalUsers"}],
        metadata={"time_zone": "America/Fortaleza"},
        rows=[{"dimension_values": [{"value": name}] + ([{"value": "standard"}] if standard else []),
               "metric_values": [{"value": str(events)}, {"value": str(users)}]}
              for name, events, users in (("reservation_form_view", 8, 5), ("reservation_confirmed", 3, 2))])


def funnel_response():
    return RunFunnelReportResponse(funnel_table={
        "dimension_headers": [{"name": "funnelStepName"}, {"name": "deviceCategory"}],
        "metric_headers": [{"name": "activeUsers"}, {"name": "funnelStepCompletionRate"}],
        "rows": [{"dimension_values": [{"value": "1. reservation_form_view"}, {"value": device}],
                  "metric_values": [{"value": str(users)}, {"value": "0.5"}]}
                 for device, users in (("RESERVED_TOTAL", 5), ("mobile", 4), ("desktop", 2))],
        "metadata": {"sampling_metadatas": [{"samples_read_count": 50, "sampling_space_size": 100}]},
    })


class OfflineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.no_network = patch.object(socket.socket, "connect", side_effect=AssertionError("Rede proibida no teste"))
        cls.no_network.start()

    @classmethod
    def tearDownClass(cls):
        cls.no_network.stop()

    def test_period_uses_fortaleza_day_with_consolidation_margin(self):
        now = datetime(2026, 10, 23, 1, 30, tzinfo=timezone.utc)  # Ainda dia 22 em Fortaleza.
        self.assertEqual(report.period(now=now), (date(2026, 10, 13), date(2026, 10, 19)))
        self.assertEqual(report.period(end=date(2026, 10, 22), days=1, now=now), (date(2026, 10, 22), date(2026, 10, 22)))

    def test_period_rejects_future_reversed_overlong_and_ambiguous_inputs(self):
        now = datetime(2026, 10, 22, 12, tzinfo=report.FORTALEZA)
        for args in ({"days": 0}, {"days": 367}, {"end": date(2026, 10, 23)},
                     {"start": date(2026, 10, 22), "end": date(2026, 10, 21)},
                     {"start": date(2025, 1, 1), "end": date(2026, 10, 22)},
                     {"start": date(2026, 10, 21), "days": 2}):
            with self.subTest(args=args), self.assertRaises(ValueError):
                report.period(now=now, **args)

    def test_funnel_is_closed_ordered_and_excludes_reveillon_by_raw_event_parameter(self):
        request = report.funnel_request(date(2026, 10, 22), date(2026, 10, 22), "deviceCategory")
        serialized = RunFunnelReportRequest.to_dict(request)
        self.assertEqual(request.property, "properties/353205396")
        self.assertFalse(request.funnel.is_open_funnel)
        self.assertEqual([step.name for step in request.funnel.steps], list(report.STEPS))
        for step in serialized["funnel"]["steps"]:
            event = step["filter_expression"]["funnel_event_filter"]
            self.assertEqual(event["event_name"], step["name"])
            parameter = event["funnel_parameter_filter_expression"]["funnel_parameter_filter"]
            self.assertEqual(parameter["event_parameter_name"], "form_kind")
            self.assertEqual(parameter["string_filter"]["value"], "standard")
            self.assertNotIn("customEvent", str(parameter))
        self.assertEqual(request.funnel_breakdown.breakdown_dimension.name, "deviceCategory")
        self.assertGreater(request.funnel_breakdown.limit, 0)
        self.assertLessEqual(request.funnel_breakdown.limit, 15)

    def test_funnel_keeps_reserved_total_separate_from_device_rows_and_sampling(self):
        parsed = report.funnel_rows(funnel_response())
        self.assertEqual([row["activeUsers"] for row in parsed["rows"]], [5, 4, 2])
        self.assertEqual(parsed["sampling"], [{"samples_read": 50, "sampling_space": 100}])
        # 4 + 2 nao deve substituir o total direto de cinco usuarios.
        self.assertEqual(parsed["rows"][0]["deviceCategory"], "RESERVED_TOTAL")
        self.assertEqual(parsed["observed_total_by_step"]["reservation_form_view"], 5)

    def test_empty_new_funnel_is_zero_observed_without_error_or_retroactive_inference(self):
        parsed = report.funnel_rows(RunFunnelReportResponse())
        self.assertEqual(parsed["observed_total_by_step"], dict.fromkeys(report.STEPS, 0))
        self.assertEqual(parsed["rows"], [])

    def test_safe_error_context_does_not_include_provider_payload(self):
        def fail():
            raise InvalidArgument("provider message with private fixture payload")
        with self.assertRaises(report.ReportReadError) as caught:
            report.read_stage("ga4_funnel_total", fail)
        self.assertEqual(caught.exception.stage, "ga4_funnel_total")
        self.assertEqual(caught.exception.cause_type, "InvalidArgument")
        self.assertNotIn("private", str(caught.exception))

    def test_counts_retain_legacy_standard_confirmations_without_new_dimension(self):
        requests = []
        beta = SimpleNamespace(run_report=lambda request, **kwargs: (requests.append(request) or count_response(False)))
        result = report.event_counts(beta, date(2026, 10, 22), date(2026, 10, 22))
        self.assertEqual([row["eventName"] for row in result["rows"]], ["reservation_form_view", "reservation_confirmed"])
        self.assertEqual(result["rows"][0]["eventCount"], 8)
        self.assertEqual(result["rows"][0]["totalUsers"], 5)
        self.assertEqual(result["scope"], "standard_reservations_including_legacy_confirmations")
        self.assertNotIn("customEvent:", str(requests[0]))

    def test_counts_use_one_request_and_do_not_sum_users_from_different_steps(self):
        requests = []
        def run(request, **kwargs):
            requests.append(request)
            return count_response(False)
        result = report.event_counts(SimpleNamespace(run_report=run), date(2026, 10, 22), date(2026, 10, 22))
        self.assertEqual(len(requests), 1)
        self.assertEqual([row["totalUsers"] for row in result["rows"]], [5, 2])

    def test_counts_filter_only_known_standard_event_names(self):
        requests = []
        beta = SimpleNamespace(run_report=lambda request, **kwargs: (requests.append(request) or count_response()))
        result = report.event_counts(beta, date(2026, 10, 22), date(2026, 10, 22))
        request = RunReportRequest.to_dict(requests[0])
        filters = request["dimension_filter"]["and_group"]["expressions"]
        self.assertEqual(len(filters), 1)
        self.assertEqual(filters[0]["filter"]["field_name"], "eventName")
        self.assertEqual(filters[0]["filter"]["in_list_filter"]["values"], [*report.STEPS, *report.DIAGNOSTICS])
        self.assertEqual(result["rows"][1]["eventName"], "reservation_confirmed")

    def test_sql_creation_cohort_handles_fortaleza_midnight_source_empty_ids_and_current_status(self):
        # Executa a agregacao real; adapta somente dialeto de fuso/cast/JSON.
        connection = sqlite3.connect(":memory:")
        connection.execute("attach database ':memory:' as public")
        connection.execute("create table public.reservations (created_at text, source text, status text, ga_client_id text, ga_session_id text)")
        connection.executemany("insert into public.reservations values (?, ?, ?, ?, ?)", [
            ("2026-10-22T02:59:59+00:00", "public_site", "confirmada", "a", "1"),
            ("2026-10-22T03:00:00+00:00", "public_site", "compareceu", "a", "1"),
            ("2026-10-23T02:59:59+00:00", "public_site", "cancelada_cliente", " ", "2"),
            ("2026-10-23T03:00:00+00:00", "public_site", "confirmada", "b", "3"),
            ("2026-10-22T12:00:00+00:00", "admin", "confirmada", "c", "4"),
        ])
        def boundary(value, days=0):
            local = datetime.combine(date.fromisoformat(value) + timedelta(days=days), datetime.min.time(), report.FORTALEZA)
            return local.astimezone(timezone.utc).isoformat()
        connection.create_function("fortaleza_start", 1, boundary)
        connection.create_function("fortaleza_after", 1, lambda value: boundary(value, 1))
        connection.create_function("btrim", 1, lambda value: value.strip() if value is not None else None)
        sql = report.OPERATIONS_SQL.replace("($1::date::timestamp at time zone 'America/Fortaleza')", "fortaleza_start($1)")
        sql = sql.replace("(($2::date + 1)::timestamp at time zone 'America/Fortaleza')", "fortaleza_after($2)")
        sql = sql.replace("'{}'::jsonb", "'{}'").replace("jsonb_object_agg", "json_group_object")
        total, identified, statuses = connection.execute(sql, {"1": "2026-10-22", "2": "2026-10-22"}).fetchone()
        self.assertEqual((total, identified), (2, 1))
        self.assertEqual(json.loads(statuses), {"compareceu": 1, "cancelada_cliente": 1})
        connection.close()

    def test_operations_http_contract_is_read_only_parameterized_and_aggregate(self):
        payload = [{"reservations_created": 3, "created_with_ga_identifiers": 2,
                    "current_status_counts": {"confirmada": 2, "compareceu": 1}, "unexpected_raw_data": "never print"}]
        with patch.object(report, "access_token", return_value="fixture-token"), \
             patch.object(report, "urlopen", return_value=BytesIO(json.dumps(payload).encode())) as opened:
            result = report.operations_report(date(2026, 10, 21), date(2026, 10, 22))
        request = opened.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.supabase.com/v1/projects/lucpxoynpvogkvzepagi/database/query/read-only")
        body = json.loads(request.data)
        self.assertEqual(body["parameters"], ["2026-10-21", "2026-10-22"])
        self.assertIn("from public.reservations", body["query"])
        self.assertNotIn("reservation_date", body["query"])
        self.assertNotIn("customer", body["query"])
        self.assertEqual(result["reservations_created"], 3)
        self.assertNotIn("unexpected_raw_data", result)
        self.assertNotIn("ga_client_id", result)

    def test_operations_rejects_inconsistent_aggregate_counts(self):
        payload = [{"reservations_created": 1, "created_with_ga_identifiers": 2, "current_status_counts": {"confirmada": 1}}]
        with patch.object(report, "access_token", return_value="fixture"), \
             patch.object(report, "urlopen", return_value=BytesIO(json.dumps(payload).encode())), self.assertRaises(ValueError):
            report.operations_report(date(2026, 10, 22), date(2026, 10, 22))

    def test_collect_optional_dimension_unready_does_not_block_report_or_mix_flows(self):
        requests = []
        def run_funnel(request, **kwargs):
            requests.append(request)
            if request.funnel_breakdown.breakdown_dimension.name.startswith("customEvent"):
                raise InvalidArgument("customEvent:cta_position is not yet ready")
            return funnel_response()
        alpha = SimpleNamespace(run_funnel_report=run_funnel)
        beta = SimpleNamespace(get_metadata=lambda **kwargs: SimpleNamespace(dimensions=[SimpleNamespace(api_name=name) for name in report.CUSTOM_DIMENSIONS]),
                               run_report=lambda *args, **kwargs: count_response())
        result = report.collect_report(date(2026, 10, 22), date(2026, 10, 22), alpha, beta, False)
        self.assertTrue(result["ga4_funnels"]["total"]["available"])
        self.assertFalse(result["ga4_funnels"]["cta_position"]["available"])
        self.assertNotIn("operations_creation_cohort", result)
        self.assertEqual(len(requests), 4)
        self.assertIn("contagens paralelas", " ".join(result["notes"]))


if __name__ == "__main__":
    unittest.main()
