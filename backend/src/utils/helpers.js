const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// ฟังก์ชันสร้าง JWT Token
const generateToken = (userId, email, role) => {
  const payload = {
    userId,
    email,
    role
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// ฟังก์ชัน hash รหัสผ่าน
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// ฟังก์ชันเปรียบเทียบรหัสผ่าน
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// ฟังก์ชันสร้าง response แบบมาตรฐาน
const createResponse = (success, message, data = null, errors = null) => {
  const response = { success, message };
  
  if (data !== null) {
    response.data = data;
  }
  
  if (errors !== null) {
    response.errors = errors;
  }
  
  return response;
};

// ฟังก์ชันคำนวณอายุไก่ (วัน)
const calculateBirdAge = (placementDate, currentDate = new Date()) => {
  const placement = new Date(placementDate);
  const current = new Date(currentDate);
  const diffTime = Math.abs(current - placement);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// ฟังก์ชันคำนวณวันที่คาดการณ์จับไก่ (สำหรับไก่เนื้อ)
const calculateExpectedHarvestDate = (placementDate, birdType, placementAgeDays = 0) => {
  const placement = new Date(placementDate);
  let growthPeriodDays;

  if (birdType === 'broiler') {
    growthPeriodDays = 35; // ไก่เนื้อ 35-42 วัน
  } else if (birdType === 'layer') {
    growthPeriodDays = 120; // ไก่ไข่เริ่มให้ไข่ที่ 18-20 สัปดาห์
  } else {
    return null;
  }

  const harvestDate = new Date(placement);
  harvestDate.setDate(harvestDate.getDate() + growthPeriodDays - placementAgeDays);
  
  return harvestDate;
};

// ฟังก์ชันคำนวณ FCR (Feed Conversion Ratio)
const calculateFCR = (totalFeedKg, totalWeightGainKg) => {
  if (totalWeightGainKg === 0) return 0;
  return (totalFeedKg / totalWeightGainKg).toFixed(2);
};

// ฟังก์ชันคำนวณ Feed Efficiency
const calculateFeedEfficiency = (fcr) => {
  if (fcr === 0) return 0;
  return (1 / fcr * 100).toFixed(2);
};

// ฟังก์ชันคำนวณอัตราการรอดชีวิต
const calculateSurvivalRate = (initialCount, currentCount) => {
  if (initialCount === 0) return 0;
  return ((currentCount / initialCount) * 100).toFixed(2);
};

// ฟังก์ชันคำนวณ Hen Day Production (สำหรับไก่ไข่)
const calculateHenDayProduction = (eggsProduced, henCount) => {
  if (henCount === 0) return 0;
  return ((eggsProduced / henCount) * 100).toFixed(2);
};

// ฟังก์ชันแปลงวันที่เป็นรูปแบบ MySQL
const formatDateForMySQL = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
};

// ฟังก์ชันแปลงวันที่และเวลาเป็นรูปแบบ MySQL
const formatDateTimeForMySQL = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().slice(0, 19).replace('T', ' '); // YYYY-MM-DD HH:mm:ss
};

// ฟังก์ชันจัดการ pagination
const getPaginationData = (page = 1, limit = 10, totalRecords) => {
  const currentPage = parseInt(page);
  const recordsPerPage = parseInt(limit);
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const offset = (currentPage - 1) * recordsPerPage;

  return {
    currentPage,
    recordsPerPage,
    totalPages,
    totalRecords,
    offset,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1
  };
};

// ฟังก์ชันสร้างรหัสอ้างอิง
const generateReferenceCode = (prefix = 'REF', length = 8) => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, length);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
};

module.exports = {
  generateToken,
  hashPassword,
  comparePassword,
  createResponse,
  calculateBirdAge,
  calculateExpectedHarvestDate,
  calculateFCR,
  calculateFeedEfficiency,
  calculateSurvivalRate,
  calculateHenDayProduction,
  formatDateForMySQL,
  formatDateTimeForMySQL,
  getPaginationData,
  generateReferenceCode
};
