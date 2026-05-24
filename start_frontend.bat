@echo off
setlocal
cd /d "%~dp0frontend"
npm install
npm run dev
