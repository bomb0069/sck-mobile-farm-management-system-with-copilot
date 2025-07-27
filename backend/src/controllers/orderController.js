const { pool } = require('../config/database');
const { createResponse, getPaginationData, generateReferenceCode, formatDateForMySQL } = require('../utils/helpers');

// สร้างคำสั่งซื้อใหม่
const createOrder = async (req, res) => {
  try {
    const farmId = req.params.farmId;
    const {
      customer_id,
      order_number,
      order_date,
      delivery_date,
      items,
      discount_amount = 0,
      tax_amount = 0,
      delivery_address,
      delivery_notes,
      special_instructions
    } = req.body;

    // ตรวจสอบว่าหมายเลขคำสั่งซื้อซ้ำในฟาร์มเดียวกันหรือไม่
    const finalOrderNumber = order_number || generateReferenceCode('ORD');
    
    const [existingOrders] = await pool.execute(
      'SELECT id FROM customer_orders WHERE farm_id = ? AND order_number = ?',
      [farmId, finalOrderNumber]
    );

    if (existingOrders.length > 0) {
      return res.status(400).json(
        createResponse(false, 'หมายเลขคำสั่งซื้อนี้ถูกใช้งานแล้วในฟาร์มนี้')
      );
    }

    // ตรวจสอบว่าลูกค้าเป็นของฟาร์มนี้
    const [customers] = await pool.execute(
      'SELECT id, credit_limit, payment_terms_days FROM customers WHERE id = ? AND farm_id = ? AND is_active = true',
      [customer_id, farmId]
    );

    if (customers.length === 0) {
      return res.status(400).json(
        createResponse(false, 'ไม่พบลูกค้าในฟาร์มนี้')
      );
    }

    // คำนวณยอดรวม
    let total_amount = 0;
    for (const item of items) {
      total_amount += item.quantity * item.unit_price;
    }

    const net_amount = total_amount - (discount_amount || 0) + (tax_amount || 0);

    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // บันทึกคำสั่งซื้อ
      const [orderResult] = await connection.execute(
        `INSERT INTO customer_orders (
          farm_id, customer_id, order_number, order_date, delivery_date,
          total_amount, discount_amount, tax_amount, net_amount,
          delivery_address, delivery_notes, special_instructions, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          farmId, customer_id, finalOrderNumber, formatDateForMySQL(order_date), 
          delivery_date ? formatDateForMySQL(delivery_date) : null,
          total_amount, discount_amount || 0, tax_amount || 0, net_amount,
          delivery_address, delivery_notes, special_instructions, req.user.id
        ]
      );

      const orderId = orderResult.insertId;

      // บันทึกรายการสินค้า
      for (const item of items) {
        await connection.execute(
          `INSERT INTO order_items (
            order_id, product_type, product_name, product_description, grade,
            quantity, unit, unit_price, total_price, batch_id, harvest_date, quality_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId, item.product_type, item.product_name, item.product_description, item.grade,
            item.quantity, item.unit, item.unit_price, item.quantity * item.unit_price,
            item.batch_id || null, item.harvest_date ? formatDateForMySQL(item.harvest_date) : null, item.quality_notes
          ]
        );
      }

      await connection.commit();

      // ดึงข้อมูลคำสั่งซื้อที่สร้างใหม่
      const [orders] = await pool.execute(
        `SELECT 
          o.*,
          c.customer_code,
          COALESCE(c.company_name, CONCAT(c.first_name, ' ', c.last_name)) as customer_name
        FROM customer_orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.id = ?`,
        [orderId]
      );

      res.status(201).json(
        createResponse(true, 'สร้างคำสั่งซื้อสำเร็จ', orders[0])
      );

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการสร้างคำสั่งซื้อ')
    );
  }
};

// ดูรายการคำสั่งซื้อในฟาร์ม
const getFarmOrders = async (req, res) => {
  try {
    const farmId = req.params.farmId;
    const { page = 1, limit = 10, status, customer_id, date_from, date_to, payment_status } = req.query;

    let query = `
      SELECT 
        o.*,
        c.customer_code,
        COALESCE(c.company_name, CONCAT(c.first_name, ' ', c.last_name)) as customer_name,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
      FROM customer_orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.farm_id = ?
    `;
    let queryParams = [farmId];

    // กรองตามสถานะ
    if (status) {
      query += ' AND o.status = ?';
      queryParams.push(status);
    }

    // กรองตามลูกค้า
    if (customer_id) {
      query += ' AND o.customer_id = ?';
      queryParams.push(customer_id);
    }

    // กรองตามสถานะการชำระเงิน
    if (payment_status) {
      query += ' AND o.payment_status = ?';
      queryParams.push(payment_status);
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
      createResponse(true, 'ดึงข้อมูลคำสั่งซื้อสำเร็จ', {
        orders,
        pagination
      })
    );

  } catch (error) {
    console.error('Get farm orders error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการดึงข้อมูลคำสั่งซื้อ')
    );
  }
};

// ดูข้อมูลคำสั่งซื้อเฉพาะ
const getOrderById = async (req, res) => {
  try {
    const orderId = req.params.id;

    const [orders] = await pool.execute(
      `SELECT 
        o.*,
        f.name as farm_name,
        c.customer_code,
        c.customer_type,
        COALESCE(c.company_name, CONCAT(c.first_name, ' ', c.last_name)) as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        u.first_name as created_by_name
      FROM customer_orders o
      LEFT JOIN farms f ON o.farm_id = f.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.id = ?`,
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json(
        createResponse(false, 'ไม่พบข้อมูลคำสั่งซื้อ')
      );
    }

    // ดึงรายการสินค้า
    const [orderItems] = await pool.execute(
      `SELECT 
        oi.*,
        b.batch_code,
        b.bird_type
      FROM order_items oi
      LEFT JOIN batches b ON oi.batch_id = b.id
      WHERE oi.order_id = ?
      ORDER BY oi.id`,
      [orderId]
    );

    // ดึงประวัติการชำระเงิน
    const [payments] = await pool.execute(
      `SELECT 
        p.*,
        u.first_name as received_by_name
      FROM customer_payments p
      LEFT JOIN users u ON p.received_by = u.id
      WHERE p.order_id = ?
      ORDER BY p.payment_date DESC`,
      [orderId]
    );

    const orderData = {
      ...orders[0],
      items: orderItems,
      payments: payments
    };

    res.json(
      createResponse(true, 'ดึงข้อมูลคำสั่งซื้อสำเร็จ', orderData)
    );

  } catch (error) {
    console.error('Get order by id error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการดึงข้อมูลคำสั่งซื้อ')
    );
  }
};

// อัปเดตสถานะคำสั่งซื้อ
const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status, notes } = req.body;

    // ตรวจสอบสถานะที่ถูกต้อง
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json(
        createResponse(false, 'สถานะไม่ถูกต้อง')
      );
    }

    // อัปเดตสถานะ
    await pool.execute(
      `UPDATE customer_orders SET 
        status = ?,
        special_instructions = CASE 
          WHEN ? IS NOT NULL THEN CONCAT(COALESCE(special_instructions, ''), '\n--- อัปเดตสถานะ ---\n', ?)
          ELSE special_instructions
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [status, notes, notes, orderId]
    );

    res.json(
      createResponse(true, 'อัปเดตสถานะคำสั่งซื้อสำเร็จ')
    );

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการอัปเดตสถานะคำสั่งซื้อ')
    );
  }
};

// บันทึกการชำระเงิน
const recordPayment = async (req, res) => {
  try {
    const orderId = req.params.id;
    const {
      payment_number,
      payment_date,
      amount,
      payment_method,
      reference_number,
      notes
    } = req.body;

    // ดึงข้อมูลคำสั่งซื้อ
    const [orders] = await pool.execute(
      'SELECT farm_id, customer_id, net_amount FROM customer_orders WHERE id = ?',
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json(
        createResponse(false, 'ไม่พบข้อมูลคำสั่งซื้อ')
      );
    }

    const order = orders[0];
    const finalPaymentNumber = payment_number || generateReferenceCode('PAY');

    // ตรวจสอบว่าหมายเลขการชำระเงินซ้ำในฟาร์มเดียวกันหรือไม่
    const [existingPayments] = await pool.execute(
      'SELECT id FROM customer_payments WHERE farm_id = ? AND payment_number = ?',
      [order.farm_id, finalPaymentNumber]
    );

    if (existingPayments.length > 0) {
      return res.status(400).json(
        createResponse(false, 'หมายเลขการชำระเงินนี้ถูกใช้งานแล้วในฟาร์มนี้')
      );
    }

    // บันทึกการชำระเงิน
    const [result] = await pool.execute(
      `INSERT INTO customer_payments (
        farm_id, customer_id, order_id, payment_number, payment_date,
        amount, payment_method, reference_number, notes, received_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.farm_id, order.customer_id, orderId, finalPaymentNumber, formatDateForMySQL(payment_date),
        amount, payment_method, reference_number, notes, req.user.id
      ]
    );

    // คำนวณยอดที่ชำระแล้วทั้งหมด
    const [paymentSums] = await pool.execute(
      'SELECT COALESCE(SUM(amount), 0) as total_paid FROM customer_payments WHERE order_id = ?',
      [orderId]
    );

    const totalPaid = paymentSums[0].total_paid;
    let paymentStatus = 'unpaid';

    if (totalPaid >= order.net_amount) {
      paymentStatus = 'paid';
    } else if (totalPaid > 0) {
      paymentStatus = 'partial';
    }

    // อัปเดตสถานะการชำระเงินของคำสั่งซื้อ
    await pool.execute(
      'UPDATE customer_orders SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [paymentStatus, orderId]
    );

    // ดึงข้อมูลการชำระเงินที่บันทึกใหม่
    const [payments] = await pool.execute(
      'SELECT * FROM customer_payments WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(
      createResponse(true, 'บันทึกการชำระเงินสำเร็จ', payments[0])
    );

  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json(
      createResponse(false, 'เกิดข้อผิดพลาดในการบันทึกการชำระเงิน')
    );
  }
};

module.exports = {
  createOrder,
  getFarmOrders,
  getOrderById,
  updateOrderStatus,
  recordPayment
};
