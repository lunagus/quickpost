@echo off
setlocal
echo Setting up quickpost "Send To" shortcut with custom icon...

:: Define paths
set "QP_DIR=%USERPROFILE%\.quickpost"
set "SENDTO_DIR=%APPDATA%\Microsoft\Windows\SendTo"
set "WRAPPER_PATH=%QP_DIR%\qp-sendto.bat"
set "ICON_PATH=%QP_DIR%\icon.ico"
set "SHORTCUT_PATH=%SENDTO_DIR%\quickpost.lnk"
set "QP_SCRIPT=%QP_DIR%\qp.ps1"

if not exist "%QP_DIR%" mkdir "%QP_DIR%"

:: Check if quickpost CLI is installed
if not exist "%QP_SCRIPT%" (
    echo [ERROR] quickpost CLI is not installed.
    echo Please install it first by running this in PowerShell:
    echo irm https://qpst.cc/install.ps1 ^| iex
    pause
    exit /b 1
)

:: Download the icon
echo Downloading icon...
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/lunagus/quickpost/main/public/favicons/favicon.ico' -OutFile '%ICON_PATH%'"

:: Create the wrapper batch file that hides the window and copies to clipboard
(
    echo @echo off
    echo setlocal
    echo set "FILE_PATH=%%~1"
    echo if "%%FILE_PATH%%"=="" exit /b
    echo powershell -WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -Command "& { $url = & '%QP_SCRIPT%' -Path '%%FILE_PATH%%'; if ($url) { $url | Set-Clipboard } }"
) > "%WRAPPER_PATH%"

:: Create the .lnk shortcut using PowerShell so we can set the icon
echo Creating shortcut...
powershell -NoProfile -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%SHORTCUT_PATH%'); $Shortcut.TargetPath = '%WRAPPER_PATH%'; $Shortcut.IconLocation = '%ICON_PATH%'; $Shortcut.Save()"

:: Clean up the old .bat shortcut if it exists from previous versions
if exist "%SENDTO_DIR%\quickpost.bat" del "%SENDTO_DIR%\quickpost.bat"

echo.
echo [SUCCESS] "quickpost" has been added to your Send To menu!
echo Right-click any file -^> Send to -^> quickpost
echo The uploaded URL will automatically be copied to your clipboard.
echo.
pause
