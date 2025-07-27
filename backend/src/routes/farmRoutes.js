const express = require('express');
const router = express.Router();
const farmController = require('../controllers/farmController');
const houseRoutes = require('./houseRoutes');
const batchRoutes = require('./batchRoutes');
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

// Nested routes สำหรับโรงเรือนและรอบการเลี้ยง
router.use('/:farmId/houses', houseRoutes);
router.use('/:farmId/batches', batchRoutes);

module.exports = router;
