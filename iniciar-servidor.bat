@echo off
setlocal

cd /d "%~dp0"

set "HOST=127.0.0.1"
if "%PORT%"=="" set "PORT=8765"
if "%DB_HOST%"=="" set "DB_HOST=127.0.0.1"
if "%DB_NAME%"=="" set "DB_NAME=minezera"
if "%DB_USER%"=="" set "DB_USER=root"
if "%DB_PASS%"=="" set "DB_PASS="

echo.
echo ========================================
echo   Minezera - Servidor Node
echo ========================================
echo.
echo Banco: %DB_NAME% em %DB_HOST%
echo Usuario: %DB_USER%
echo URL: http://127.0.0.1:%PORT%/
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado.
  echo Instale o Node.js 18 ou superior e tente novamente.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERRO: npm nao encontrado.
  echo Reinstale o Node.js marcando a opcao de instalar npm.
  pause
  exit /b 1
)

if not exist "node_modules\mysql2" (
  goto install_deps
)
if not exist "node_modules\ws" (
  goto install_deps
)
goto deps_ok

:install_deps
  echo Instalando dependencias do servidor...
  call npm install
  if errorlevel 1 (
    echo.
    echo ERRO: nao foi possivel instalar as dependencias.
    pause
    exit /b 1
  )

:deps_ok

if not exist "storage" mkdir "storage"
if not exist "storage\world" mkdir "storage\world"

echo Abrindo navegador...
start "" "http://127.0.0.1:%PORT%/"
echo.
echo Servidor iniciado. Deixe esta janela aberta enquanto for jogar.
echo Para parar, pressione Ctrl+C.
echo.

npm start

echo.
echo Servidor encerrado.
pause
