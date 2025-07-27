const express = require('express');
const router = express.Router({ mergeParams: true });
const orderController = require('../controllers/orderController');
const { authenticateToken, checkFarmOwnership } = require('../middleware/auth');

// Routes สำหรับการจัดการคำสั่งซื้อ (ภายใต้ฟาร์ม)
router.post('/', 
  authenticateToken, 
  checkFarmOwnership, 
  orderController.createOrder
);

router.get('/', 
  authenticateToken, 
  checkFarmOwnership, 
  orderController.getFarmOrders
);

router.get('/:id', 
  authenticateToken, 
  orderController.getOrderById
);

router.put('/:id/status', 
  authenticateToken, 
  orderController.updateOrderStatus
);

router.post('/:id/payments', 
  authenticateToken, 
  orderController.recordPayment
);

module.exports = router;
