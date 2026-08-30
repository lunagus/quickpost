@echo off
setlocal
echo Setting up quickpost "Send To" shortcut...

:: Define paths
set "SENDTO_DIR=%APPDATA%\Microsoft\Windows\SendTo"
set "SHORTCUT_PATH=%SENDTO_DIR%\quickpost.bat"
set "QP_SCRIPT=%USERPROFILE%\.quickpost\qp.ps1"

:: Check if quickpost CLI is installed
if not exist "%QP_SCRIPT%" (
    echo [ERROR] quickpost CLI is not installed.
    echo Please install it first by running this in PowerShell:
    echo irm https://qpst.cc/install.ps1 ^| iex
    pause
    exit /b 1
)

:: Create the wrapper batch file in SendTo directory
(
    echo @echo off
    echo setlocal
    echo set "FILE_PATH=%%~1"
    echo if "%%FILE_PATH%%"=="" exit /b
    echo echo Uploading to quickpost...
    echo powershell -ExecutionPolicy Bypass -NoProfile -Command "& { & '%QP_SCRIPT%' -Path '%%FILE_PATH%%' | Set-Clipboard; Write-Host 'URL copied to clipboard!' }"
    echo timeout /t 2 ^>nul
) > "%SHORTCUT_PATH%"

echo.
echo [SUCCESS] "quickpost" has been added to your Send To menu!
echo Right-click any file -^> Send to -^> quickpost
echo The uploaded URL will automatically be copied to your clipboard.
echo.
pause
