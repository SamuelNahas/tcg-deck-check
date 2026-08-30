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

Write-Host ""
Write-Host "TCG Deck Check está iniciando em http://localhost:8080" -ForegroundColor Green
Write-Host "Para o iPad, conecte computador e iPad ao Tailscale e abra o endereço privado deste computador na porta 8080."
