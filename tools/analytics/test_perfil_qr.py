"""Contratos de escrita restrita e preservacao dos recortes/limites do perfil QR."""
import copy
import re
import unittest

import perfil_qr as qr


class Response:
    ok = True
    status_code = 200

    def __init__(self, body):
        self.body = body

    def json(self):
        return self.body


class Client:
    def __init__(self, audiences=None):
        self.audiences = list(audiences or [])
        self.rules = []
        self.calls = []

    def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        if url == qr.ADMIN + qr.PROPERTY:
            return Response({'name': qr.PROPERTY, 'displayName': 'Sir Fisher — Site Oficial'})
        if url == qr.ADMIN + qr.STREAM:
            return Response({'name': qr.STREAM, 'webStreamData': {'measurementId': 'G-F40Z5Y9QT6'}})
        if url.endswith('/eventCreateRules'):
            if method == 'GET':
                return Response({'eventCreateRules': self.rules})
            created = copy.deepcopy(kwargs['json'])
            created['name'] = qr.STREAM + '/eventCreateRules/456'
            self.rules.append(created)
            return Response(created)
        if '/eventCreateRules/456' in url:
            return Response(self.rules[-1])
        if url.endswith('/audiences'):
            if method == 'GET':
                return Response({'audiences': self.audiences})
            created = copy.deepcopy(kwargs['json'])
            created['name'] = qr.PROPERTY + '/audiences/123'
            self.audiences.append(created)
            return Response(created)
        if '/audiences/123' in url:
            return Response(self.audiences[-1])
        if url.endswith(':checkCompatibility'):
            body = kwargs['json']
            return Response({'dimensionCompatibilities': [
                {'dimensionMetadata': {'apiName': x['name']}, 'compatibility': 'COMPATIBLE'}
                for x in body['dimensions']], 'metricCompatibilities': [
                {'metricMetadata': {'apiName': x['name']}, 'compatibility': 'COMPATIBLE'}
                for x in body['metrics']]})
        if url.endswith(':runReport'):
            return Response({'rows': [], 'metadata': {'subjectToThresholding': True}})
        raise AssertionError((method, url))


class QRProfileTests(unittest.TestCase):
    def test_qr_event_rule_requires_public_host_and_both_real_query_parameters(self):
        rule = qr.event_rule_body()
        patterns = [c['value'] for c in rule['eventConditions'] if c['field'] == 'page_location']
        def matches(url):
            return all(re.fullmatch(pattern, url, re.I) for pattern in patterns)
        for url in [
            'https://www.sirfisher.com.br/?utm_source=qr_code&utm_medium=offline&utm_campaign=cardapio_restaurante',
            'https://sirfisher.com.br/?utm_medium=offline&utm_source=qr_code',
            'https://reservas.sirfisher.com.br/?utm_source=qr_code&utm_medium=offline#formulario',
        ]:
            self.assertTrue(matches(url), url)
        for url in [
            'https://admin.sirfisher.com.br/?utm_source=qr_code&utm_medium=offline',
            'https://www.sirfisher.com.br.evil.test/?utm_source=qr_code&utm_medium=offline',
            'https://www.sirfisher.com.br/?utm_source=qr_code_extra&utm_medium=offline',
            'https://www.sirfisher.com.br/?utm_source=qr_code#x&utm_medium=offline',
            'https://www.sirfisher.com.br/?utm_source=instagram&utm_medium=offline',
            'https://www.sirfisher.com.br/?utm_medium=offline#x?utm_source=qr_code',
        ]:
            self.assertFalse(matches(url), url)
        self.assertFalse(rule['sourceCopyParameters'])
        self.assertEqual(rule['eventConditions'][0], {'field': 'event_name', 'comparisonType': 'EQUALS', 'value': 'page_view'})

    def test_profile_setup_preview_and_retries_preserve_other_settings(self):
        client = Client()
        self.assertEqual(qr.configure_profile(client)['state'], 'preview')
        self.assertTrue(all(call[0] == 'GET' for call in client.calls))
        self.assertEqual(qr.configure_profile(client, True)['state'], 'configured_and_verified')
        qr.configure_profile(client, True)
        writes = [call for call in client.calls if call[0] != 'GET']
        self.assertEqual(len(writes), 2)
        self.assertTrue(writes[0][1].endswith('/eventCreateRules'))
        self.assertTrue(writes[1][1].endswith('/audiences'))
        self.assertNotIn('sessionSource', str(writes[1][2]['json']))

    def test_preview_does_not_write(self):
        client = Client()
        self.assertEqual(qr.configure(client)['state'], 'preview')
        self.assertTrue(all(call[0] == 'GET' for call in client.calls))

    def test_create_verified_and_retry_does_not_duplicate(self):
        client = Client()
        self.assertEqual(qr.configure(client, True)['state'], 'created_and_verified')
        self.assertEqual(qr.configure(client, True)['state'], 'already_exists')
        writes = [call for call in client.calls if call[0] != 'GET']
        self.assertEqual(len(writes), 1)
        self.assertEqual(writes[0][1], qr.ADMIN + qr.PROPERTY + '/audiences')
        self.assertNotIn('adsPersonalizationEnabled', writes[0][2]['json'])

    def test_divergent_or_duplicate_audience_is_preserved(self):
        changed = qr.audience_body()
        changed['membershipDurationDays'] = 30
        for audiences in [[changed], [qr.audience_body(), qr.audience_body()]]:
            client = Client(audiences)
            with self.assertRaises(RuntimeError):
                qr.configure(client, True)
            self.assertTrue(all(call[0] == 'GET' for call in client.calls))

    def test_protojson_false_omission_is_accepted(self):
        expected = qr.audience_body()
        self.assertTrue(qr.same_definition(qr.normalize(expected), expected))

    def test_wrong_property_blocks_writing(self):
        class WrongProperty(Client):
            def request(self, method, url, **kwargs):
                self.calls.append((method, url, kwargs))
                return Response({'name': 'properties/1', 'displayName': 'Outra empresa'})
        client = WrongProperty()
        with self.assertRaises(RuntimeError):
            qr.configure(client, True)
        self.assertEqual(len(client.calls), 1)

    def test_demographics_keep_audience_and_thresholds_without_traffic_fallback(self):
        audience = qr.audience_body(profile=True)
        audience['name'] = qr.PROPERTY + '/audiences/123'
        client = Client([audience])
        result = qr.profile(client, qr.date(2026, 11, 3), qr.date(2026, 11, 3))
        for dimension in qr.DEMOGRAPHICS:
            self.assertTrue(result['demographics'][dimension]['report']['metadata']['subjectToThresholding'])
            self.assertEqual(result['demographics'][dimension]['report']['rowCount'], 0)
        reports = [call[2]['json'] for call in client.calls if call[1].endswith(':runReport')]
        demographic_reports = [body for body in reports if body['dimensions'][0:1]
            and body['dimensions'][0]['name'] in qr.DEMOGRAPHICS]
        self.assertEqual(len(demographic_reports), 3)
        for body in demographic_reports:
            self.assertEqual(body['dimensionFilter'], qr.string_filter('audienceName', qr.PROFILE_AUDIENCE))
            self.assertEqual(body['metrics'], [{'name': 'activeUsers'}])
        outcomes = reports[-1]
        self.assertEqual(outcomes['dimensionFilter']['filter']['fieldName'], 'eventName')


if __name__ == '__main__':
    unittest.main()
