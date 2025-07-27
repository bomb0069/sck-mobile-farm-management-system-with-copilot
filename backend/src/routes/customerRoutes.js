const express = require('express');
const router = express.Router({ mergeParams: true });
const customerController = require('../controllers/customerController');
const { authenticateToken, checkFarmOwnership } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

// Routes สำหรับการจัดการลูกค้า (ภายใต้ฟาร์ม)
router.post('/', 
  authenticateToken, 
  checkFarmOwnership, 
  customerController.createCustomer
);

router.get('/', 
  authenticateToken, 
  checkFarmOwnership, 
  customerController.getFarmCustomers
);

router.get('/stats', 
  authenticateToken, 
  checkFarmOwnership, 
  customerController.getCustomerStats
);

router.get('/:id', 
  authenticateToken, 
  customerController.getCustomerById
);

router.put('/:id', 
  authenticateToken, 
  customerController.updateCustomer
);

router.delete('/:id', 
  authenticateToken, 
  customerController.deleteCustomer
);

router.get('/:id/orders', 
  authenticateToken, 
  customerController.getCustomerOrderHistory
);

module.exports = router;
