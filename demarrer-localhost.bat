@echo off
title Planificateur - localhost
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo ERREUR : npm introuvable. Node.js absent ou pas dans le PATH.
  pause
  exit /b 1
)
echo ============================================================
echo   Serveur localhost - planificateur-rencontre
echo ============================================================
echo.
echo   LAISSE CETTE FENETRE OUVERTE (la fermer arrete le serveur).
echo   Quand tu vois "Ready", ouvre :  http://localhost:3000/reports
echo.
call npm run dev
echo.
echo Serveur arrete. Appuie sur une touche pour fermer.
pause >nul
