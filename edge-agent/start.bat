@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  py -3 -m venv .venv
  if errorlevel 1 goto failed
)
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo.
  echo Created edge-agent\.env. Add OPENAI_API_KEY and TRADING_V2_REPO, then run start.bat again.
  notepad ".env"
  pause
  exit /b 0
)
".venv\Scripts\python.exe" agent.py
pause
exit /b 0
:failed
echo Python 3 could not create a virtual environment. Install Python 3.10 or newer.
pause
exit /b 1
