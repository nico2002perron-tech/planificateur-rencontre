@echo off
REM ===========================================================================
REM  Arrete le serveur local (port 3000).
REM  Utile quand la fenetre du serveur a ete fermee sans arreter le processus.
REM ===========================================================================
echo.
echo   Arret du serveur local...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue;" ^
 "if (-not $c) { Write-Host '   rien ne tournait sur le port 3000'; exit 0 }" ^
 "$c | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {" ^
 " try { Stop-Process -Id $_ -Force -ErrorAction Stop; Write-Host ('   processus ' + $_ + ' arrete') }" ^
 " catch { Write-Host ('   impossible d arreter le processus ' + $_) } }"

echo.
timeout /t 1 /nobreak >nul
exit /b 0
