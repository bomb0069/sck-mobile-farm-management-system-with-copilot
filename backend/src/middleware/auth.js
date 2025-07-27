const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Middleware สำหรับตรวจสอบ JWT Token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'ไม่มี access token'
      });
    }

    // ตรวจสอบความถูกต้องของ token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // ตรวจสอบว่าผู้ใช้ยังมีอยู่ในระบบหรือไม่
    const [users] = await pool.execute(
      'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = ? AND is_active = true',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'ไม่พบผู้ใช้งานหรือบัญชีถูกระงับ'
      });
    }

    // เพิ่มข้อมูลผู้ใช้ใน request object
    req.user = users[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        message: 'Token ไม่ถูกต้อง'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        message: 'Token หมดอายุ'
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์'
    });
  }
};

// Middleware สำหรับตรวจสอบสิทธิ์ตามบทบาท
const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'ไม่มีการล็อกอิน'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'ไม่มีสิทธิ์เข้าถึงฟังก์ชันนี้'
      });
    }

    next();
  };
};

// Middleware สำหรับตรวจสอบการเป็นเจ้าของฟาร์ม
const checkFarmOwnership = async (req, res, next) => {
  try {
    const farmId = req.params.farmId || req.body.farmId;
    const userId = req.user.id;

    if (!farmId) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบ ID ฟาร์ม'
      });
    }

    // Admin สามารถเข้าถึงฟาร์มใด ๆ ได้
    if (req.user.role === 'admin') {
      return next();
    }

    // ตรวจสอบว่าผู้ใช้เป็นเจ้าของฟาร์มหรือไม่
    const [farms] = await pool.execute(
      'SELECT id FROM farms WHERE id = ? AND owner_id = ? AND is_active = true',
      [farmId, userId]
    );

    if (farms.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'ไม่มีสิทธิ์เข้าถึงฟาร์มนี้'
      });
    }

    next();
  } catch (error) {
    console.error('Farm ownership check error:', error);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์ฟาร์ม'
    });
  }
};

module.exports = {
  authenticateToken,
  authorizeRole,
  checkFarmOwnership
};
