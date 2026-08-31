# 🎓 ระบบบันทึกคะแนนและตัดเกรดนักเรียน (Student Grading & Attendance System)

[![CI Build & Check](https://github.com/your-username/your-repo/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/your-repo/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/your-username/your-repo/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/your-username/your-repo/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38b2ac.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff.svg?logo=vite&logoColor=white)](https://vitejs.dev/)

ระบบบริหารจัดการคะแนน ตัดเกรด 2 ภาคเรียน เช็คชื่อการเข้าเรียนรายบุคคลพร้อมปฏิทินวันหยุดนักขัตฤกษ์/เสาร์-อาทิตย์ และพิมพ์รายงานใบเช็คชื่อ/ใบคะแนนมาตรฐาน ครบครันในที่เดียว รองรับการใช้งานผ่านคอมพิวเตอร์ แท็บเล็ต และสมาร์ตโฟน

---

## ⚡ ติดตั้งและเริ่มใช้งานอย่างรวดเร็ว (Quick Installation)

### 🚀 วิธีที่ 1: ติดตั้งผ่านสคริปต์อัตโนมัติ (แนะนำ)

#### บน macOS / Linux / WSL:
```bash
# 1. Clone repository
git clone https://github.com/your-username/your-repo.git
cd your-repo

# 2. ให้อนุญาตและรันตัวติดตั้ง
chmod +x install.sh
./install.sh
```

#### บน Windows:
```cmd
REM 1. Clone repository
git clone https://github.com/your-username/your-repo.git
cd your-repo

REM 2. ดับเบิลคลิกหรือรันไฟล์ install.bat
install.bat
```

---

### 💻 วิธีที่ 2: ติดตั้งด้วยตนเองผ่าน Terminal / Command Line

```bash
# 1. ติดตั้ง Dependencies
npm install
# หรือใช้ bun / pnpm / yarn
# bun install / pnpm install / yarn

# 2. เริ่มต้นเซิร์ฟเวอร์สำหรับพัฒนา (Development Mode)
npm run dev

# 3. เปิดเว็บเบราว์เซอร์ไปที่: http://localhost:3000
```

---

### 🐳 วิธีที่ 3: รันด้วย Docker & Docker Compose

```bash
# รันผ่าน Docker Compose ในคำสั่งเดียว
docker compose up -d --build

# เปิดใช้งานที่: http://localhost:8080
```

---

## 🔄 GitHub Actions Workflows (ระบบอัตโนมัติ)

โปรเจกต์นี้มาพร้อมกับ GitHub Actions Workflows ที่พร้อมใช้งานทันทีในโฟลเดอร์ `.github/workflows/`:

### 1. `ci.yml` — ตรวจสอบคุณภาพโค้ดและทดสอบ Build อัตโนมัติ
- ทำงานทุกครั้งที่มีการ **Push** หรือสร้าง **Pull Request** ไปยังกิ่ง `main` หรือ `master`
- ตรวจสอบ Type Safety (`npm run lint`)
- ทดสอบคอมไพล์โปรเจกต์ (`npm run build`)
- บันทึกและอัปโหลด Build Artifact (`dist/`) เพื่อตรวจสอบความพร้อม

### 2. `deploy-pages.yml` — เผยแพร่เว็บขึ้น GitHub Pages อัตโนมัติ (1-Click Deploy)
- ทำงานอัตโนมัติเมื่อมีการอัปเดตโค้ดในกิ่ง `main` / `master` หรือกดสั่งทำงานผ่านหน้าเว็บ GitHub Actions (Manual trigger)
- คอมไพล์โปรเจกต์และอัปโหลดขึ้น **GitHub Pages** โดยไม่ต้องตั้งค่า Server ใดๆ เพิ่มเติม

#### ⚙️ ขั้นตอนการเปิดใช้งาน GitHub Pages ใน Repository:
1. ไปที่ **Settings** ของ Repository บน GitHub
2. เลือกเมนู **Pages** (ในแถบซ้ายมือ)
3. ภายใต้หัวข้อ **Build and deployment > Source**:
   - เลือก **GitHub Actions**
4. เมื่อ Push โค้ดขึ้นกิ่ง `main` ระบบจะทำการ Deploy เว็บให้พร้อมเข้าใช้งานได้ทันทีที่ URL:
   `https://<your-username>.github.io/<your-repo-name>/`

---

## 🛠️ คำสั่งที่สำคัญ (Scripts)

| คำสั่ง | คำอธิบาย |
| :--- | :--- |
| `npm run dev` | เริ่มต้นเซิร์ฟเวอร์สำหรับพัฒนา (Local Dev Server) ที่พอร์ต 3000 |
| `npm run build` | คอมไพล์โค้ดเป็น Static Files พร้อมใช้งานจริงในโฟลเดอร์ `dist/` |
| `npm run preview` | พรีวิวไฟล์ Production ในโฟลเดอร์ `dist/` บน Local Server |
| `npm run lint` | ตรวจสอบ TypeScript Types (`tsc --noEmit`) |
| `npm run clean` | ลบโฟลเดอร์ `dist/` และไฟล์ชั่วคราว |

---

## 🌐 การนำขึ้นระบบอื่นๆ (Cloud & Static Hosting)

### 🔹 Vercel
1. เชื่อมต่อ GitHub Repository บน [Vercel Dashboard](https://vercel.com)
2. Framework Preset: **Vite**
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. กด **Deploy**

### 🔹 Netlify
1. นำเข้า Repository บน [Netlify Dashboard](https://netlify.com)
2. Build command: `npm run build`
3. Publish directory: `dist`
4. กด **Deploy Site**

### 🔹 Cloudflare Pages
1. ไปที่ **Workers & Pages** บน Cloudflare Dashboard
2. เลือก **Connect to Git**
3. Framework Preset: **Vite**
4. Build Output Directory: `dist`

---

## 🌟 ฟังก์ชันการทำงานเด่น (Core Features)

- 📊 **ระบบบันทึกคะแนนและตัดเกรด:**
  - รองรับทั้ง ภาคเรียนที่ 1, ภาคเรียนที่ 2 และคะแนนรวมเฉลี่ย 2 ภาคเรียน
  - โหมดตารางรวม (Table Mode) รองรับการใช้ปุ่ม Enter/ลูกศร เพื่อกรอกคะแนนอย่างรวดเร็ว
  - โหมดตรวจรายใบงาน (Focus Mode) ออกแบบมาสำหรับมือถือและแท็บเล็ต แตะให้คะแนนง่าย
  - คำนวณตัดเกรดอัตโนมัติ 8 ระดับ (0, 1, 1.5, 2, 2.5, 3, 3.5, 4)
- 📅 **ระบบเช็คชื่อเข้าเรียนรายวิชา:**
  - ปฏิทินอัจฉริยะ แสดงวันหยุดนักขัตฤกษ์ของไทยและวันเสาร์-อาทิตย์ พร้อมล็อควันล่วงหน้า
  - บันทึกการมาเรียนอัตโนมัติ (Default มาเรียน) เลือกแตะเฉพาะนักเรียนที่ ขาด/ลา/ป่วย
  - สรุปสถิติเวลาเรียนและคำนวณสิทธิ์สอบ (ต้องมีเวลาเรียนไม่น้อยกว่า 80%)
- 🖨️ **ระบบพิมพ์รายงานมาตรฐาน (A4 Print Ready):**
  - แบบรายงานใบเช็คชื่อรายเดือนแนวนอน ไฮไลท์สีวันหยุดสวยงาม
  - ใบสรุปคะแนนและผลการเรียน
- ⚙️ **การตั้งค่าและฐานข้อมูล:**
  - กำหนดสิทธิ์ผู้ใช้งาน 4 ระดับ (Admin, นายทะเบียน, ครูประจำวิชา, ครูที่ปรึกษา)
  - รองรับการเชื่อมต่อ Cloud Firestore หรือจัดเก็บในเครื่อง (Offline LocalStorage)
  - ระบบสำรองและกู้คืนข้อมูล (JSON Backup & Restore)

---

## 📄 ลิขสิทธิ์ (License)

โปรเจกต์นี้เผยแพร่ภายใต้ [MIT License](LICENSE)
