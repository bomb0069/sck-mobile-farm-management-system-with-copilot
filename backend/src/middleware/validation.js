const Joi = require('joi');

// ฟังก์ชันสำหรับสร้าง validation middleware
const validateRequest = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'params' ? req.params : 
                  source === 'query' ? req.query : req.body;

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'ข้อมูลไม่ถูกต้อง',
        errors: errorDetails
      });
    }

    // แทนที่ข้อมูลใน request ด้วยข้อมูลที่ผ่านการ validate แล้ว
    if (source === 'params') {
      req.params = value;
    } else if (source === 'query') {
      req.query = value;
    } else {
      req.body = value;
    }

    next();
  };
};

// Schema สำหรับการลงทะเบียนผู้ใช้
const userRegistrationSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'รูปแบบอีเมลไม่ถูกต้อง',
    'any.required': 'กรุณากรอกอีเมล'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
    'any.required': 'กรุณากรอกรหัสผ่าน'
  }),
  first_name: Joi.string().required().messages({
    'any.required': 'กรุณากรอกชื่อ'
  }),
  last_name: Joi.string().required().messages({
    'any.required': 'กรุณากรอกนามสกุล'
  }),
  phone: Joi.string().optional(),
  role: Joi.string().valid('admin', 'farm_owner', 'worker').default('farm_owner')
});

// Schema สำหรับการล็อกอิน
const userLoginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'รูปแบบอีเมลไม่ถูกต้อง',
    'any.required': 'กรุณากรอกอีเมล'
  }),
  password: Joi.string().required().messages({
    'any.required': 'กรุณากรอกรหัสผ่าน'
  })
});

// Schema สำหรับการสร้างฟาร์ม
const farmCreationSchema = Joi.object({
  name: Joi.string().required().messages({
    'any.required': 'กรุณากรอกชื่อฟาร์ม'
  }),
  address: Joi.string().optional(),
  province: Joi.string().optional(),
  district: Joi.string().optional(),
  subdistrict: Joi.string().optional(),
  postal_code: Joi.string().optional(),
  manager_name: Joi.string().optional(),
  phone: Joi.string().optional(),
  email: Joi.string().email().optional(),
  farm_type: Joi.string().valid('broiler', 'layer', 'mixed').default('mixed'),
  license_number: Joi.string().optional()
});

// Schema สำหรับการสร้างโรงเรือน
const houseCreationSchema = Joi.object({
  farm_id: Joi.number().integer().positive().required().messages({
    'any.required': 'กรุณาระบุ ID ฟาร์ม'
  }),
  house_code: Joi.string().required().messages({
    'any.required': 'กรุณากรอกรหัสโรงเรือน'
  }),
  name: Joi.string().optional(),
  house_type: Joi.string().valid('open', 'closed', 'semi_closed').default('open'),
  capacity: Joi.number().integer().positive().required().messages({
    'any.required': 'กรุณากรอกความจุ',
    'number.positive': 'ความจุต้องเป็นจำนวนบวก'
  }),
  area_sqm: Joi.number().positive().optional(),
  width_meters: Joi.number().positive().optional(),
  length_meters: Joi.number().positive().optional(),
  height_meters: Joi.number().positive().optional(),
  ventilation_type: Joi.string().optional()
});

// Schema สำหรับการสร้างรอบการเลี้ยง
const batchCreationSchema = Joi.object({
  farm_id: Joi.number().integer().positive().required(),
  house_id: Joi.number().integer().positive().required(),
  batch_code: Joi.string().required(),
  breed_id: Joi.number().integer().positive().required(),
  bird_type: Joi.string().valid('broiler', 'layer').required(),
  initial_count: Joi.number().integer().positive().required(),
  placement_date: Joi.date().required(),
  expected_harvest_date: Joi.date().optional(),
  placement_age_days: Joi.number().integer().min(0).default(0),
  source_farm: Joi.string().optional(),
  cost_per_bird: Joi.number().positive().optional(),
  notes: Joi.string().optional()
});

// Schema สำหรับการบันทึกข้อมูลประจำวัน
const dailyRecordSchema = Joi.object({
  batch_id: Joi.number().integer().positive().required(),
  record_date: Joi.date().required(),
  bird_count: Joi.number().integer().min(0).required(),
  mortality_count: Joi.number().integer().min(0).default(0),
  culled_count: Joi.number().integer().min(0).default(0),
  feed_consumed_kg: Joi.number().positive().optional(),
  water_consumed_liters: Joi.number().positive().optional(),
  avg_weight_grams: Joi.number().positive().optional(),
  temperature_celsius: Joi.number().optional(),
  humidity_percent: Joi.number().min(0).max(100).optional(),
  notes: Joi.string().optional()
});

// Schema สำหรับการบันทึกผลผลิตไข่
const eggProductionSchema = Joi.object({
  batch_id: Joi.number().integer().positive().required(),
  production_date: Joi.date().required(),
  total_eggs: Joi.number().integer().min(0).default(0),
  grade_0_count: Joi.number().integer().min(0).default(0),
  grade_1_count: Joi.number().integer().min(0).default(0),
  grade_2_count: Joi.number().integer().min(0).default(0),
  grade_3_count: Joi.number().integer().min(0).default(0),
  broken_eggs: Joi.number().integer().min(0).default(0),
  double_yolk_eggs: Joi.number().integer().min(0).default(0),
  avg_egg_weight_grams: Joi.number().positive().optional(),
  notes: Joi.string().optional()
});

// Schema สำหรับ ID parameters
const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

module.exports = {
  validateRequest,
  userRegistrationSchema,
  userLoginSchema,
  farmCreationSchema,
  houseCreationSchema,
  batchCreationSchema,
  dailyRecordSchema,
  eggProductionSchema,
  idParamSchema
};
