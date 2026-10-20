import os
import json
import urllib.request
import urllib.parse

def create_ad_with_token(token):
    ad_acc = 'act_1004410887092327'
    page_id = '107690041045934'
    ig_user_id = '17841439937145607'
    adset_id = '120253920080870120'

    ads_data = [
        {
            'name': 'AD01 - Foto Almoço Executivo',
            'hash': 'ae8299d1109fedc839005c6fce9175b0',
            'title': 'Almoço Executivo na Beira-Mar',
            'body': 'Pratos executivos completos com entrada, prato principal e vista para a orla de Fortaleza. De terça a sexta, das 12h às 16h. Reserve sua mesa.',
            'url': 'https://www.sirfisher.com.br/?utm_source=meta&utm_medium=paid&utm_campaign=almoco_executivo&utm_content=ad01_almoco#reservas'
        },
        {
            'name': 'AD02 - Foto Camarão Alho e Óleo',
            'hash': 'cf8ff3f26fff3ce95ddfe83d5a00b408',
            'title': 'Camarão na Beira-Mar de Fortaleza',
            'body': 'Camarão alho e óleo servido fresco de frente para o mar. O melhor da gastronomia cearense na Av. Beira Mar, 3421. Venha conferir.',
            'url': 'https://www.sirfisher.com.br/?utm_source=meta&utm_medium=paid&utm_campaign=almoco_executivo&utm_content=ad02_camarao#reservas'
        },
        {
            'name': 'AD03 - Foto Filé Mignon',
            'hash': '3f5681cc1f267064161d9485265931d7',
            'title': 'Almoço Premium com Vista Pro Mar',
            'body': 'Cortes nobres, ambiente climatizado e ao ar livre na melhor localização da Beira-Mar. Garanta sua experiência no Sir Fisher.',
            'url': 'https://www.sirfisher.com.br/?utm_source=meta&utm_medium=paid&utm_campaign=almoco_executivo&utm_content=ad03_file#reservas'
        }
    ]

    for item in ads_data:
        print(f"\n--- Criando criativo: {item['name']} ---")
        c_url = f'https://graph.facebook.com/v20.0/{ad_acc}/adcreatives'
        asset_feed_spec = {
            'images': [{'hash': item['hash']}],
            'bodies': [{'text': item['body']}],
            'titles': [{'text': item['title']}],
            'link_urls': [{'website_url': item['url']}],
            'call_to_action_types': ['LEARN_MORE'],
            'ad_formats': ['SINGLE_IMAGE']
        }
        c_data = urllib.parse.urlencode({
            'name': item['name'],
            'object_story_spec': json.dumps({
                'page_id': page_id,
                'instagram_user_id': ig_user_id
            }),
            'asset_feed_spec': json.dumps(asset_feed_spec),
            'access_token': token
        }).encode('utf-8')

        try:
            with urllib.request.urlopen(urllib.request.Request(c_url, data=c_data)) as r:
                res = json.loads(r.read().decode())
                creative_id = res['id']
                print(f"Creative criado: {creative_id}")
        except Exception as e:
            err_msg = e.read().decode() if hasattr(e, 'read') else str(e)
            print(f"Erro ao criar criativo {item['name']}: {err_msg}")
            continue

        # Criar o anúncio
        ad_url = f'https://graph.facebook.com/v20.0/{ad_acc}/ads'
        ad_params = urllib.parse.urlencode({
            'name': item['name'],
            'adset_id': adset_id,
            'creative': json.dumps({'creative_id': creative_id}),
            'status': 'PAUSED',
            'access_token': token
        }).encode('utf-8')

        try:
            with urllib.request.urlopen(urllib.request.Request(ad_url, data=ad_params)) as r:
                ad_res = json.loads(r.read().decode())
                print(f"Anúncio criado com sucesso: {ad_res['id']}")
        except Exception as e:
            err_msg = e.read().decode() if hasattr(e, 'read') else str(e)
            print(f"Erro ao criar anúncio {item['name']}: {err_msg}")

if __name__ == '__main__':
    token = os.environ.get('META_ADS_TOKEN')
    if not token:
        raise SystemExit('Defina META_ADS_TOKEN no ambiente privado antes de executar.')
    create_ad_with_token(token)
