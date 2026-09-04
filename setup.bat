@echo off
setlocal enabledelayedexpansion

REM Betigin calisma dizinini KENDI konumuna sabitle - "Yonetici olarak
REM calistir" bazi Windows kurulumlarinda calisma dizinini System32ye
REM sabitleyip goreli yol/robocopy komutlarini sessizce bozabiliyor.
cd /d "%~dp0"

echo ============================================
echo   GORSEL SINIFLANDIRICI - TOOL KURULUM
echo ============================================
echo.

set DEFAULT_CORE=..\aktapokus-core
set /p CORE_PATH=Core klasoru nerede? [%DEFAULT_CORE%]:
if "%CORE_PATH%"=="" set CORE_PATH=%DEFAULT_CORE%

if not exist "%CORE_PATH%\core\docker-compose.yml" goto BADCORE
if not exist "%CORE_PATH%\.env" goto NOENV

echo [1/3] Dosyalar kopyalaniyor: %CORE_PATH%\tools\gorsel\
if not exist "%CORE_PATH%\tools\gorsel" mkdir "%CORE_PATH%\tools\gorsel"
robocopy . "%CORE_PATH%\tools\gorsel" /E /XF setup.bat uninstall.bat /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto COPYFAIL

findstr /c:"host.docker.internal" "%CORE_PATH%\.env" >nul 2>&1
if not errorlevel 1 (set NATIVE_OLLAMA=1) else (set NATIVE_OLLAMA=0)

echo [2/3] Container yeniden baslatiliyor...
pushd "%CORE_PATH%\core"
docker compose restart app
if errorlevel 1 goto BUILDFAIL

echo.
echo [3/3] Vision modeli iniyor: llava (~4.7 GB)...
echo       Bu ONEMLI: gorselleri "okuyabilen" model bu - yuklenmeden
echo       tool calismaz. Baglanti hizina gore birkac dakika surebilir.
echo.
if "%NATIVE_OLLAMA%"=="1" goto PULLNATIVE
goto PULLDOCKER

:PULLNATIVE
ollama pull llava
if errorlevel 1 echo       UYARI: Model inemedi - internet baglantinizi kontrol edip daha sonra "ollama pull llava" ile tekrar deneyebilirsiniz. Kurulum yine de tamamlanacak.
goto DONE

:PULLDOCKER
docker exec aktapokus_ollama ollama pull llava
if errorlevel 1 echo       UYARI: Model inemedi - daha sonra "docker exec aktapokus_ollama ollama pull llava" ile tekrar deneyebilirsiniz. Kurulum yine de tamamlanacak.
goto DONE

:DONE
popd
echo.
echo ============================================
echo   GORSEL SINIFLANDIRICI KURULDU
echo ============================================
echo   Arayuzu yenileyin: http://localhost:8000
echo   Tool listesinde "Gorsel Siniflandirici" gorunmeli.
echo   Farkli bir vision modeli kullanmak isterseniz .env'e
echo   GORSEL_VISION_MODEL=<model_adi> satirini ekleyin.
echo ============================================
pause
exit /b 0

:BADCORE
echo [HATA] Belirtilen yolda aktapokus-core bulunamadi: %CORE_PATH%
echo        core\docker-compose.yml orada olmali.
pause
exit /b 1

:NOENV
echo [HATA] %CORE_PATH%\.env bulunamadi.
echo        Once core klasorunde setup.bat'i calistirip core kurulumunu
echo        tamamlayin, sonra bu betigi tekrar calistirin.
pause
exit /b 1

:COPYFAIL
echo [HATA] Dosyalar kopyalanamadi.
pause
exit /b 1

:BUILDFAIL
echo [HATA] Container yeniden baslatilamadi. Yukaridaki hatayi kontrol edin.
popd
pause
exit /b 1
