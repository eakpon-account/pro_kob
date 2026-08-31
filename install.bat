@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ================================================================
echo    ระบบบันทึกคะแนนและตัดเกรดนักเรียน (Quick Installer for Windows)
echo ================================================================
echo.

REM 1. ตรวจสอบ Node.js
echo [1/4] ตรวจสอบ Node.js ในระบบ...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] ไม่พบ Node.js ในระบบ!
    echo กรุณาดาวน์โหลดและติดตั้ง Node.js (เวอร์ชัน 18 ขึ้นไป) ได้ที่: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [SUCCESS] พบ Node.js: %NODE_VER%
echo.

REM 2. คัดลอก .env
echo [2/4] ตั้งค่าไฟล์สภาพแวดล้อม...
if not exist .env (
    if exist .env.example (
        copy .env.example .env > nul
        echo [SUCCESS] คัดลอกไฟล์ .env จาก .env.example เรียบร้อย
    )
) else (
    echo [INFO] พบไฟล์ .env อยู่แล้ว
)
echo.

REM 3. ติดตั้ง Dependencies
echo [3/4] กำลังติดตั้ง Dependencies (npm install)...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] การติดตั้ง Dependencies ขัดข้อง!
    pause
    exit /b 1
)
echo [SUCCESS] ติดตั้ง Dependencies สำเร็จ!
echo.

REM 4. ทดสอบ Build
echo [4/4] ทดสอบ Build ระบบ (npm run build)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] การ Build ขัดข้อง!
    pause
    exit /b 1
)
echo [SUCCESS] Build ระบบสำเร็จ! โฟลเดอร์ dist/ พร้อมใช้งาน
echo.

echo ================================================================
echo 🎉 การติดตั้งเสร็จสมบูรณ์!
echo ================================================================
echo คำสั่งที่สามารถใช้งานได้:
echo   - โหมดพัฒนา:          npm run dev
echo   - ดูตัวอย่าง (Preview): npm run preview
echo   - คอมไพล์ระบบ:        npm run build
echo.

set /p RUN_DEV="ต้องการเปิดเซิร์ฟเวอร์โหมดพัฒนาตอนนี้เลยหรือไม่? (Y/N) [default: Y]: "
if "%RUN_DEV%"=="" set RUN_DEV=Y
if /i "%RUN_DEV%"=="Y" (
    echo.
    echo กำลังเริ่มรันเซิร์ฟเวอร์...
    call npm run dev
)

pause
