# Salva a chave do Gemini (Google AI Studio) como variável de ambiente do usuário.
# A chave não aparece na tela nem vai para nenhum arquivo do repositório.
# Uso: powershell -ExecutionPolicy Bypass -File configurar-chave.ps1

$segura = Read-Host "Cole a chave do Gemini (não vai aparecer na tela)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
try {
    $chave = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim()
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}
if (-not $chave) { Write-Host "Nenhuma chave informada."; exit 1 }

[Environment]::SetEnvironmentVariable("GEMINI_API_KEY", $chave, "User")
Write-Host "Chave salva. Feche e abra o VS Code para ele enxergar a GEMINI_API_KEY."
