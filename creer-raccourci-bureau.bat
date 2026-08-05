@echo off
REM ===========================================================================
REM  Cree le raccourci "Planificateur" sur le Bureau.
REM  A lancer UNE SEULE FOIS. Si le projet demenage, relancer ce script.
REM
REM  L'icone GFSF pourra etre ajoutee plus tard : deposer le fichier .ico dans
REM  public\planificateur.ico et relancer ce script, il la prendra tout seul.
REM ===========================================================================
cd /d "%~dp0"

echo.
echo   Creation du raccourci sur le Bureau...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$dossier = (Get-Location).Path;" ^
 "$bureau = [Environment]::GetFolderPath('Desktop');" ^
 "$lnk = Join-Path $bureau 'Planificateur.lnk';" ^
 "$w = New-Object -ComObject WScript.Shell;" ^
 "$s = $w.CreateShortcut($lnk);" ^
 "$s.TargetPath = (Join-Path $dossier 'lancer-planificateur.bat');" ^
 "$s.WorkingDirectory = $dossier;" ^
 "$s.Description = 'Planificateur de rencontre - local';" ^
 "$s.WindowStyle = 7;" ^
 "$ico = Join-Path $dossier 'public\planificateur.ico';" ^
 "if (Test-Path $ico) { $s.IconLocation = $ico; Write-Host '   icone GFSF appliquee' }" ^
 "$s.Save();" ^
 "Write-Host ('   cree : ' + $lnk)"

echo.
echo   Double-cliquez sur Planificateur depuis votre Bureau.
echo.
pause
exit /b 0
