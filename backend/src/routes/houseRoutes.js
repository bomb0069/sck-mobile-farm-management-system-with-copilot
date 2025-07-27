const express = require('express');
const router = express.Router({ mergeParams: true });
const houseController = require('../controllers/houseController');
const { authenticateToken, checkFarmOwnership } = require('../middleware/auth');

// Routes สำหรับการจัดการโรงเรือน (ภายใต้ฟาร์ม)
router.post('/', 
  authenticateToken, 
  checkFarmOwnership, 
  houseController.createHouse
);

router.get('/', 
  authenticateToken, 
  checkFarmOwnership, 
  houseController.getFarmHouses
);

router.get('/:id', 
  authenticateToken, 
  houseController.getHouseById
);

router.put('/:id', 
  authenticateToken, 
  houseController.updateHouse
);

router.delete('/:id', 
  authenticateToken, 
  houseController.deleteHouse
);

router.get('/:id/batches', 
  authenticateToken, 
  houseController.getHouseBatchHistory
);

module.exports = router;
