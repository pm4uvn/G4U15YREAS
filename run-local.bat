@echo off
cd /d "%~dp0"

if not exist node_modules (
	echo Installing dependencies, cho toi mot chut...
	call npm install
	if errorlevel 1 (
		echo.
		echo Cai dat that bai. Kiem tra ket noi mang roi thu lai.
		pause
		exit /b 1
	)
)

echo Dang khoi dong local server...

rem Cho vai giay de Vite khoi dong xong roi tu mo trinh duyet.
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"

call npm run dev -- --host

pause
