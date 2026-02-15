@echo off
title Create Desktop Shortcut - Annotation Studio V1
set SCRIPT_DIR=%~dp0
set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%

set VBS=%TEMP%\CreateShortcut_%RANDOM%.vbs
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS%"
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\Annotation Studio V1.lnk" >> "%VBS%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS%"
echo oLink.TargetPath = "%SCRIPT_DIR%\startserver.bat" >> "%VBS%"
echo oLink.WorkingDirectory = "%SCRIPT_DIR%" >> "%VBS%"
echo oLink.Description = "Annotation Studio V1 - Start backend and frontend" >> "%VBS%"
echo oLink.Save >> "%VBS%"
cscript //nologo "%VBS%"
del "%VBS%"

echo Desktop shortcut created: "Annotation Studio V1.lnk"
echo Double-click it to start all servers.
pause
