const mysql = require('mysql2/promise');
require('dotenv').config();

// สร้าง connection pool สำหรับการเชื่อมต่อฐานข้อมูล
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'poultry_farm_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  charset: 'utf8mb4'
});

// ทดสอบการเชื่อมต่อฐานข้อมูล
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ เชื่อมต่อฐานข้อมูล MySQL สำเร็จ');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้:', error.message);
    return false;
  }
};

// ฟังก์ชันปิดการเชื่อมต่อ
const closeConnection = async () => {
  try {
    await pool.end();
    console.log('🔄 ปิดการเชื่อมต่อฐานข้อมูลแล้ว');
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการปิดการเชื่อมต่อ:', error.message);
  }
};

module.exports = {
  pool,
  testConnection,
  closeConnection
};
