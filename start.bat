@echo off
echo ============================================
echo   Cloud Maturity Assessment App
echo ============================================
echo.

:: Check for .env
if not exist "%~dp0backend\.env" (
  echo [WARNING] No .env file found in backend\
  echo Please copy backend\.env.example to backend\.env
  echo and add your ANTHROPIC_API_KEY
  echo.
)

:: Start backend
echo Starting backend...
start "Maturity Backend" cmd /k "cd /d %~dp0backend && npm install && npm run dev"

:: Wait then start frontend
timeout /t 5 /nobreak >nul
echo Starting frontend...
start "Maturity Frontend" cmd /k "cd /d %~dp0frontend && npm install && npm run dev"

echo.
echo ============================================
echo  App will be ready at: http://localhost:5173
echo  API running at:       http://localhost:8000
echo ============================================
echo.
pause
