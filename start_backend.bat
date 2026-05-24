@echo off
setlocal
cd /d "%~dp0backend"

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Created backend\.env from backend\.env.example
  echo Add your API keys to backend\.env before using model or web search features.
)

if exist "venv\Scripts\python.exe" (
  "venv\Scripts\python.exe" --version >nul 2>nul
  if errorlevel 1 (
    echo Existing backend venv is broken. Recreating it...
    rmdir /s /q venv
  )
)

if not exist "venv\Scripts\python.exe" (
  python -m venv venv
)

call "venv\Scripts\activate.bat"
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload
