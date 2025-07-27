const { pool } = require('../config/database');
const { createResponse, getPaginationData } = require('../utils/helpers');

// สร้างโรงเรือนใหม่
const createHouse = async (req, res) => {
  try {
    const farmId = req.params.farmId;
    const {
      house_code,
      name,
      house_type,
      capacity,
      area_sqm,
      width_meters,
      length_meters,
      height_meters,
      ventilation_type
    } = req.body;

    // ตรวจสอบว่ารหัสโรงเรือนซ้ำในฟาร์มเดียวกันหรือไม่
    const [existingHouses] = await pool.execute(
      'SELECT id FROM houses WHERE farm_id = ? AND house_code = ? AND is_active = true',
      [farmId, house_code]
    );

    if (existingHouses.length > 0) {
      return res.status(400).json(
        createResponse(false, 'รหัสโรงเรือนนี้ถูกใช้งานแล้วในฟาร์มนี้')
      );
    }

    // บันทึกข้อมูลโรงเรือนใหม่
    const [result] = await pool.execute(
      `INSERT INTO houses (
        farm_id, house_code, name, house_type, capacity, area_sqm,
        width_meters, length_meters, height_meters, ventilation_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        farmId, house_code, name, house_type, capacity, area_sqm,
        width_meters, length_meters, height_meters, ventilation_type
      ]
    );

    // ดึงข้อมูลโรงเรือนที่สร้างใหม่
    const [houses] = await pool.execute(
      'SELECT * FROM houses WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(
      createResponse(true, 'สร้างโรงเรือนสำเร็จ', houses[0])
    );

  } catch (error) {
    console.error('Create house error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการสร้างโรงเรือน')
    );
  }
};

// ดูรายการโรงเรือนในฟาร์ม
const getFarmHouses = async (req, res) => {
  try {
    const farmId = req.params.farmId;
    const { page = 1, limit = 10, house_type, search } = req.query;

    let query = `
      SELECT 
        h.*,
        b.id as current_batch_id,
        b.batch_code as current_batch_code,
        b.current_count as current_bird_count,
        b.bird_type as current_bird_type,
        b.status as batch_status,
        br.name as breed_name
      FROM houses h
      LEFT JOIN batches b ON h.id = b.house_id AND b.status = 'active'
      LEFT JOIN breeds br ON b.breed_id = br.id
      WHERE h.farm_id = ? AND h.is_active = true
    `;
    let queryParams = [farmId];

    // กรองตามประเภทโรงเรือน
    if (house_type) {
      query += ' AND h.house_type = ?';
      queryParams.push(house_type);
    }

    // ค้นหาตามรหัสหรือชื่อโรงเรือน
    if (search) {
      query += ' AND (h.house_code LIKE ? OR h.name LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    // นับจำนวนรวม
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as count_table`;
    const [countResult] = await pool.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // เพิ่มการจัดเรียงและ pagination
    const offset = (page - 1) * limit;
    query += ' ORDER BY h.house_code LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));

    const [houses] = await pool.execute(query, queryParams);

    const pagination = getPaginationData(parseInt(page), parseInt(limit), total);

    res.json(
      createResponse(true, 'ดึงข้อมูลโรงเรือนสำเร็จ', {
        houses,
        pagination
      })
    );

  } catch (error) {
    console.error('Get farm houses error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการดึงข้อมูลโรงเรือน')
    );
  }
};

// ดูข้อมูลโรงเรือนเฉพาะ
const getHouseById = async (req, res) => {
  try {
    const houseId = req.params.id;

    const [houses] = await pool.execute(
      `SELECT 
        h.*,
        f.name as farm_name,
        (SELECT COUNT(*) FROM batches WHERE house_id = h.id) as total_batches,
        (SELECT COUNT(*) FROM batches WHERE house_id = h.id AND status = 'active') as active_batches,
        (SELECT COUNT(*) FROM batches WHERE house_id = h.id AND status = 'completed') as completed_batches
      FROM houses h
      LEFT JOIN farms f ON h.farm_id = f.id
      WHERE h.id = ? AND h.is_active = true`,
      [houseId]
    );

    if (houses.length === 0) {
      return res.status(404).json(
        createResponse(false, 'ไม่พบข้อมูลโรงเรือน')
      );
    }

    // ดึงข้อมูลรอบการเลี้ยงปัจจุบัน
    const [currentBatch] = await pool.execute(
      `SELECT 
        b.*,
        br.name as breed_name,
        br.breed_type
      FROM batches b
      LEFT JOIN breeds br ON b.breed_id = br.id
      WHERE b.house_id = ? AND b.status = 'active'`,
      [houseId]
    );

    const houseData = {
      ...houses[0],
      current_batch: currentBatch.length > 0 ? currentBatch[0] : null
    };

    res.json(
      createResponse(true, 'ดึงข้อมูลโรงเรือนสำเร็จ', houseData)
    );

  } catch (error) {
    console.error('Get house by id error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการดึงข้อมูลโรงเรือน')
    );
  }
};

// อัปเดตข้อมูลโรงเรือน
const updateHouse = async (req, res) => {
  try {
    const houseId = req.params.id;
    const {
      house_code,
      name,
      house_type,
      capacity,
      area_sqm,
      width_meters,
      length_meters,
      height_meters,
      ventilation_type
    } = req.body;

    // ตรวจสอบว่ารหัสโรงเรือนซ้ำในฟาร์มเดียวกันหรือไม่ (ยกเว้นโรงเรือนปัจจุบัน)
    const [existingHouses] = await pool.execute(
      `SELECT h1.id FROM houses h1 
       JOIN houses h2 ON h1.farm_id = h2.farm_id 
       WHERE h1.house_code = ? AND h1.is_active = true AND h1.id != ? AND h2.id = ?`,
      [house_code, houseId, houseId]
    );

    if (existingHouses.length > 0) {
      return res.status(400).json(
        createResponse(false, 'รหัสโรงเรือนนี้ถูกใช้งานแล้วในฟาร์มนี้')
      );
    }

    // อัปเดตข้อมูล
    await pool.execute(
      `UPDATE houses SET 
        house_code = ?, name = ?, house_type = ?, capacity = ?, area_sqm = ?,
        width_meters = ?, length_meters = ?, height_meters = ?, ventilation_type = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        house_code, name, house_type, capacity, area_sqm,
        width_meters, length_meters, height_meters, ventilation_type, houseId
      ]
    );

    // ดึงข้อมูลที่อัปเดตแล้ว
    const [houses] = await pool.execute(
      'SELECT * FROM houses WHERE id = ?',
      [houseId]
    );

    res.json(
      createResponse(true, 'อัปเดตข้อมูลโรงเรือนสำเร็จ', houses[0])
    );

  } catch (error) {
    console.error('Update house error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลโรงเรือน')
    );
  }
};

// ลบโรงเรือน (soft delete)
const deleteHouse = async (req, res) => {
  try {
    const houseId = req.params.id;

    // ตรวจสอบว่ามีรอบการเลี้ยงที่ยังใช้งานอยู่หรือไม่
    const [activeBatches] = await pool.execute(
      'SELECT COUNT(*) as count FROM batches WHERE house_id = ? AND status = ?',
      [houseId, 'active']
    );

    if (activeBatches[0].count > 0) {
      return res.status(400).json(
        createResponse(false, 'ไม่สามารถลบโรงเรือนที่มีรอบการเลี้ยงที่ยังใช้งานอยู่')
      );
    }

    // ทำ soft delete
    await pool.execute(
      'UPDATE houses SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [houseId]
    );

    res.json(
      createResponse(true, 'ลบโรงเรือนสำเร็จ')
    );

  } catch (error) {
    console.error('Delete house error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการลบโรงเรือน')
    );
  }
};

// ดูประวัติรอบการเลี้ยงของโรงเรือน
const getHouseBatchHistory = async (req, res) => {
  try {
    const houseId = req.params.id;
    const { page = 1, limit = 10, status } = req.query;

    let query = `
      SELECT 
        b.*,
        br.name as breed_name,
        br.breed_type,
        (b.initial_count - b.current_count) as mortality_count,
        DATEDIFF(COALESCE(b.actual_harvest_date, CURDATE()), b.placement_date) as days_in_production
      FROM batches b
      LEFT JOIN breeds br ON b.breed_id = br.id
      WHERE b.house_id = ?
    `;
    let queryParams = [houseId];

    // กรองตามสถานะ
    if (status) {
      query += ' AND b.status = ?';
      queryParams.push(status);
    }

    // นับจำนวนรวม
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as count_table`;
    const [countResult] = await pool.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // เพิ่มการจัดเรียงและ pagination
    const offset = (page - 1) * limit;
    query += ' ORDER BY b.placement_date DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));

    const [batches] = await pool.execute(query, queryParams);

    const pagination = getPaginationData(parseInt(page), parseInt(limit), total);

    res.json(
      createResponse(true, 'ดึงประวัติรอบการเลี้ยงสำเร็จ', {
        batches,
        pagination
      })
    );

  } catch (error) {
    console.error('Get house batch history error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการดึงประวัติรอบการเลี้ยง')
    );
  }
};

module.exports = {
  createHouse,
  getFarmHouses,
  getHouseById,
  updateHouse,
  deleteHouse,
  getHouseBatchHistory
};
