"""Instala o MCP oficial do Analytics e registra a conexao local no Codex."""

from pathlib import Path
import os
import re
import shutil
import subprocess
import sys
import tomllib


VERSION = "0.8.0"
SERVER_NAME = "google_analytics"


def configure_startup_timeout():
    """A primeira inicializacao importa o SDK Google e pode passar de 10 s."""
    config = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex")) / "config.toml"
    text = config.read_text(encoding="utf-8-sig")
    expected = tomllib.loads(text)
    expected["mcp_servers"][SERVER_NAME]["startup_timeout_sec"] = 90.0
    header = re.search(rf"(?m)^\[mcp_servers\.{SERVER_NAME}\][ \t]*$", text)
    if not header:
        raise SystemExit("Tabela MCP registrada nao encontrada; configuracao preservada.")
    next_header = re.search(r"(?m)^\[", text[header.end():])
    end = header.end() + next_header.start() if next_header else len(text)
    body = text[header.end():end]
    setting = r"(?m)^startup_timeout_sec[ \t]*=.*$"
    body = (re.sub(setting, "startup_timeout_sec = 90.0", body)
            if re.search(setting, body) else "\nstartup_timeout_sec = 90.0" + body)
    updated = text[:header.end()] + body + text[end:]
    if tomllib.loads(updated) != expected:
        raise SystemExit("Alteracao inesperada na configuracao; arquivo preservado.")
    config.write_text(updated, encoding="utf-8")


def main():
    credentials = Path(__file__).resolve().with_name("service_account.json")
    if not credentials.is_file():
        raise SystemExit("Credencial privada existente do Analytics nao encontrada.")
    local_app_data = os.environ.get("LOCALAPPDATA")
    if not local_app_data or os.name != "nt":
        raise SystemExit("Esta configuracao local requer Windows e LOCALAPPDATA.")
    codex = shutil.which("codex")
    if not codex:
        raise SystemExit("Codex CLI nao encontrado neste computador.")

    # Ambiente por computador: nao altera nem sincroniza o .venv dos relatorios.
    environment = Path(local_app_data) / "SirFisher" / "analytics-mcp" / VERSION
    python = environment / "Scripts" / "python.exe"
    if not python.is_file():
        subprocess.run([sys.executable, "-m", "venv", str(environment)], check=True)
    installed = subprocess.run(
        [str(python), "-c", "from importlib.metadata import version; print(version('analytics-mcp'))"],
        capture_output=True, text=True, check=False,
    )
    if installed.returncode or installed.stdout.strip() != VERSION:
        subprocess.run(
            [str(python), "-m", "pip", "install", "--disable-pip-version-check",
             f"analytics-mcp=={VERSION}"],
            check=True,
        )
    subprocess.run([str(python), "-m", "pip", "check"], check=True)

    # Somente o caminho privado entra na configuracao. A chave nao e copiada.
    # Sem --allow-write, o servidor solicita analytics.readonly.
    subprocess.run(
        [codex, "mcp", "add", SERVER_NAME,
         "--env", f"GOOGLE_APPLICATION_CREDENTIALS={credentials}",
         "--", str(python), "-m", "analytics_mcp.server"],
        check=True,
    )
    configure_startup_timeout()
    print(f"MCP Analytics {VERSION} registrado para consultas neste computador.")
    print("A configuracao persiste; reinicie o cliente uma vez para carregar o novo servidor.")
    print("O acesso ao Google sera comprovado na primeira consulta, sem novo login.")


if __name__ == "__main__":
    main()
