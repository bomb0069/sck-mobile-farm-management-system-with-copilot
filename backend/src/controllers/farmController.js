const { pool } = require('../config/database');
const { createResponse, getPaginationData } = require('../utils/helpers');

// สร้างฟาร์มใหม่
const createFarm = async (req, res) => {
  try {
    const {
      name,
      address,
      province,
      district,
      subdistrict,
      postal_code,
      manager_name,
      phone,
      email,
      farm_type,
      license_number
    } = req.body;

    const owner_id = req.user.id;

    // บันทึกข้อมูลฟาร์มใหม่
    const [result] = await pool.execute(
      `INSERT INTO farms (
        name, address, province, district, subdistrict, postal_code,
        owner_id, manager_name, phone, email, farm_type, license_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, address, province, district, subdistrict, postal_code,
        owner_id, manager_name, phone, email, farm_type, license_number
      ]
    );

    // ดึงข้อมูลฟาร์มที่สร้างใหม่
    const [farms] = await pool.execute(
      'SELECT * FROM farms WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(
      createResponse(true, 'สร้างฟาร์มสำเร็จ', farms[0])
    );

  } catch (error) {
    console.error('Create farm error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการสร้างฟาร์ม')
    );
  }
};

// ดูรายการฟาร์มของผู้ใช้
const getUserFarms = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, farm_type, search } = req.query;

    let query = `
      SELECT 
        f.*,
        (SELECT COUNT(*) FROM houses h WHERE h.farm_id = f.id AND h.is_active = true) as house_count,
        (SELECT COUNT(*) FROM batches b WHERE b.farm_id = f.id AND b.status = 'active') as active_batch_count
      FROM farms f
      WHERE f.owner_id = ? AND f.is_active = true
    `;
    let queryParams = [userId];

    // กรองตามประเภทฟาร์ม
    if (farm_type) {
      query += ' AND f.farm_type = ?';
      queryParams.push(farm_type);
    }

    // ค้นหาตามชื่อฟาร์ม
    if (search) {
      query += ' AND f.name LIKE ?';
      queryParams.push(`%${search}%`);
    }

    // นับจำนวนรวม
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as count_table`;
    const [countResult] = await pool.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // เพิ่มการจัดเรียงและ pagination
    const offset = (page - 1) * limit;
    query += ' ORDER BY f.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));

    const [farms] = await pool.execute(query, queryParams);

    const pagination = getPaginationData(parseInt(page), parseInt(limit), total);

    res.json(
      createResponse(true, 'ดึงข้อมูลฟาร์มสำเร็จ', {
        farms,
        pagination
      })
    );

  } catch (error) {
    console.error('Get user farms error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการดึงข้อมูลฟาร์ม')
    );
  }
};

// ดูข้อมูลฟาร์มเฉพาะ
const getFarmById = async (req, res) => {
  try {
    const farmId = req.params.id;

    const [farms] = await pool.execute(
      `SELECT 
        f.*,
        u.first_name as owner_first_name,
        u.last_name as owner_last_name,
        (SELECT COUNT(*) FROM houses h WHERE h.farm_id = f.id AND h.is_active = true) as house_count,
        (SELECT COUNT(*) FROM batches b WHERE b.farm_id = f.id AND b.status = 'active') as active_batch_count,
        (SELECT COUNT(*) FROM batches b WHERE b.farm_id = f.id AND b.status = 'completed') as completed_batch_count
      FROM farms f
      LEFT JOIN users u ON f.owner_id = u.id
      WHERE f.id = ? AND f.is_active = true`,
      [farmId]
    );

    if (farms.length === 0) {
      return res.status(404).json(
        createResponse(false, 'ไม่พบข้อมูลฟาร์ม')
      );
    }

    res.json(
      createResponse(true, 'ดึงข้อมูลฟาร์มสำเร็จ', farms[0])
    );

  } catch (error) {
    console.error('Get farm by id error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการดึงข้อมูลฟาร์ม')
    );
  }
};

// อัปเดตข้อมูลฟาร์ม
const updateFarm = async (req, res) => {
  try {
    const farmId = req.params.id;
    const {
      name,
      address,
      province,
      district,
      subdistrict,
      postal_code,
      manager_name,
      phone,
      email,
      farm_type,
      license_number
    } = req.body;

    // อัปเดตข้อมูล
    await pool.execute(
      `UPDATE farms SET 
        name = ?, address = ?, province = ?, district = ?, subdistrict = ?, 
        postal_code = ?, manager_name = ?, phone = ?, email = ?, 
        farm_type = ?, license_number = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        name, address, province, district, subdistrict, postal_code,
        manager_name, phone, email, farm_type, license_number, farmId
      ]
    );

    // ดึงข้อมูลที่อัปเดตแล้ว
    const [farms] = await pool.execute(
      'SELECT * FROM farms WHERE id = ?',
      [farmId]
    );

    res.json(
      createResponse(true, 'อัปเดตข้อมูลฟาร์มสำเร็จ', farms[0])
    );

  } catch (error) {
    console.error('Update farm error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลฟาร์ม')
    );
  }
};

// ลบฟาร์ม (soft delete)
const deleteFarm = async (req, res) => {
  try {
    const farmId = req.params.id;

    // ตรวจสอบว่ามีรอบการเลี้ยงที่ยังใช้งานอยู่หรือไม่
    const [activeBatches] = await pool.execute(
      'SELECT COUNT(*) as count FROM batches WHERE farm_id = ? AND status = ?',
      [farmId, 'active']
    );

    if (activeBatches[0].count > 0) {
      return res.status(400).json(
        createResponse(false, 'ไม่สามารถลบฟาร์มที่มีรอบการเลี้ยงที่ยังใช้งานอยู่')
      );
    }

    // ทำ soft delete
    await pool.execute(
      'UPDATE farms SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [farmId]
    );

    res.json(
      createResponse(true, 'ลบฟาร์มสำเร็จ')
    );

  } catch (error) {
    console.error('Delete farm error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการลบฟาร์ม')
    );
  }
};

// ดู Dashboard ข้อมูลสรุปของฟาร์ม
const getFarmDashboard = async (req, res) => {
  try {
    const farmId = req.params.id;

    // ข้อมูลสรุปโรงเรือน
    const [houseStats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_houses,
        SUM(capacity) as total_capacity,
        SUM(area_sqm) as total_area
      FROM houses 
      WHERE farm_id = ? AND is_active = true`,
      [farmId]
    );

    // ข้อมูลสรุปรอบการเลี้ยง
    const [batchStats] = await pool.execute(
      `SELECT 
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_batches,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_batches,
        SUM(CASE WHEN status = 'active' THEN current_count ELSE 0 END) as total_birds
      FROM batches 
      WHERE farm_id = ?`,
      [farmId]
    );

    // ข้อมูลผลผลิตรายเดือน (30 วันล่าสุด)
    const [productionStats] = await pool.execute(
      `SELECT 
        COALESCE(SUM(ep.total_eggs), 0) as total_eggs_30days,
        COALESCE(AVG(ep.total_eggs), 0) as avg_eggs_per_day
      FROM egg_production ep
      JOIN batches b ON ep.batch_id = b.id
      WHERE b.farm_id = ? AND ep.production_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
      [farmId]
    );

    // ข้อมูลการใช้อาหาร (30 วันล่าสุด)
    const [feedStats] = await pool.execute(
      `SELECT 
        COALESCE(SUM(dr.feed_consumed_kg), 0) as total_feed_30days,
        COALESCE(AVG(dr.feed_consumed_kg), 0) as avg_feed_per_day
      FROM daily_records dr
      JOIN batches b ON dr.batch_id = b.id
      WHERE b.farm_id = ? AND dr.record_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
      [farmId]
    );

    // รายการโรงเรือนที่มีรอบการเลี้ยงใช้งานอยู่
    const [activeHouses] = await pool.execute(
      `SELECT 
        h.id, h.house_code, h.name, h.capacity,
        b.id as batch_id, b.batch_code, b.current_count, b.placement_date,
        br.name as breed_name, b.bird_type
      FROM houses h
      LEFT JOIN batches b ON h.id = b.house_id AND b.status = 'active'
      LEFT JOIN breeds br ON b.breed_id = br.id
      WHERE h.farm_id = ? AND h.is_active = true
      ORDER BY h.house_code`,
      [farmId]
    );

    const dashboardData = {
      house_stats: houseStats[0],
      batch_stats: batchStats[0],
      production_stats: productionStats[0],
      feed_stats: feedStats[0],
      active_houses: activeHouses
    };

    res.json(
      createResponse(true, 'ดึงข้อมูล Dashboard สำเร็จ', dashboardData)
    );

  } catch (error) {
    console.error('Get farm dashboard error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการดึงข้อมูล Dashboard')
    );
  }
};

module.exports = {
  createFarm,
  getUserFarms,
  getFarmById,
  updateFarm,
  deleteFarm,
  getFarmDashboard
};
