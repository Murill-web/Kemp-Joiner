@echo off
title Kemp Voice
python "%~dp0app.py"
if errorlevel 1 (
    echo.
    echo [ERROR] Algo salio mal. Corre setup.bat primero.
    pause
)
