@echo off
rem Builds the whole portal into one runnable JAR: backend\target\agro-portal.jar
setlocal
if "%JAVA_HOME%"=="" if exist "C:\Program Files\JetBrains\JetBrains Rider 2025.3.3\jbr" set "JAVA_HOME=C:\Program Files\JetBrains\JetBrains Rider 2025.3.3\jbr"
set "MVN=mvn"
if exist "%~dp0.tools\apache-maven-3.9.9\bin\mvn.cmd" set "MVN=%~dp0.tools\apache-maven-3.9.9\bin\mvn.cmd"
pushd "%~dp0frontend" || exit /b 1
call npm install --no-audit --no-fund || exit /b 1
call npm run build || exit /b 1
popd
pushd "%~dp0backend" || exit /b 1
call "%MVN%" -q -B package || exit /b 1
popd
echo.
echo Hazirdir: start.bat ile ise salin.
