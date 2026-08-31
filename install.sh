#!/usr/bin/env bash
# ==============================================================================
# สคริปต์ติดตั้งและเริ่มต้นระบบบันทึกคะแนนและตัดเกรดนักเรียนอย่างรวดเร็ว (Quick Installer)
# ==============================================================================

set -e

# สีแสดงผล
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BLUE}${BOLD}"
echo "================================================================"
echo "    ระบบบันทึกคะแนนและตัดเกรดนักเรียน (Quick Installer)"
echo "================================================================"
echo -e "${NC}"

# 1. ตรวจสอบ Node.js
echo -e "${BLUE}➤ ตรวจสอบสภาพแวดล้อม (Node.js & Package Manager)...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ ไม่พบ Node.js ในระบบ! กรุณาติดตั้ง Node.js (เวอร์ชัน 18 ขึ้นไป)${NC}"
    echo "ดาวน์โหลดได้ที่: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ ตรวจพบ Node.js: ${NODE_VERSION}${NC}"

# 2. เลือกระบบจัดการแพ็กเกจ (npm / pnpm / yarn / bun)
PKG_MANAGER="npm"
if command -v bun &> /dev/null; then
    PKG_MANAGER="bun"
elif command -v pnpm &> /dev/null; then
    PKG_MANAGER="pnpm"
elif command -v yarn &> /dev/null; then
    PKG_MANAGER="yarn"
fi

echo -e "${GREEN}✓ ใช้ Package Manager: ${PKG_MANAGER}${NC}"

# 3. คัดลอกไฟล์ Environment (.env) หากยังไม่มี
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo -e "${YELLOW}➤ สร้างไฟล์ .env จาก .env.example...${NC}"
        cp .env.example .env
        echo -e "${GREEN}✓ สร้างไฟล์ .env สำเร็จ${NC}"
    fi
fi

# 4. ติดตั้ง Dependencies
echo -e "${BLUE}➤ กำลังติดตั้ง Dependencies...${NC}"
if [ "$PKG_MANAGER" = "bun" ]; then
    bun install
elif [ "$PKG_MANAGER" = "pnpm" ]; then
    pnpm install
elif [ "$PKG_MANAGER" = "yarn" ]; then
    yarn install
else
    npm install
fi
echo -e "${GREEN}✓ ติดตั้ง Dependencies สำเร็จ!${NC}"

# 5. ทดสอบการ Build
echo -e "${BLUE}➤ กำลังทดสอบ Build ระบบ...${NC}"
if [ "$PKG_MANAGER" = "bun" ]; then
    bun run build
elif [ "$PKG_MANAGER" = "pnpm" ]; then
    pnpm run build
elif [ "$PKG_MANAGER" = "yarn" ]; then
    yarn build
else
    npm run build
fi
echo -e "${GREEN}✓ ทำการ Build สำเร็จเรียบร้อย! (ไฟล์พร้อมใช้งานในโฟลเดอร์ dist/)${NC}"

echo -e "\n${GREEN}${BOLD}================================================================${NC}"
echo -e "${GREEN}${BOLD}🎉 การติดตั้งเสร็จสมบูรณ์ พร้อมเปิดใช้งานแล้ว!${NC}"
echo -e "${GREEN}${BOLD}================================================================${NC}"
echo ""
echo -e "คำสั่งสำหรับรันระบบ:"
echo -e "  • ${BOLD}โหมดพัฒนา (Development):${NC}  ${PKG_MANAGER} run dev"
echo -e "  • ${BOLD}ทดสอบดูตัวอย่าง (Preview):${NC}    ${PKG_MANAGER} run preview"
echo -e "  • ${BOLD}คอมไพล์สำหรับนำขึ้นเซิร์ฟเวอร์:${NC} ${PKG_MANAGER} run build"
echo ""

# ถามผู้ใช้ว่าต้องการเปิดระบบทันทีหรือไม่
read -p "ต้องการเปิด Dev Server ตอนนี้เลยหรือไม่? (y/n) [ค่าเริ่มต้น: y]: " -r RUN_NOW
RUN_NOW=${RUN_NOW:-y}

if [[ $RUN_NOW =~ ^[Yy]$ ]]; then
    echo -e "\n${BLUE}➤ กำลังเริ่มระบบ (โหมดพัฒนา)...${NC}"
    if [ "$PKG_MANAGER" = "bun" ]; then
        bun run dev
    elif [ "$PKG_MANAGER" = "pnpm" ]; then
        pnpm run dev
    elif [ "$PKG_MANAGER" = "yarn" ]; then
        yarn dev
    else
        npm run dev
    fi
fi
