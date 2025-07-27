const { pool } = require('../config/database');
const { hashPassword, comparePassword, generateToken, createResponse } = require('../utils/helpers');

// ลงทะเบียนผู้ใช้ใหม่
const register = async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone, role } = req.body;

    // ตรวจสอบว่ามี email นี้ในระบบแล้วหรือไม่
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json(
        createResponse(false, 'อีเมลนี้ถูกใช้งานแล้ว')
      );
    }

    // เข้ารหัสรหัสผ่าน
    const hashedPassword = await hashPassword(password);

    // บันทึกผู้ใช้ใหม่
    const [result] = await pool.execute(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, first_name, last_name, phone, role]
    );

    // สร้าง JWT token
    const token = generateToken(result.insertId, email, role);

    res.status(201).json(
      createResponse(true, 'ลงทะเบียนสำเร็จ', {
        user: {
          id: result.insertId,
          email,
          first_name,
          last_name,
          phone,
          role
        },
        token
      })
    );

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการลงทะเบียน')
    );
  }
};

// เข้าสู่ระบบ
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ค้นหาผู้ใช้ด้วย email
    const [users] = await pool.execute(
      'SELECT id, email, password_hash, first_name, last_name, phone, role, is_active FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(400).json(
        createResponse(false, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      );
    }

    const user = users[0];

    // ตรวจสอบสถานะบัญชี
    if (!user.is_active) {
      return res.status(400).json(
        createResponse(false, 'บัญชีของคุณถูกระงับการใช้งาน')
      );
    }

    // ตรวจสอบรหัสผ่าน
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(400).json(
        createResponse(false, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      );
    }

    // สร้าง JWT token
    const token = generateToken(user.id, user.email, user.role);

    // ลบ password_hash ออกจาก response
    delete user.password_hash;

    res.json(
      createResponse(true, 'เข้าสู่ระบบสำเร็จ', {
        user,
        token
      })
    );

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ')
    );
  }
};

// ดูข้อมูลโปรไฟล์
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await pool.execute(
      'SELECT id, email, first_name, last_name, phone, role, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json(
        createResponse(false, 'ไม่พบข้อมูลผู้ใช้')
      );
    }

    res.json(
      createResponse(true, 'ดึงข้อมูลโปรไฟล์สำเร็จ', users[0])
    );

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์')
    );
  }
};

// อัปเดตข้อมูลโปรไฟล์
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { first_name, last_name, phone } = req.body;

    // อัปเดตข้อมูล
    await pool.execute(
      'UPDATE users SET first_name = ?, last_name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [first_name, last_name, phone, userId]
    );

    // ดึงข้อมูลที่อัปเดตแล้ว
    const [users] = await pool.execute(
      'SELECT id, email, first_name, last_name, phone, role, updated_at FROM users WHERE id = ?',
      [userId]
    );

    res.json(
      createResponse(true, 'อัปเดตโปรไฟล์สำเร็จ', users[0])
    );

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์')
    );
  }
};

// เปลี่ยนรหัสผ่าน
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password } = req.body;

    // ตรวจสอบรหัสผ่านปัจจุบัน
    const [users] = await pool.execute(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json(
        createResponse(false, 'ไม่พบข้อมูลผู้ใช้')
      );
    }

    const isCurrentPasswordValid = await comparePassword(current_password, users[0].password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json(
        createResponse(false, 'รหัสผ่านปัจจุบันไม่ถูกต้อง')
      );
    }

    // เข้ารหัสรหัสผ่านใหม่
    const hashedNewPassword = await hashPassword(new_password);

    // อัปเดตรหัสผ่าน
    await pool.execute(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedNewPassword, userId]
    );

    res.json(
      createResponse(true, 'เปลี่ยนรหัสผ่านสำเร็จ')
    );

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน')
    );
  }
};

// ดูรายการผู้ใช้ทั้งหมด (สำหรับ admin)
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, email, first_name, last_name, phone, role, is_active, created_at
      FROM users 
      WHERE 1=1
    `;
    let queryParams = [];

    // กรองตามบทบาท
    if (role) {
      query += ' AND role = ?';
      queryParams.push(role);
    }

    // ค้นหาตามชื่อหรืออีเมล
    if (search) {
      query += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    // นับจำนวนรวม
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as count_table`;
    const [countResult] = await pool.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // เพิ่มการจัดเรียงและ pagination
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));

    const [users] = await pool.execute(query, queryParams);

    res.json(
      createResponse(true, 'ดึงข้อมูลผู้ใช้สำเร็จ', {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          recordsPerPage: parseInt(limit)
        }
      })
    );

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้')
    );
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  getAllUsers
};
