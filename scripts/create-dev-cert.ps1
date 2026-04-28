param(
  [string]$CertName = "localhost",
  [string]$OutputDir = "",
  [string]$Password = "zmp-local-dev"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = Join-Path $PSScriptRoot "..\certs"
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$cert = New-SelfSignedCertificate `
  -DnsName $CertName `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -FriendlyName "ZMP Local Dev HTTPS" `
  -NotAfter (Get-Date).AddYears(2) `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -HashAlgorithm SHA256

$securePassword = ConvertTo-SecureString -String $Password -Force -AsPlainText
$pfxPath = Join-Path $OutputDir "localhost-dev.pfx"
$cerPath = Join-Path $OutputDir "localhost-dev.cer"

Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePassword | Out-Null
Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null

Write-Host "Created:"
Write-Host "  $pfxPath"
Write-Host "  $cerPath"
Write-Host ""
Write-Host "If the browser warns about trust, import localhost-dev.cer into Trusted Root Certification Authorities for Current User."
