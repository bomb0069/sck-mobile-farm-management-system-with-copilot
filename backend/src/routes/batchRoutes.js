const express = require('express');
const router = express.Router({ mergeParams: true });
const batchController = require('../controllers/batchController');
const { authenticateToken, checkFarmOwnership } = require('../middleware/auth');

// Routes สำหรับการจัดการรอบการเลี้ยง (ภายใต้ฟาร์ม)
router.post('/', 
  authenticateToken, 
  checkFarmOwnership, 
  batchController.createBatch
);

router.get('/', 
  authenticateToken, 
  checkFarmOwnership, 
  batchController.getFarmBatches
);

router.get('/:id', 
  authenticateToken, 
  batchController.getBatchById
);

router.put('/:id', 
  authenticateToken, 
  batchController.updateBatch
);

router.post('/:id/complete', 
  authenticateToken, 
  batchController.completeBatch
);

module.exports = router;
