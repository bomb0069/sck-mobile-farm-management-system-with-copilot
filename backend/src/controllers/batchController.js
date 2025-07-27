const { pool } = require('../config/database');
const { createResponse, getPaginationData, calculateBirdAge, calculateExpectedHarvestDate, formatDateForMySQL } = require('../utils/helpers');

// สร้างรอบการเลี้ยงใหม่
const createBatch = async (req, res) => {
  try {
    const farmId = req.params.farmId;
    const {
      batch_code,
      house_id,
      breed_id,
      bird_type,
      initial_count,
      placement_date,
      placement_age_days = 0,
      source_farm,
      cost_per_bird,
      notes
    } = req.body;

    // ตรวจสอบว่ารหัสรอบการเลี้ยงซ้ำในฟาร์มเดียวกันหรือไม่
    const [existingBatches] = await pool.execute(
      'SELECT id FROM batches WHERE farm_id = ? AND batch_code = ?',
      [farmId, batch_code]
    );

    if (existingBatches.length > 0) {
      return res.status(400).json(
        createResponse(false, 'รหัสรอบการเลี้ยงนี้ถูกใช้งานแล้วในฟาร์มนี้')
      );
    }

    // ตรวจสอบว่าโรงเรือนมีรอบการเลี้ยงที่ใช้งานอยู่หรือไม่
    const [activeBatches] = await pool.execute(
      'SELECT id FROM batches WHERE house_id = ? AND status = ?',
      [house_id, 'active']
    );

    if (activeBatches.length > 0) {
      return res.status(400).json(
        createResponse(false, 'โรงเรือนนี้มีรอบการเลี้ยงที่ใช้งานอยู่แล้ว')
      );
    }

    // ตรวจสอบความจุของโรงเรือน
    const [houses] = await pool.execute(
      'SELECT capacity FROM houses WHERE id = ? AND farm_id = ? AND is_active = true',
      [house_id, farmId]
    );

    if (houses.length === 0) {
      return res.status(400).json(
        createResponse(false, 'ไม่พบโรงเรือนที่ระบุ')
      );
    }

    if (initial_count > houses[0].capacity) {
      return res.status(400).json(
        createResponse(false, `จำนวนไก่เกินความจุของโรงเรือน (สูงสุด ${houses[0].capacity} ตัว)`)
      );
    }

    // คำนวณวันที่คาดการณ์จับไก่
    const expectedHarvestDate = calculateExpectedHarvestDate(placement_date, bird_type, placement_age_days);

    // บันทึกข้อมูลรอบการเลี้ยงใหม่
    const [result] = await pool.execute(
      `INSERT INTO batches (
        farm_id, house_id, batch_code, breed_id, bird_type, initial_count, current_count,
        placement_date, expected_harvest_date, placement_age_days, source_farm, cost_per_bird, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        farmId, house_id, batch_code, breed_id, bird_type, initial_count, initial_count,
        formatDateForMySQL(placement_date), expectedHarvestDate ? formatDateForMySQL(expectedHarvestDate) : null,
        placement_age_days, source_farm, cost_per_bird, notes
      ]
    );

    // ดึงข้อมูลรอบการเลี้ยงที่สร้างใหม่
    const [batches] = await pool.execute(
      `SELECT 
        b.*,
        h.house_code,
        h.name as house_name,
        br.name as breed_name,
        br.breed_type
      FROM batches b
      LEFT JOIN houses h ON b.house_id = h.id
      LEFT JOIN breeds br ON b.breed_id = br.id
      WHERE b.id = ?`,
      [result.insertId]
    );

    res.status(201).json(
      createResponse(true, 'สร้างรอบการเลี้ยงสำเร็จ', batches[0])
    );

  } catch (error) {
    console.error('Create batch error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการสร้างรอบการเลี้ยง')
    );
  }
};

// ดูรายการรอบการเลี้ยงในฟาร์ม
const getFarmBatches = async (req, res) => {
  try {
    const farmId = req.params.farmId;
    const { page = 1, limit = 10, status, bird_type, house_id } = req.query;

    let query = `
      SELECT 
        b.*,
        h.house_code,
        h.name as house_name,
        br.name as breed_name,
        br.breed_type,
        (b.initial_count - b.current_count) as mortality_count,
        DATEDIFF(COALESCE(b.actual_harvest_date, CURDATE()), b.placement_date) as days_in_production
      FROM batches b
      LEFT JOIN houses h ON b.house_id = h.id
      LEFT JOIN breeds br ON b.breed_id = br.id
      WHERE b.farm_id = ?
    `;
    let queryParams = [farmId];

    // กรองตามสถานะ
    if (status) {
      query += ' AND b.status = ?';
      queryParams.push(status);
    }

    // กรองตามประเภทไก่
    if (bird_type) {
      query += ' AND b.bird_type = ?';
      queryParams.push(bird_type);
    }

    // กรองตามโรงเรือน
    if (house_id) {
      query += ' AND b.house_id = ?';
      queryParams.push(house_id);
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
      createResponse(true, 'ดึงข้อมูลรอบการเลี้ยงสำเร็จ', {
        batches,
        pagination
      })
    );

  } catch (error) {
    console.error('Get farm batches error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการดึงข้อมูลรอบการเลี้ยง')
    );
  }
};

// ดูข้อมูลรอบการเลี้ยงเฉพาะ
const getBatchById = async (req, res) => {
  try {
    const batchId = req.params.id;

    const [batches] = await pool.execute(
      `SELECT 
        b.*,
        f.name as farm_name,
        h.house_code,
        h.name as house_name,
        h.capacity as house_capacity,
        br.name as breed_name,
        br.breed_type,
        br.fcr_standard,
        (b.initial_count - b.current_count) as total_mortality,
        DATEDIFF(COALESCE(b.actual_harvest_date, CURDATE()), b.placement_date) as days_in_production
      FROM batches b
      LEFT JOIN farms f ON b.farm_id = f.id
      LEFT JOIN houses h ON b.house_id = h.id
      LEFT JOIN breeds br ON b.breed_id = br.id
      WHERE b.id = ?`,
      [batchId]
    );

    if (batches.length === 0) {
      return res.status(404).json(
        createResponse(false, 'ไม่พบข้อมูลรอบการเลี้ยง')
      );
    }

    const batch = batches[0];

    // คำนวณข้อมูลเพิ่มเติม
    const currentAge = calculateBirdAge(batch.placement_date) + batch.placement_age_days;
    
    // ดึงสถิติการใช้อาหารและผลผลิต
    const [feedStats] = await pool.execute(
      `SELECT 
        COALESCE(SUM(feed_consumed_kg), 0) as total_feed_kg,
        COALESCE(AVG(feed_consumed_kg), 0) as avg_daily_feed,
        COUNT(*) as recorded_days
      FROM daily_records
      WHERE batch_id = ?`,
      [batchId]
    );

    // สำหรับไก่ไข่ - ดึงข้อมูลผลผลิตไข่
    let eggStats = null;
    if (batch.bird_type === 'layer') {
      const [eggData] = await pool.execute(
        `SELECT 
          COALESCE(SUM(total_eggs), 0) as total_eggs,
          COALESCE(AVG(total_eggs), 0) as avg_daily_eggs,
          COUNT(*) as production_days
        FROM egg_production
        WHERE batch_id = ?`,
        [batchId]
      );
      eggStats = eggData[0];
    }

    const batchData = {
      ...batch,
      current_age_days: currentAge,
      feed_statistics: feedStats[0],
      egg_statistics: eggStats
    };

    res.json(
      createResponse(true, 'ดึงข้อมูลรอบการเลี้ยงสำเร็จ', batchData)
    );

  } catch (error) {
    console.error('Get batch by id error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการดึงข้อมูลรอบการเลี้ยง')
    );
  }
};

// อัปเดตข้อมูลรอบการเลี้ยง
const updateBatch = async (req, res) => {
  try {
    const batchId = req.params.id;
    const {
      batch_code,
      breed_id,
      source_farm,
      cost_per_bird,
      notes
    } = req.body;

    // ตรวจสอบว่ารอบการเลี้ยงสามารถแก้ไขได้หรือไม่
    const [batches] = await pool.execute(
      'SELECT status, farm_id FROM batches WHERE id = ?',
      [batchId]
    );

    if (batches.length === 0) {
      return res.status(404).json(
        createResponse(false, 'ไม่พบข้อมูลรอบการเลี้ยง')
      );
    }

    if (batches[0].status !== 'active') {
      return res.status(400).json(
        createResponse(false, 'ไม่สามารถแก้ไขรอบการเลี้ยงที่ไม่ได้ใช้งานอยู่')
      );
    }

    // ตรวจสอบรหัสรอบการเลี้ยงซ้ำ (ยกเว้นรอบปัจจุบัน)
    if (batch_code) {
      const [existingBatches] = await pool.execute(
        'SELECT id FROM batches WHERE farm_id = ? AND batch_code = ? AND id != ?',
        [batches[0].farm_id, batch_code, batchId]
      );

      if (existingBatches.length > 0) {
        return res.status(400).json(
          createResponse(false, 'รหัสรอบการเลี้ยงนี้ถูกใช้งานแล้วในฟาร์มนี้')
        );
      }
    }

    // อัปเดตข้อมูล
    await pool.execute(
      `UPDATE batches SET 
        batch_code = COALESCE(?, batch_code),
        breed_id = COALESCE(?, breed_id),
        source_farm = COALESCE(?, source_farm),
        cost_per_bird = COALESCE(?, cost_per_bird),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [batch_code, breed_id, source_farm, cost_per_bird, notes, batchId]
    );

    // ดึงข้อมูลที่อัปเดตแล้ว
    const [updatedBatches] = await pool.execute(
      `SELECT 
        b.*,
        h.house_code,
        h.name as house_name,
        br.name as breed_name,
        br.breed_type
      FROM batches b
      LEFT JOIN houses h ON b.house_id = h.id
      LEFT JOIN breeds br ON b.breed_id = br.id
      WHERE b.id = ?`,
      [batchId]
    );

    res.json(
      createResponse(true, 'อัปเดตข้อมูลรอบการเลี้ยงสำเร็จ', updatedBatches[0])
    );

  } catch (error) {
    console.error('Update batch error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลรอบการเลี้ยง')
    );
  }
};

// จบรอบการเลี้ยง
const completeBatch = async (req, res) => {
  try {
    const batchId = req.params.id;
    const { actual_harvest_date, final_count, notes } = req.body;

    // ตรวจสอบสถานะรอบการเลี้ยง
    const [batches] = await pool.execute(
      'SELECT status FROM batches WHERE id = ?',
      [batchId]
    );

    if (batches.length === 0) {
      return res.status(404).json(
        createResponse(false, 'ไม่พบข้อมูลรอบการเลี้ยง')
      );
    }

    if (batches[0].status !== 'active') {
      return res.status(400).json(
        createResponse(false, 'รอบการเลี้ยงนี้ไม่ได้ใช้งานอยู่')
      );
    }

    // อัปเดตสถานะเป็น completed
    await pool.execute(
      `UPDATE batches SET 
        status = 'completed',
        actual_harvest_date = ?,
        current_count = COALESCE(?, current_count),
        notes = COALESCE(CONCAT(COALESCE(notes, ''), '\n--- จบรอบการเลี้ยง ---\n', ?), notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [formatDateForMySQL(actual_harvest_date), final_count, notes, batchId]
    );

    res.json(
      createResponse(true, 'จบรอบการเลี้ยงสำเร็จ')
    );

  } catch (error) {
    console.error('Complete batch error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการจบรอบการเลี้ยง')
    );
  }
};

module.exports = {
  createBatch,
  getFarmBatches,
  getBatchById,
  updateBatch,
  completeBatch
};
