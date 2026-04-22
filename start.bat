@echo off
echo Starting Flux Share...

echo Launching Backend (FastAPI)...
start "Flux Share Backend" cmd /k "cd backend && uvicorn main:app --reload"

echo Launching Frontend (Vite)...
start "Flux Share Frontend" cmd /k "cd frontend && npm run dev"

echo Both services are booting up in separate background windows!
echo Feel free to close this terminal.
