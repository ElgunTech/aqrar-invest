@echo off
rem Starts the portal on http://localhost:8080  (use "start.bat reset" to restore the demo data)
setlocal
if "%JAVA_HOME%"=="" if exist "C:\Program Files\JetBrains\JetBrains Rider 2025.3.3\jbr" set "JAVA_HOME=C:\Program Files\JetBrains\JetBrains Rider 2025.3.3\jbr"
set "JAVA=java"
if not "%JAVA_HOME%"=="" set "JAVA=%JAVA_HOME%\bin\java"
pushd "%~dp0backend"
if /i "%1"=="reset" (
  echo Demo melumatlari sifirlanir...
  if exist data rmdir /s /q data
  if exist uploads rmdir /s /q uploads
)
echo Portal: http://localhost:8080
"%JAVA%" -jar target\agro-portal.jar
popd
