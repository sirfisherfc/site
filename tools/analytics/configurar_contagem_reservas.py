"""Confere a contagem do evento de reserva; escrita somente com --aplicar."""
import argparse
import json
from pathlib import Path
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession

PROPERTY = 'properties/353205396'
EVENT = 'reservation_confirmed'

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--aplicar', action='store_true')
    args=parser.parse_args()
    credentials=service_account.Credentials.from_service_account_file(
        str(Path(__file__).with_name('service_account.json')),
        scopes=['https://www.googleapis.com/auth/analytics.edit' if args.aplicar
                else 'https://www.googleapis.com/auth/analytics.readonly'])
    session=AuthorizedSession(credentials)
    base='https://analyticsadmin.googleapis.com/v1beta/'
    response=session.get(base+PROPERTY+'/keyEvents',timeout=30)
    response.raise_for_status()
    matches=[event for event in response.json().get('keyEvents',[]) if event.get('eventName')==EVENT]
    if len(matches)!=1: raise SystemExit('Evento ausente ou ambiguo; nenhuma escrita.')
    event=matches[0]
    expected='ONCE_PER_EVENT'
    print(json.dumps({'event':EVENT,'current':event.get('countingMethod'),'expected':expected}))
    if event.get('countingMethod')!=expected and args.aplicar:
        response=session.patch(base+event['name'],params={'updateMask':'countingMethod'},
            json={'name':event['name'],'countingMethod':expected},timeout=30)
        response.raise_for_status()
        check=session.get(base+event['name'],timeout=30)
        check.raise_for_status()
        if check.json().get('countingMethod')!=expected: raise SystemExit('Leitura posterior divergente.')
        print('Contagem por evento aplicada e relida; outros eventos preservados.')
    elif event.get('countingMethod')!=expected:
        print('Previa. Use --aplicar para contar cada reserva, com deduplicacao no navegador.')
    else: print('Contagem por evento confirmada.')

if __name__=='__main__': main()
