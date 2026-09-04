@echo off
setlocal enabledelayedexpansion

REM Betigin calisma dizinini KENDI konumuna sabitle - "Yonetici olarak
REM calistir" bazi Windows kurulumlarinda calisma dizinini System32ye
REM sabitleyip goreli yol/robocopy komutlarini sessizce bozabiliyor.
cd /d "%~dp0"

echo ============================================
echo   GORSEL SINIFLANDIRICI - TOOL KALDIRMA
echo ============================================
echo.

set DEFAULT_CORE=..\aktapokus-core
set /p CORE_PATH=Core klasoru nerede? [%DEFAULT_CORE%]:
if "%CORE_PATH%"=="" set CORE_PATH=%DEFAULT_CORE%

if not exist "%CORE_PATH%\tools\gorsel" goto NOTINSTALLED

echo Bu islem sunu SILECEK: %CORE_PATH%\tools\gorsel\
echo Sinifladiginiz gorsel dosyalari (kendi sectiginiz klasorde)
echo ETKILENMEZ - sadece bu tool'un kendi dosyalari silinir.
echo.
choice /c ED /m "Devam edilsin mi? (E=Evet, D=Dur)"
if errorlevel 2 goto CANCELLED

echo [1/2] Dosyalar siliniyor: %CORE_PATH%\tools\gorsel\
rmdir /s /q "%CORE_PATH%\tools\gorsel"
if exist "%CORE_PATH%\tools\gorsel" goto DELFAIL

echo [2/2] Container yeniden baslatiliyor...
pushd "%CORE_PATH%\core"
docker compose restart app
popd

echo.
echo ============================================
echo   GORSEL SINIFLANDIRICI KALDIRILDI
echo ============================================
echo   Arayuzu yenileyin: http://localhost:8000
echo ============================================
pause
exit /b 0

:NOTINSTALLED
echo Gorsel Siniflandirici zaten kurulu degil: %CORE_PATH%\tools\gorsel bulunamadi.
pause
exit /b 0

:CANCELLED
echo Iptal edildi, hicbir sey silinmedi.
pause
exit /b 0

:DELFAIL
echo [HATA] Dosyalar silinemedi - klasor kullanimda olabilir.
pause
exit /b 1
