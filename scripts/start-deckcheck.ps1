$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker não foi encontrado. Instale e inicie o Docker Desktop antes de tentar novamente."
}

if (-not (Test-Path ".env")) {
    $passwordBytes = New-Object byte[] 10
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($passwordBytes)
    $generatedPassword = [Convert]::ToHexString($passwordBytes).ToLowerInvariant()
    $environment = "DECKCHECK_APP_PASSWORD=$generatedPassword`nDECKCHECK_SECURE_COOKIES=false`n"
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) ".env"), $environment)

    Write-Host "Senha criada: $generatedPassword" -ForegroundColor Green
    Write-Host "Guarde-a para entrar pelo computador e pelo iPad."
}

docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
    throw "O Docker não conseguiu iniciar a aplicação."
}

# Recarrega o DNS dos serviços quando API ou frontend foram recriados.
docker compose restart proxy
if ($LASTEXITCODE -ne 0) {
    throw "O Docker não conseguiu reiniciar o proxy."
}

Write-Host ""
Write-Host "TCG Deck Check está iniciando em http://localhost:8080" -ForegroundColor Green
Write-Host "Mantenha o computador ligado e abra o endereço do seu túnel no celular ou iPad."
