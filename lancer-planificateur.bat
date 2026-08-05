@echo off
setlocal EnableDelayedExpansion

REM ===========================================================================
REM  Planificateur de rencontre - lanceur local
REM
REM  Demarre le serveur sur la BRANCHE COURANTE, telle quelle : aucun checkout,
REM  aucun git pull. Ce qui est sur le disque est ce qui tourne.
REM  Puis ouvre une fenetre d'application, sans barre d'adresse.
REM
REM  Si le serveur tourne deja, la fenetre se rouvre sans rien redemarrer.
REM ===========================================================================

cd /d "%~dp0"
set "PORT=3000"
set "URL=http://localhost:%PORT%"

echo.
echo   Planificateur de rencontre
echo   --------------------------

for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCHE=%%b"
if defined BRANCHE (echo   branche : !BRANCHE!) else (echo   branche : hors depot git)

REM Node absent doit se voir TOUT DE SUITE. Sans cette verification, la fenetre
REM du serveur s'ouvrait, mourait aussitot, et le lanceur attendait 90 secondes
REM avant d'afficher un diagnostic trompeur sur le port ou le .env.local.
where npm >nul 2>&1
if errorlevel 1 (
  echo.
  echo   [X] Node.js n'est pas installe, ou n'est pas dans le PATH.
  echo.
  echo       Installez-le depuis https://nodejs.org ^(version LTS^)
  echo       puis relancez ce raccourci.
  echo.
  pause
  exit /b 1
)

REM Les dependances : absentes, ou desynchronisees de package-lock.json -- ce
REM qui arrive apres un git pull qui touche les paquets. Dans les deux cas on
REM installe ici, plutot que de renvoyer l'usager au terminal : un double-clic
REM ne doit pas se transformer en session de depannage.
REM
REM On COMPARE LE CONTENU du verrou a la copie laissee par la derniere
REM installation reussie, plutot que des dates. Une comparaison de dates en
REM batch passe par "dir", qui liste le CONTENU d'un dossier au lieu du dossier
REM lui-meme : la premiere version de ce bloc reinstallait a chaque lancement.
set "TEMOIN=node_modules\.lanceur-verrou-copie"
set "INSTALLER="
if not exist "node_modules\" set "INSTALLER=1"
if not defined INSTALLER if not exist "%TEMOIN%" set "INSTALLER=1"
if not defined INSTALLER (
  fc /b "package-lock.json" "%TEMOIN%" >nul 2>&1
  if errorlevel 1 set "INSTALLER=1"
)

if defined INSTALLER (
  echo   dependances : installation en cours, quelques minutes...
  call npm install
  if errorlevel 1 (
    echo.
    echo   [X] L'installation des dependances a echoue.
    echo       Lisez le message ci-dessus : c'est presque toujours un probleme
    echo       de reseau ou de pare-feu.
    echo.
    pause
    exit /b 1
  )
  copy /y "package-lock.json" "%TEMOIN%" >nul 2>&1
  echo   dependances : installees
) else (
  echo   dependances : a jour
)

call :TESTER
if "!VIVANT!"=="1" (
  echo   serveur : deja demarre
  goto :OUVRIR
)

echo   serveur : demarrage...
start "Planificateur - serveur" /min cmd /c "npm run dev"

set /a N=0
:ATTENDRE
set /a N+=1
if !N! gtr 90 (
  echo.
  echo   [X] Le serveur n'a pas repondu apres 90 secondes.
  echo.
  echo       Regardez la fenetre du serveur : le message d'erreur s'y trouve.
  echo       Causes frequentes : le port %PORT% est deja pris, ou une variable
  echo       manque dans .env.local
  echo.
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
call :TESTER
if not "!VIVANT!"=="1" goto :ATTENDRE
echo   serveur : pret en !N! s

:OUVRIR
set "NAV="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "NAV=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined NAV if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "NAV=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined NAV if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "NAV=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "NAV=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "NAV=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if defined NAV (
  echo   fenetre : mode application
  start "" "!NAV!" --app=%URL% --new-window
) else (
  echo   fenetre : navigateur par defaut
  start "" "%URL%"
)

echo.
echo   C'est parti. Cette fenetre peut etre fermee.
timeout /t 1 /nobreak >nul
exit /b 0

REM ---------------------------------------------------------------------------
REM  Le serveur repond-il ? VIVANT=1 si oui. PowerShell plutot que curl :
REM  present sur tout Windows. Une reponse HTTP, meme 3xx ou 4xx, prouve que le
REM  serveur est la - la page /login redirige, c'est normal et suffisant.
REM ---------------------------------------------------------------------------
:TESTER
set "VIVANT=0"
set "REP="
for /f "delims=" %%r in ('powershell -NoProfile -Command "try { $null = Invoke-WebRequest -Uri '%URL%/login' -UseBasicParsing -TimeoutSec 2; 'oui' } catch { if ($_.Exception.Response) { 'oui' } else { 'non' } }" 2^>nul') do set "REP=%%r"
if "!REP!"=="oui" set "VIVANT=1"
exit /b 0
