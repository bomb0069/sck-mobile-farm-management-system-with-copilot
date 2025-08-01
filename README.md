# ระบบบริหารจัดการฟาร์มเลี้ยงไก่ (Poultry Farm Management System)

ระบบจัดการฟาร์มเลี้ยงไก่แบบครบวงจร รองรับทั้งไก่เนื้อและไก่ไข่

## คุณสมบัติหลัก

### 1. การลงทะเบียนข้อมูลฟาร์มและโรงเรือน
- ลงทะเบียนข้อมูลฟาร์ม (ชื่อ, สถานที่ตั้ง, ผู้ดูแล)
- จัดการข้อมูลโรงเรือน (รหัส, ขนาด, ความจุ)

### 2. การลงข้อมูลไก่เข้าฟาร์ม
- รองรับไก่เนื้อและไก่ไข่
- ข้อมูลรายละเอียด (จำนวน, อายุ, สายพันธุ์, แหล่งที่มา)
- คำนวณรอบการเลี้ยงอัตโนมัติ

### 3. การจัดการอาหารและน้ำ
- บันทึกการให้อาหาร-น้ำประจำวัน
- กำหนดสูตรอาหารตามช่วงอายุ
- รายงานการใช้อาหาร-น้ำ

### 4. การจัดการสุขภาพและการใช้ยา
- บันทึกประวัติการให้ยาและวัคซีน
- แจ้งเตือนกำหนดการให้วัคซีน
- ติดตามการตายและคัดทิ้ง

### 5. การติดตามผลผลิต
- **ไก่ไข่**: บันทึกจำนวนไข่ต่อวัน, แยกเกรด
- **ไก่เนื้อ**: บันทึกน้ำหนัก, คำนวณ FCR

### 6. การบริหารคลังสินค้า
- จัดการสต๊อกอาหาร, ยา, วัสดุ
- แจ้งเตือนสต๊อกเหลือน้อย

### 7. การจัดการลูกค้า (Customer Management)
- ลงทะเบียนลูกค้า (บุคคล, บริษัท, ร้านอาหาร, ตัวแทนจำหน่าย)
- จัดการข้อมูลติดต่อและเงื่อนไขการชำระเงิน
- ติดตามประวัติการสั่งซื้อและการชำระเงิน
- ระบบจัดการคำสั่งซื้อและการส่งมอบ

### 8. การรายงานและวิเคราะห์
- รายงานผลผลิต, สุขภาพ, ต้นทุน
- แสดงผลแบบกราฟ
- Export PDF, Excel

## โครงสร้างโปรเจกต์

```
├── mobile_app/          # Flutter Mobile Application
├── backend/             # Node.js API Server
├── database/           # MySQL Database Scripts
└── docs/               # Documentation
```

## เทคโนโลยีที่ใช้

- **Frontend**: Flutter
- **Backend**: Node.js + Express
- **Database**: MySQL
- **Authentication**: JWT

## การติดตั้งและใช้งาน

### Backend API
```bash
cd backend
npm install
npm run dev
```

### Mobile App
```bash
cd mobile_app
flutter pub get
flutter run
```

## การพัฒนา

โปรเจกต์นี้ใช้ Conventional Commit Messages เป็นภาษาไทยในการจัดการ version control

## License

MIT License
