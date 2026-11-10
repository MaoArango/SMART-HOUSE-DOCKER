@echo off
cd /d "%~dp0"
echo.
echo =============================================
echo      SMART HOUSE INMOBILIARIA S.A.S.
echo =============================================
echo.
echo Iniciando servidor...
start "SMART HOUSE" cmd /k "node server.js"
timeout /t 2 /nobreak >nul
start "" http://localhost:3000/
echo.
echo La pagina se abrira en http://localhost:3000/
echo No cierre la ventana negra del servidor mientras use SMART HOUSE.
