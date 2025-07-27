const { pool } = require('../config/database');
const { createResponse, getPaginationData, generateReferenceCode } = require('../utils/helpers');

// สร้างลูกค้าใหม่
const createCustomer = async (req, res) => {
  try {
    const farmId = req.params.farmId;
    const {
      customer_code,
      customer_type,
      company_name,
      contact_person,
      first_name,
      last_name,
      phone,
      email,
      address,
      province,
      district,
      subdistrict,
      postal_code,
      tax_id,
      credit_limit,
      payment_terms_days,
      discount_percent,
      preferred_products,
      delivery_address,
      delivery_notes
    } = req.body;

    // ตรวจสอบว่ารหัสลูกค้าซ้ำในฟาร์มเดียวกันหรือไม่
    const [existingCustomers] = await pool.execute(
      'SELECT id FROM customers WHERE farm_id = ? AND customer_code = ? AND is_active = true',
      [farmId, customer_code]
    );

    if (existingCustomers.length > 0) {
      return res.status(400).json(
        createResponse(false, 'รหัสลูกค้านี้ถูกใช้งานแล้วในฟาร์มนี้')
      );
    }

    // สร้างรหัสลูกค้าอัตโนมัติถ้าไม่ได้ระบุ
    const finalCustomerCode = customer_code || generateReferenceCode('CUST');

    // บันทึกข้อมูลลูกค้าใหม่
    const [result] = await pool.execute(
      `INSERT INTO customers (
        farm_id, customer_code, customer_type, company_name, contact_person,
        first_name, last_name, phone, email, address, province, district,
        subdistrict, postal_code, tax_id, credit_limit, payment_terms_days,
        discount_percent, preferred_products, delivery_address, delivery_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        farmId, finalCustomerCode, customer_type, company_name, contact_person,
        first_name, last_name, phone, email, address, province, district,
        subdistrict, postal_code, tax_id, credit_limit || 0, payment_terms_days || 0,
        discount_percent || 0, JSON.stringify(preferred_products || []), delivery_address, delivery_notes
      ]
    );

    // ดึงข้อมูลลูกค้าที่สร้างใหม่
    const [customers] = await pool.execute(
      'SELECT * FROM customers WHERE id = ?',
      [result.insertId]
    );

    const customer = customers[0];
    if (customer.preferred_products) {
      customer.preferred_products = JSON.parse(customer.preferred_products);
    }

    res.status(201).json(
      createResponse(true, 'สร้างลูกค้าสำเร็จ', customer)
    );

  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการสร้างลูกค้า')
    );
  }
};

// ดูรายการลูกค้าในฟาร์ม
const getFarmCustomers = async (req, res) => {
  try {
    const farmId = req.params.farmId;
    const { page = 1, limit = 10, customer_type, search, is_active = 'true' } = req.query;

    let query = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM customer_orders o WHERE o.customer_id = c.id) as total_orders,
        (SELECT COALESCE(SUM(o.net_amount), 0) FROM customer_orders o WHERE o.customer_id = c.id) as total_spent,
        (SELECT o.order_date FROM customer_orders o WHERE o.customer_id = c.id ORDER BY o.order_date DESC LIMIT 1) as last_order_date
      FROM customers c
      WHERE c.farm_id = ?
    `;
    let queryParams = [farmId];

    // กรองตามสถานะ
    if (is_active !== 'all') {
      query += ' AND c.is_active = ?';
      queryParams.push(is_active === 'true');
    }

    // กรองตามประเภทลูกค้า
    if (customer_type) {
      query += ' AND c.customer_type = ?';
      queryParams.push(customer_type);
    }

    // ค้นหาตามชื่อหรือรหัสลูกค้า
    if (search) {
      query += ` AND (c.customer_code LIKE ? OR c.company_name LIKE ? OR 
                 c.contact_person LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)`;
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // นับจำนวนรวม
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as count_table`;
    const [countResult] = await pool.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // เพิ่มการจัดเรียงและ pagination
    const offset = (page - 1) * limit;
    query += ' ORDER BY c.customer_code LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));

    const [customers] = await pool.execute(query, queryParams);

    // แปลง JSON strings
    customers.forEach(customer => {
      if (customer.preferred_products) {
        customer.preferred_products = JSON.parse(customer.preferred_products);
      }
    });

    const pagination = getPaginationData(parseInt(page), parseInt(limit), total);

    res.json(
      createResponse(true, 'ดึงข้อมูลลูกค้าสำเร็จ', {
        customers,
        pagination
      })
    );

  } catch (error) {
    console.error('Get farm customers error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการดึงข้อมูลลูกค้า')
    );
  }
};

// ดูข้อมูลลูกค้าเฉพาะ
const getCustomerById = async (req, res) => {
  try {
    const customerId = req.params.id;

    const [customers] = await pool.execute(
      `SELECT 
        c.*,
        f.name as farm_name,
        (SELECT COUNT(*) FROM customer_orders o WHERE o.customer_id = c.id) as total_orders,
        (SELECT COUNT(*) FROM customer_orders o WHERE o.customer_id = c.id AND o.status = 'pending') as pending_orders,
        (SELECT COALESCE(SUM(o.net_amount), 0) FROM customer_orders o WHERE o.customer_id = c.id) as total_spent,
        (SELECT COALESCE(SUM(o.net_amount), 0) FROM customer_orders o WHERE o.customer_id = c.id AND o.payment_status != 'paid') as outstanding_amount
      FROM customers c
      LEFT JOIN farms f ON c.farm_id = f.id
      WHERE c.id = ? AND c.is_active = true`,
      [customerId]
    );

    if (customers.length === 0) {
      return res.status(404).json(
        createResponse(false, 'ไม่พบข้อมูลลูกค้า')
      );
    }

    const customer = customers[0];
    if (customer.preferred_products) {
      customer.preferred_products = JSON.parse(customer.preferred_products);
    }

    // ดึงคำสั่งซื้อล่าสุด 5 รายการ
    const [recentOrders] = await pool.execute(
      `SELECT id, order_number, order_date, status, net_amount, payment_status
       FROM customer_orders 
       WHERE customer_id = ? 
       ORDER BY order_date DESC 
       LIMIT 5`,
      [customerId]
    );

    // ดึงการติดต่อสื่อสารล่าสุด 5 รายการ
    const [recentCommunications] = await pool.execute(
      `SELECT id, communication_type, subject, communication_date, status, priority
       FROM customer_communications 
       WHERE customer_id = ? 
       ORDER BY communication_date DESC 
       LIMIT 5`,
      [customerId]
    );

    const customerData = {
      ...customer,
      recent_orders: recentOrders,
      recent_communications: recentCommunications
    };

    res.json(
      createResponse(true, 'ดึงข้อมูลลูกค้าสำเร็จ', customerData)
    );

  } catch (error) {
    console.error('Get customer by id error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการดึงข้อมูลลูกค้า')
    );
  }
};

// อัปเดตข้อมูลลูกค้า
const updateCustomer = async (req, res) => {
  try {
    const customerId = req.params.id;
    const {
      customer_code,
      customer_type,
      company_name,
      contact_person,
      first_name,
      last_name,
      phone,
      email,
      address,
      province,
      district,
      subdistrict,
      postal_code,
      tax_id,
      credit_limit,
      payment_terms_days,
      discount_percent,
      preferred_products,
      delivery_address,
      delivery_notes
    } = req.body;

    // ตรวจสอบว่ารหัสลูกค้าซ้ำในฟาร์มเดียวกันหรือไม่ (ยกเว้นลูกค้าปัจจุบัน)
    const [existingCustomers] = await pool.execute(
      `SELECT c1.id FROM customers c1 
       JOIN customers c2 ON c1.farm_id = c2.farm_id 
       WHERE c1.customer_code = ? AND c1.is_active = true AND c1.id != ? AND c2.id = ?`,
      [customer_code, customerId, customerId]
    );

    if (existingCustomers.length > 0) {
      return res.status(400).json(
        createResponse(false, 'รหัสลูกค้านี้ถูกใช้งานแล้วในฟาร์มนี้')
      );
    }

    // อัปเดตข้อมูล
    await pool.execute(
      `UPDATE customers SET 
        customer_code = ?, customer_type = ?, company_name = ?, contact_person = ?,
        first_name = ?, last_name = ?, phone = ?, email = ?, address = ?,
        province = ?, district = ?, subdistrict = ?, postal_code = ?, tax_id = ?,
        credit_limit = ?, payment_terms_days = ?, discount_percent = ?,
        preferred_products = ?, delivery_address = ?, delivery_notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        customer_code, customer_type, company_name, contact_person,
        first_name, last_name, phone, email, address,
        province, district, subdistrict, postal_code, tax_id,
        credit_limit || 0, payment_terms_days || 0, discount_percent || 0,
        JSON.stringify(preferred_products || []), delivery_address, delivery_notes,
        customerId
      ]
    );

    // ดึงข้อมูลที่อัปเดตแล้ว
    const [customers] = await pool.execute(
      'SELECT * FROM customers WHERE id = ?',
      [customerId]
    );

    const customer = customers[0];
    if (customer.preferred_products) {
      customer.preferred_products = JSON.parse(customer.preferred_products);
    }

    res.json(
      createResponse(true, 'อัปเดตข้อมูลลูกค้าสำเร็จ', customer)
    );

  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลลูกค้า')
    );
  }
};

// ลบลูกค้า (soft delete)
const deleteCustomer = async (req, res) => {
  try {
    const customerId = req.params.id;

    // ตรวจสอบว่ามีคำสั่งซื้อที่ยังไม่เสร็จสิ้นหรือไม่
    const [activeOrders] = await pool.execute(
      'SELECT COUNT(*) as count FROM customer_orders WHERE customer_id = ? AND status NOT IN (?, ?)',
      [customerId, 'delivered', 'cancelled']
    );

    if (activeOrders[0].count > 0) {
      return res.status(400).json(
        createResponse(false, 'ไม่สามารถลบลูกค้าที่มีคำสั่งซื้อที่ยังไม่เสร็จสิ้น')
      );
    }

    // ทำ soft delete
    await pool.execute(
      'UPDATE customers SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [customerId]
    );

    res.json(
      createResponse(true, 'ลบลูกค้าสำเร็จ')
    );

  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการลบลูกค้า')
    );
  }
};

// ดูประวัติคำสั่งซื้อของลูกค้า
const getCustomerOrderHistory = async (req, res) => {
  try {
    const customerId = req.params.id;
    const { page = 1, limit = 10, status, date_from, date_to } = req.query;

    let query = `
      SELECT 
        o.*,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
      FROM customer_orders o
      WHERE o.customer_id = ?
    `;
    let queryParams = [customerId];

    // กรองตามสถานะ
    if (status) {
      query += ' AND o.status = ?';
      queryParams.push(status);
    }

    // กรองตามช่วงวันที่
    if (date_from) {
      query += ' AND o.order_date >= ?';
      queryParams.push(date_from);
    }

    if (date_to) {
      query += ' AND o.order_date <= ?';
      queryParams.push(date_to);
    }

    // นับจำนวนรวม
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as count_table`;
    const [countResult] = await pool.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // เพิ่มการจัดเรียงและ pagination
    const offset = (page - 1) * limit;
    query += ' ORDER BY o.order_date DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));

    const [orders] = await pool.execute(query, queryParams);

    const pagination = getPaginationData(parseInt(page), parseInt(limit), total);

    res.json(
      createResponse(true, 'ดึงประวัติคำสั่งซื้อสำเร็จ', {
        orders,
        pagination
      })
    );

  } catch (error) {
    console.error('Get customer order history error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการดึงประวัติคำสั่งซื้อ')
    );
  }
};

// ดูสถิติลูกค้า
const getCustomerStats = async (req, res) => {
  try {
    const farmId = req.params.farmId;

    // สถิติทั่วไป
    const [generalStats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_customers,
        COUNT(CASE WHEN customer_type = 'individual' THEN 1 END) as individual_customers,
        COUNT(CASE WHEN customer_type = 'company' THEN 1 END) as company_customers,
        COUNT(CASE WHEN customer_type = 'restaurant' THEN 1 END) as restaurant_customers,
        COUNT(CASE WHEN customer_type = 'distributor' THEN 1 END) as distributor_customers,
        COUNT(CASE WHEN customer_type = 'retail' THEN 1 END) as retail_customers
      FROM customers 
      WHERE farm_id = ? AND is_active = true`,
      [farmId]
    );

    // สถิติคำสั่งซื้อ
    const [orderStats] = await pool.execute(
      `SELECT 
        COUNT(o.id) as total_orders,
        COALESCE(SUM(o.net_amount), 0) as total_revenue,
        COALESCE(AVG(o.net_amount), 0) as average_order_value,
        COUNT(DISTINCT o.customer_id) as customers_with_orders
      FROM customer_orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE c.farm_id = ?`,
      [farmId]
    );

    // ลูกค้าที่ซื้อมากที่สุด 5 อันดับ
    const [topCustomers] = await pool.execute(
      `SELECT 
        c.customer_code,
        COALESCE(c.company_name, CONCAT(c.first_name, ' ', c.last_name)) as customer_name,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.net_amount), 0) as total_spent
      FROM customers c
      LEFT JOIN customer_orders o ON c.id = o.customer_id
      WHERE c.farm_id = ? AND c.is_active = true
      GROUP BY c.id
      ORDER BY total_spent DESC
      LIMIT 5`,
      [farmId]
    );

    const statsData = {
      general_stats: generalStats[0],
      order_stats: orderStats[0],
      top_customers: topCustomers
    };

    res.json(
      createResponse(true, 'ดึงสถิติลูกค้าสำเร็จ', statsData)
    );

  } catch (error) {
    console.error('Get customer stats error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการดึงสถิติลูกค้า')
    );
  }
};

module.exports = {
  createCustomer,
  getFarmCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  getCustomerOrderHistory,
  getCustomerStats
};
