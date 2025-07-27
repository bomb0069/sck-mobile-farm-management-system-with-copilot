const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { validateRequest, userRegistrationSchema, userLoginSchema } = require('../middleware/validation');

// Routes สำหรับการ authentication
router.post('/register', 
  validateRequest(userRegistrationSchema), 
  userController.register
);

router.post('/login', 
  validateRequest(userLoginSchema), 
  userController.login
);

// Routes สำหรับการจัดการโปรไฟล์ (ต้อง authenticate)
router.get('/profile', 
  authenticateToken, 
  userController.getProfile
);

router.put('/profile', 
  authenticateToken, 
  userController.updateProfile
);

router.put('/change-password', 
  authenticateToken, 
  userController.changePassword
);

// Routes สำหรับ Admin เท่านั้น
router.get('/users', 
  authenticateToken, 
  authorizeRole('admin'), 
  userController.getAllUsers
);

module.exports = router;
