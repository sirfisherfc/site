"""Perfil QR agregado: publico administrativo e consultas compativeis de leitura."""
from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path

PROPERTY = 'properties/353205396'
AUDIENCE = 'Visitantes pelo QR | 90 dias'
PROFILE_AUDIENCE = 'QR | perfil agregado | 90 dias'
QR_EVENT = 'qr_visit'
STREAM = PROPERTY + '/dataStreams/15405248385'
HOSTS = ['www.sirfisher.com.br', 'sirfisher.com.br', 'reservas.sirfisher.com.br']
ADMIN = 'https://analyticsadmin.googleapis.com/v1alpha/'
DATA = 'https://analyticsdata.googleapis.com/v1beta/'
FORTALEZA = timezone(timedelta(hours=-3))
DEMOGRAPHICS = ['userAgeBracket', 'userGender', 'brandingInterest']


def session(write=False):
    from google.auth.transport.requests import AuthorizedSession
    from google.oauth2 import service_account
    credentials = service_account.Credentials.from_service_account_file(
        str(Path(__file__).with_name('service_account.json')),
        scopes=['https://www.googleapis.com/auth/analytics.edit' if write
                else 'https://www.googleapis.com/auth/analytics.readonly'])
    return AuthorizedSession(credentials)


def request(client, method, url, **kwargs):
    response = client.request(method, url, timeout=45, **kwargs)
    if not response.ok:
        # Nao imprimir corpos de resposta, credenciais ou identificadores de usuarios.
        raise RuntimeError(f'Google recusou {method}: HTTP {response.status_code}.')
    return response.json()


def string_filter(field, value):
    return {'filter': {'fieldName': field, 'stringFilter': {
        'matchType': 'EXACT', 'value': value, 'caseSensitive': False}}}


def qr_filter():
    return {'andGroup': {'expressions': [
        {'filter': {'fieldName': 'hostName', 'inListFilter': {'values': HOSTS, 'caseSensitive': False}}},
        string_filter('sessionSource', 'qr_code'),
        string_filter('sessionMedium', 'offline'),
    ]}}


def audience_body(profile=False):
    if profile:
        return {'displayName': PROFILE_AUDIENCE,
                'description': 'Perfil agregado de visitantes com evento qr_visit; cobertura desde a criacao.',
                'membershipDurationDays': 90,
                'filterClauses': [{'clauseType': 'INCLUDE', 'simpleFilter': {
                    'scope': 'AUDIENCE_FILTER_SCOPE_ACROSS_ALL_SESSIONS',
                    'filterExpression': {'andGroup': {'filterExpressions': [
                        {'orGroup': {'filterExpressions': [{'eventFilter': {'eventName': QR_EVENT}}]}}
                    ]}}
                }}]}
    def clause(field, value=None):
        condition = {'fieldName': field, 'atAnyPointInTime': True}
        if value is None:
            condition['inListFilter'] = {'values': HOSTS, 'caseSensitive': False}
        else:
            condition['stringFilter'] = {'matchType': 'EXACT', 'value': value, 'caseSensitive': False}
        return {'orGroup': {'filterExpressions': [{'dimensionOrMetricFilter': condition}]}}
    return {
        'displayName': AUDIENCE,
        'description': 'Visitantes por QR nos hosts publicos; acesso nao comprova compra.',
        'membershipDurationDays': 90,
        'filterClauses': [{'clauseType': 'INCLUDE', 'simpleFilter': {
            'scope': 'AUDIENCE_FILTER_SCOPE_ACROSS_ALL_SESSIONS',
            'filterExpression': {'andGroup': {'filterExpressions': [
                clause('sessionSourceMedium', 'qr_code / offline'), clause('hostName')
            ]}}
        }}],
    }


def event_rule_body():
    return {'destinationEvent': QR_EVENT, 'sourceCopyParameters': False,
            'eventConditions': [
                {'field': 'event_name', 'comparisonType': 'EQUALS', 'value': 'page_view'},
                {'field': 'page_location', 'comparisonType': 'REGULAR_EXPRESSION_CASE_INSENSITIVE',
                 'value': r'^https://(www\.|reservas\.)?sirfisher\.com\.br/[^#]*[?&]utm_source=qr_code([&#].*)?$'},
                {'field': 'page_location', 'comparisonType': 'REGULAR_EXPRESSION_CASE_INSENSITIVE',
                 'value': r'^[^#]*[?&]utm_medium=offline([&#].*)?$'},
            ]}


def configure_profile(client, apply=False):
    stream = request(client, 'GET', ADMIN + STREAM)
    if stream.get('name') != STREAM or stream.get('webStreamData', {}).get('measurementId') != 'G-F40Z5Y9QT6':
        raise RuntimeError('Fluxo de destino divergente; nenhuma escrita.')
    rules = []
    token = None
    while True:
        data = request(client, 'GET', ADMIN + STREAM + '/eventCreateRules',
                       params={'pageToken': token} if token else {})
        rules.extend(data.get('eventCreateRules', []))
        token = data.get('nextPageToken')
        if not token:
            break
    matching_rules = [rule for rule in rules if rule.get('destinationEvent') == QR_EVENT]
    matching_audiences = [a for a in audience_list(client) if a.get('displayName') == PROFILE_AUDIENCE]
    rule_body = event_rule_body()
    profile_body = audience_body(profile=True)
    if len(matching_rules) > 1 or len(matching_audiences) > 1:
        raise RuntimeError('Regra ou publico de perfil duplicado; nenhuma escrita.')
    if matching_rules and any(normalize(matching_rules[0].get(k, False)) != normalize(v)
                              for k, v in rule_body.items()):
        raise RuntimeError('Regra QR existente divergente; preservar.')
    if matching_audiences and not same_definition(matching_audiences[0], profile_body):
        raise RuntimeError('Publico de perfil existente divergente; preservar.')
    if not apply:
        return {'state': 'preview', 'rule': matching_rules[0] if matching_rules else rule_body,
                'audience': matching_audiences[0] if matching_audiences else profile_body}
    for existing, body, parent in [(matching_rules, rule_body, STREAM + '/eventCreateRules'),
                                    (matching_audiences, profile_body, PROPERTY + '/audiences')]:
        if existing:
            continue
        created = request(client, 'POST', ADMIN + parent, json=body)
        if not created.get('name', '').startswith(parent + '/'):
            raise RuntimeError('Recurso criado divergente; conferir antes de repetir.')
        checked = request(client, 'GET', ADMIN + created['name'])
        if any(normalize(checked.get(k, False)) != normalize(v) for k, v in body.items()):
            raise RuntimeError('Releitura divergente; conferir antes de repetir.')
        existing.append(checked)
    return {'state': 'configured_and_verified', 'rule': matching_rules[0], 'audience': matching_audiences[0]}


def audience_list(client):
    audiences = []
    page_token = None
    while True:
        data = request(client, 'GET', ADMIN + PROPERTY + '/audiences',
                       params={'pageToken': page_token} if page_token else {})
        audiences.extend(data.get('audiences', []))
        page_token = data.get('nextPageToken')
        if not page_token:
            return audiences


def normalize(value):
    # ProtoJSON omite valores padrao false; preservar os demais campos.
    if isinstance(value, dict):
        return {k: normalize(v) for k, v in value.items() if v is not False}
    if isinstance(value, list):
        return [normalize(v) for v in value]
    return value


def same_definition(actual, expected):
    return all(normalize(actual.get(key)) == normalize(expected[key])
               for key in ['displayName', 'membershipDurationDays', 'filterClauses'])


def configure(client, apply=False):
    prop = request(client, 'GET', ADMIN + PROPERTY)
    if prop.get('name') != PROPERTY or 'Sir Fisher' not in prop.get('displayName', ''):
        raise RuntimeError('Propriedade de destino divergente; nenhuma escrita.')
    body = audience_body()
    matches = [item for item in audience_list(client) if item.get('displayName') == AUDIENCE]
    if len(matches) > 1:
        raise RuntimeError('Publico duplicado; nenhuma escrita.')
    if matches:
        if not same_definition(matches[0], body):
            raise RuntimeError('Publico existente tem outra definicao; preservar e revisar.')
        return {'state': 'already_exists', 'audience': matches[0]}
    if not apply:
        return {'state': 'preview', 'property': PROPERTY, 'audience': body}
    created = request(client, 'POST', ADMIN + PROPERTY + '/audiences', json=body)
    if not created.get('name', '').startswith(PROPERTY + '/audiences/'):
        raise RuntimeError('Nome criado divergente; conferir inventario antes de repetir.')
    checked = request(client, 'GET', ADMIN + created['name'])
    if not same_definition(checked, body):
        raise RuntimeError('Releitura divergente; conferir inventario antes de repetir.')
    return {'state': 'created_and_verified', 'audience': checked}


def report_body(start, end, dimensions, metrics, dimension_filter):
    return {'dateRanges': [{'startDate': start.isoformat(), 'endDate': end.isoformat()}],
            'dimensions': [{'name': name} for name in dimensions],
            'metrics': [{'name': name} for name in metrics],
            'dimensionFilter': dimension_filter, 'limit': '100'}


def aggregate(client, start, end, dimensions, metrics, dimension_filter):
    body = report_body(start, end, dimensions, metrics, dimension_filter)
    data = request(client, 'POST', DATA + PROPERTY + ':runReport', json=body)
    return {key: data.get(key, 0 if key == 'rowCount' else {} if key == 'metadata' else [])
            for key in ['dimensionHeaders', 'metricHeaders', 'rows', 'rowCount', 'metadata']}


def compatibility(client, dimensions, metrics, dimension_filter):
    data = request(client, 'POST', DATA + PROPERTY + ':checkCompatibility', json={
        'dimensions': [{'name': name} for name in dimensions],
        'metrics': [{'name': name} for name in metrics], 'dimensionFilter': dimension_filter})
    names = set(dimensions + metrics)
    return [{'name': item.get('dimensionMetadata', item.get('metricMetadata', {})).get('apiName'),
             'compatibility': item.get('compatibility')}
            for item in data.get('dimensionCompatibilities', []) + data.get('metricCompatibilities', [])
            if item.get('dimensionMetadata', item.get('metricMetadata', {})).get('apiName') in names]


def profile(client, start, end):
    cohorts = [item for item in audience_list(client) if item.get('displayName') == PROFILE_AUDIENCE]
    if len(cohorts) != 1 or not same_definition(cohorts[0], audience_body(profile=True)):
        raise RuntimeError('Publico QR ausente, duplicado ou divergente; configurar antes da consulta.')
    result = {'property': PROPERTY, 'checked_at': datetime.now(FORTALEZA).isoformat(),
              'period': {'start': start.isoformat(), 'end': end.isoformat()},
              'audience': {key: cohorts[0].get(key) for key in
                           ['name', 'displayName', 'createTime', 'membershipDurationDays', 'adsPersonalizationEnabled']},
              'coverage': {'traffic': 'Sessoes identificadas como QR nos hosts publicos.',
                           'demographics': 'Membros ativos do publico QR no periodo; podem voltar por outros canais. Historico anterior a criacao e limitado.',
                           'includes_recent_days': end >= datetime.now(FORTALEZA).date() - timedelta(days=2),
                           'privacy': 'Linhas omitidas ou unknown nao representam zero. Preservar metadata.subjectToThresholding.'}}
    result['qr_sessions'] = aggregate(client, start, end, [],
        ['sessions', 'totalUsers', 'engagedSessions', 'screenPageViews'], qr_filter())
    result['qr_session_events'] = aggregate(client, start, end, ['eventName'],
        ['eventCount', 'sessions'], {'andGroup': {'expressions': [qr_filter(),
            {'filter': {'fieldName': 'eventName', 'inListFilter': {'values': [
                'click_menu', 'cardapio_aberto', 'cardapio_detalhe_aberto',
                'click_reservation', 'reservation_confirmed', 'visit_realized']}}}]}})
    # Nao combinar dimensoes demograficas com sessionSource/sessionMedium/campaign.
    # Nao substituir silenciosamente este publico por todos os visitantes.
    cohort_filter = string_filter('audienceName', PROFILE_AUDIENCE)
    result['demographics'] = {}
    for dimension in DEMOGRAPHICS:
        status = compatibility(client, [dimension], ['activeUsers'], cohort_filter)
        if not status or any(item['compatibility'] != 'COMPATIBLE' for item in status):
            result['demographics'][dimension] = {'state': 'incompatible', 'compatibility': status}
        else:
            result['demographics'][dimension] = {'state': 'queried', 'compatibility': status,
                'report': aggregate(client, start, end, [dimension], ['activeUsers'], cohort_filter)}
    result['property_outcomes'] = aggregate(client, start, end, ['eventName'], ['eventCount', 'totalUsers'],
        {'filter': {'fieldName': 'eventName', 'inListFilter': {
            'values': ['reservation_confirmed', 'visit_realized']}}})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['configurar', 'preparar-perfil', 'relatorio'])
    parser.add_argument('--aplicar', action='store_true', help='Aplicar somente os publicos/regra QR fixos que ainda faltarem.')
    parser.add_argument('--start', type=date.fromisoformat)
    parser.add_argument('--end', type=date.fromisoformat)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    if args.aplicar and args.mode not in ['configurar', 'preparar-perfil']:
        parser.error('--aplicar somente com configurar ou preparar-perfil.')
    if args.mode == 'configurar':
        result = configure(session(write=args.aplicar), apply=args.aplicar)
    elif args.mode == 'preparar-perfil':
        result = configure_profile(session(write=args.aplicar), apply=args.aplicar)
    else:
        today = datetime.now(FORTALEZA).date()
        end = args.end or today - timedelta(days=3)
        start = args.start or end - timedelta(days=13)
        if not 0 <= (end - start).days <= 365 or end > today:
            parser.error('Periodo deve ter 1 a 366 dias e terminar ate hoje em Fortaleza.')
        result = profile(session(), start, end)
    rendered = json.dumps(result, ensure_ascii=True, indent=2)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(rendered + '\n', encoding='utf-8')
    print(rendered)


if __name__ == '__main__':
    try:
        main()
    except RuntimeError as error:
        raise SystemExit(str(error)) from None
