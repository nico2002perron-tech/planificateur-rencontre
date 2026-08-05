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
REM CHEMIN COMPLET A DESSEIN : « timeout » tout court resout vers celui de
REM Windows depuis l'Explorateur, mais vers celui de Git (syntaxe POSIX,
REM incompatible) depuis un shell Git. Le raccourci du Bureau passe par le
REM premier ; un lancement depuis un terminal de developpement par le second.
"%SystemRoot%\System32\timeout.exe" /t 1 /nobreak >nul 2>&1
exit /b 0
