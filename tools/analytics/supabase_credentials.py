"""Acesso local ao portal, sem imprimir nem versionar a credencial."""
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

PORTAL_REF = "lucpxoynpvogkvzepagi"


def access_token():
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if token:
        return token
    # Caminho relativo ao workspace: funciona nos dois PCs pelo OneDrive.
    credential = Path(__file__).resolve().parents[3] / "reservas/.env.local"
    if credential.is_file():
        for line in credential.read_text(encoding="utf-8-sig").splitlines():
            if line.startswith("SUPABASE_ACCESS_TOKEN="):
                token = line.split("=", 1)[1].strip().strip("\"'")
                if token:
                    return token
    raise RuntimeError("Credencial privada ausente em reservas/.env.local ou no ambiente.")


def verify_portal():
    request = Request("https://api.supabase.com/v1/projects", headers={"Authorization": "Bearer " + access_token()})
    with urlopen(request, timeout=20) as response:
        projects = json.load(response)
    if not any(p.get("id") == PORTAL_REF for p in projects):
        raise RuntimeError("A credencial nao tem acesso ao portal esperado.")


if __name__ == "__main__":
    try:
        verify_portal()
    except Exception:
        raise SystemExit("Acesso ao portal nao confirmado; verificar a credencial privada sem exibi-la.")
    print("Credencial carregada com seguranca; acesso ao Supabase portal confirmado.")
