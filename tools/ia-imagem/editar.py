"""Edita uma foto com o Gemini (Google AI Studio).

Uso:
    python editar.py FOTO "instrução" [--saida arquivo.png] [--modelo nome]
    python editar.py --modelos            # lista os modelos de imagem da conta

A chave vem da variável de ambiente GEMINI_API_KEY (configure com
configurar-chave.ps1). O resultado vai para site/_materiais/midia/output/ia/
por padrão, para ser aprovado antes de ir para o site.
"""
import argparse
import base64
import datetime
import json
import mimetypes
import os
import pathlib
import sys
import urllib.error
import urllib.request

API = "https://generativelanguage.googleapis.com/v1beta"
SAIDA_PADRAO = pathlib.Path(__file__).resolve().parents[2] / "_materiais" / "midia" / "output" / "ia"


def chave():
    k = os.environ.get("GEMINI_API_KEY")
    if not k:
        sys.exit("GEMINI_API_KEY não definida. Rode configurar-chave.ps1 e reabra o terminal.")
    return k


def chamar(url, corpo=None):
    req = urllib.request.Request(url, method="POST" if corpo else "GET",
                                 headers={"Content-Type": "application/json", "x-goog-api-key": chave()},
                                 data=json.dumps(corpo).encode() if corpo else None)
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"Erro {e.code} da API: {e.read().decode(errors='replace')[:800]}")


def modelos_de_imagem():
    nomes, token = [], ""
    while True:
        r = chamar(f"{API}/models?pageSize=200" + (f"&pageToken={token}" if token else ""))
        for m in r.get("models", []):
            if "generateContent" in m.get("supportedGenerationMethods", []) and "image" in m["name"] \
                    and "imagen" not in m["name"]:
                nomes.append(m["name"].removeprefix("models/"))
        token = r.get("nextPageToken")
        if not token:
            return nomes


def escolher_modelo():
    nomes = modelos_de_imagem()
    if not nomes:
        sys.exit("Nenhum modelo de edição de imagem disponível para esta chave.")
    estaveis = [n for n in nomes if "preview" not in n and "exp" not in n] or nomes
    # prefere o Pro (melhor qualidade), depois a versão mais nova; evita o "lite"
    return max(estaveis, key=lambda n: ("pro" in n, "lite" not in n, n))


def editar(foto, instrucao, saida, modelo):
    foto = pathlib.Path(foto)
    mime = mimetypes.guess_type(foto.name)[0] or "image/jpeg"
    corpo = {
        "contents": [{"parts": [
            {"text": instrucao},
            {"inline_data": {"mime_type": mime, "data": base64.b64encode(foto.read_bytes()).decode()}},
        ]}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
    }
    r = chamar(f"{API}/models/{modelo}:generateContent", corpo)
    partes = (r.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
    imagens = [p for p in partes if "inlineData" in p or "inline_data" in p]
    for p in partes:
        if "text" in p:
            print("Modelo:", p["text"].strip())
    if not imagens:
        sys.exit("A API não devolveu imagem. Resposta: " + json.dumps(r)[:800])
    dado = imagens[0].get("inlineData") or imagens[0]["inline_data"]
    ext = mimetypes.guess_extension(dado.get("mimeType") or dado.get("mime_type") or "image/png") or ".png"
    if saida is None:
        SAIDA_PADRAO.mkdir(parents=True, exist_ok=True)
        saida = SAIDA_PADRAO / f"{foto.stem}-ia-{datetime.datetime.now():%Y%m%d-%H%M%S}{ext}"
    saida = pathlib.Path(saida)
    saida.write_bytes(base64.b64decode(dado["data"]))
    print(f"Salvo em {saida} (modelo {modelo})")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("foto", nargs="?")
    ap.add_argument("instrucao", nargs="?")
    ap.add_argument("--saida")
    ap.add_argument("--modelo")
    ap.add_argument("--modelos", action="store_true")
    a = ap.parse_args()
    if a.modelos:
        print("\n".join(modelos_de_imagem()) or "(nenhum)")
    elif a.foto and a.instrucao:
        editar(a.foto, a.instrucao, a.saida, a.modelo or escolher_modelo())
    else:
        ap.print_help()
