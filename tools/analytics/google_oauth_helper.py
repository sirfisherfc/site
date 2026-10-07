#!/usr/bin/env python3
"""Verifica o OAuth persistente do Perfil Google ou gera uma URL de consentimento.

Use --verificar primeiro para reutilizar a autorizacao salva em gestao.

Defina localmente GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_REDIRECT_URI antes de
executar. O segredo OAuth nunca e necessario para gerar a URL de autorizacao e
nao deve ser incluido em arquivos versionados.
"""

from __future__ import annotations

import argparse
import importlib.util
import os
from pathlib import Path
import urllib.error
from urllib.parse import urlencode


AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
SCOPES = (
    "https://www.googleapis.com/auth/business.manage",
)


def configuracao_local() -> tuple[str, str]:
    client_id = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "").strip()
    redirect_uri = os.environ.get("GOOGLE_OAUTH_REDIRECT_URI", "").strip()
    if not client_id or not redirect_uri:
        raise SystemExit(
            "Defina GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_REDIRECT_URI no ambiente local."
        )
    return client_id, redirect_uri


def main() -> int:
    parser = argparse.ArgumentParser(description="OAuth do Perfil Google: verificar acesso salvo ou gerar URL de consentimento.")
    parser.add_argument("--verificar", action="store_true", help="Testar a renovacao automatica ja configurada no projeto gestao, sem mostrar tokens.")
    args = parser.parse_args()
    if args.verificar:
        modulo = Path(__file__).resolve().parents[3] / "gestao" / "scripts" / "gbp" / "gbp.py"
        if not modulo.exists():
            raise SystemExit("A rotina gestao/scripts/gbp/gbp.py nao esta neste workspace.")
        spec = importlib.util.spec_from_file_location("sirfisher_gbp", modulo)
        gbp = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(gbp)
        try:
            ficha = gbp.ler_local()
        except urllib.error.HTTPError as erro:
            raise SystemExit(f"Renovacao OAuth recusada pelo Google (HTTP {erro.code}).") from None
        except gbp.ErroApi as erro:
            raise SystemExit(f"Leitura do Perfil Google recusada (HTTP {erro.status}).") from None
        print(f"Renovacao automatica OK; ficha: {ficha.get('title', 'Sir Fisher')}.")
        return 0
    client_id, redirect_uri = configuracao_local()
    parametros = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "access_type": "offline",
            "prompt": "consent",
            "scope": " ".join(SCOPES),
        }
    )
    print(f"{AUTHORIZATION_ENDPOINT}?{parametros}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
