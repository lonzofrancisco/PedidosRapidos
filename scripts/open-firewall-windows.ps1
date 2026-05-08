# Abre los puertos 8080 (web) y 3000 (api) en el Firewall de Windows
# para que otros dispositivos en tu red local (celular, otra laptop)
# puedan acceder a Pedidos Rapidos.
#
# Uso:
#   1) Click derecho en este archivo -> "Ejecutar con PowerShell como administrador"
#   2) O bien, abre PowerShell como admin y corre:
#        Set-ExecutionPolicy -Scope Process Bypass -Force
#        .\scripts\open-firewall-windows.ps1
#
# Para revertir mas tarde:
#   Remove-NetFirewallRule -DisplayName 'PedidosRapidos*'

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "Este script necesita ejecutarse como administrador." -ForegroundColor Red
  exit 1
}

Write-Host "Creando reglas de firewall para Pedidos Rapidos..." -ForegroundColor Cyan

# Limpia reglas previas con el mismo nombre por si se corre dos veces
Get-NetFirewallRule -DisplayName 'PedidosRapidos*' -ErrorAction SilentlyContinue | Remove-NetFirewallRule

New-NetFirewallRule `
  -DisplayName 'PedidosRapidos Web (8080)' `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 8080 `
  -Action Allow `
  -Profile Private,Domain | Out-Null

New-NetFirewallRule `
  -DisplayName 'PedidosRapidos API (3000)' `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 3000 `
  -Action Allow `
  -Profile Private,Domain | Out-Null

Write-Host "OK. Puertos 8080 y 3000 abiertos para perfiles Private/Domain." -ForegroundColor Green
Write-Host ""
Write-Host "Tus IPs locales:" -ForegroundColor Cyan
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.PrefixOrigin -in 'Dhcp','Manual' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notlike '*Loopback*' -and $_.InterfaceAlias -notlike '*WSL*' -and $_.InterfaceAlias -notlike '*Docker*' -and $_.InterfaceAlias -notlike '*vEthernet*' } |
  Select-Object IPAddress, InterfaceAlias |
  Format-Table -AutoSize
Write-Host "Desde tu celular abre:  http://<IP>:8080" -ForegroundColor Yellow
