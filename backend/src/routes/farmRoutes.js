const express = require('express');
const router = express.Router();
const farmController = require('../controllers/farmController');
const houseRoutes = require('./houseRoutes');
const batchRoutes = require('./batchRoutes');
const customerRoutes = require('./customerRoutes');
const orderRoutes = require('./orderRoutes');
const { authenticateToken, checkFarmOwnership } = require('../middleware/auth');
const { validateRequest, farmCreationSchema, farmUpdateSchema } = require('../middleware/validation');

// Routes สำหรับการจัดการฟาร์ม
router.post('/', 
  authenticateToken, 
  validateRequest(farmCreationSchema), 
  farmController.createFarm
);

router.get('/', 
  authenticateToken, 
  farmController.getUserFarms
);

router.get('/:id', 
  authenticateToken, 
  checkFarmOwnership, 
  farmController.getFarmById
);

router.put('/:id', 
  authenticateToken, 
  checkFarmOwnership, 
  validateRequest(farmUpdateSchema), 
  farmController.updateFarm
);

router.delete('/:id', 
  authenticateToken, 
  checkFarmOwnership, 
  farmController.deleteFarm
);

router.get('/:id/dashboard', 
  authenticateToken, 
  checkFarmOwnership, 
  farmController.getFarmDashboard
);

// Nested routes สำหรับโรงเรือน รอบการเลี้ยง ลูกค้า และคำสั่งซื้อ
router.use('/:farmId/houses', houseRoutes);
router.use('/:farmId/batches', batchRoutes);
router.use('/:farmId/customers', customerRoutes);
router.use('/:farmId/orders', orderRoutes);

module.exports = router;
