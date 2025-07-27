const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { testConnection } = require('./src/config/database');
const userRoutes = require('./src/routes/userRoutes');
const farmRoutes = require('./src/routes/farmRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'มีการเรียกใช้งาน API มากเกินไป กรุณาลองใหม่อีกครั้งในภายหลัง'
  }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'ระบบทำงานปกติ',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/farms', farmRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'ไม่พบ API endpoint ที่ต้องการ'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  // Mongoose validation error
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'ข้อมูลไม่ถูกต้อง',
      errors: Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }))
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token ไม่ถูกต้อง'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token หมดอายุ'
    });
  }

  // MySQL errors
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({
      success: false,
      message: 'ข้อมูลซ้ำ กรุณาตรวจสอบข้อมูลที่กรอก'
    });
  }

  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      message: 'ข้อมูลอ้างอิงไม่ถูกต้อง'
    });
  }

  // Default error
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์',
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาตรวจสอบการตั้งค่า');
      process.exit(1);
    }

    // Start listening
    app.listen(PORT, () => {
      console.log(`🚀 เซิร์ฟเวอร์ทำงานบนพอร์ต ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
      console.log(`💡 Health Check: http://localhost:${PORT}/health`);
    });

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการเริ่มต้นเซิร์ฟเวอร์:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📤 ได้รับสัญญาณ SIGTERM กำลังปิดเซิร์ฟเวอร์...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📤 ได้รับสัญญาณ SIGINT กำลังปิดเซิร์ฟเวอร์...');
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
