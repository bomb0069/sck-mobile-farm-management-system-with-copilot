-- ระบบบริหารจัดการฟาร์มเลี้ยงไก่
-- Poultry Farm Management System Database Schema

CREATE DATABASE IF NOT EXISTS poultry_farm_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE poultry_farm_db;

-- ตาราง Users สำหรับจัดการผู้ใช้งาน
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role ENUM('admin', 'farm_owner', 'worker') DEFAULT 'farm_owner',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ตาราง Farms สำหรับข้อมูลฟาร์ม
CREATE TABLE farms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    province VARCHAR(100),
    district VARCHAR(100),
    subdistrict VARCHAR(100),
    postal_code VARCHAR(10),
    owner_id INT NOT NULL,
    manager_name VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    farm_type ENUM('broiler', 'layer', 'mixed') DEFAULT 'mixed',
    license_number VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ตาราง Houses สำหรับข้อมูลโรงเรือน
CREATE TABLE houses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    farm_id INT NOT NULL,
    house_code VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    house_type ENUM('open', 'closed', 'semi_closed') DEFAULT 'open',
    capacity INT NOT NULL,
    area_sqm DECIMAL(10,2),
    width_meters DECIMAL(8,2),
    length_meters DECIMAL(8,2),
    height_meters DECIMAL(8,2),
    ventilation_type VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
    UNIQUE KEY unique_house_code_per_farm (farm_id, house_code)
);

-- ตาราง Breeds สำหรับข้อมูลสายพันธุ์ไก่
CREATE TABLE breeds (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    breed_type ENUM('broiler', 'layer') NOT NULL,
    origin_country VARCHAR(100),
    description TEXT,
    avg_mature_weight_grams INT,
    avg_daily_gain_grams DECIMAL(8,2),
    fcr_standard DECIMAL(4,2),
    egg_production_peak_percent DECIMAL(5,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตาราง Batches สำหรับรอบการเลี้ยง
CREATE TABLE batches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    farm_id INT NOT NULL,
    house_id INT NOT NULL,
    batch_code VARCHAR(50) NOT NULL,
    breed_id INT NOT NULL,
    bird_type ENUM('broiler', 'layer') NOT NULL,
    initial_count INT NOT NULL,
    current_count INT NOT NULL,
    placement_date DATE NOT NULL,
    expected_harvest_date DATE,
    actual_harvest_date DATE,
    placement_age_days INT DEFAULT 0,
    source_farm VARCHAR(255),
    cost_per_bird DECIMAL(10,2),
    status ENUM('active', 'completed', 'terminated') DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (breed_id) REFERENCES breeds(id),
    UNIQUE KEY unique_batch_code_per_farm (farm_id, batch_code)
);

-- ตาราง Feed Types สำหรับประเภทอาหาร
CREATE TABLE feed_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(255),
    feed_category ENUM('starter', 'grower', 'finisher', 'layer') NOT NULL,
    protein_percent DECIMAL(5,2),
    energy_kcal_per_kg DECIMAL(8,2),
    cost_per_kg DECIMAL(10,2),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตาราง Daily Records สำหรับบันทึกประจำวัน
CREATE TABLE daily_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    batch_id INT NOT NULL,
    record_date DATE NOT NULL,
    bird_count INT NOT NULL,
    mortality_count INT DEFAULT 0,
    culled_count INT DEFAULT 0,
    feed_consumed_kg DECIMAL(10,2),
    water_consumed_liters DECIMAL(10,2),
    avg_weight_grams DECIMAL(8,2),
    temperature_celsius DECIMAL(4,1),
    humidity_percent DECIMAL(5,2),
    notes TEXT,
    recorded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id),
    UNIQUE KEY unique_batch_date (batch_id, record_date)
);

-- ตาราง Egg Production สำหรับผลผลิตไข่
CREATE TABLE egg_production (
    id INT PRIMARY KEY AUTO_INCREMENT,
    batch_id INT NOT NULL,
    production_date DATE NOT NULL,
    total_eggs INT DEFAULT 0,
    grade_0_count INT DEFAULT 0,
    grade_1_count INT DEFAULT 0,
    grade_2_count INT DEFAULT 0,
    grade_3_count INT DEFAULT 0,
    broken_eggs INT DEFAULT 0,
    double_yolk_eggs INT DEFAULT 0,
    avg_egg_weight_grams DECIMAL(6,2),
    notes TEXT,
    recorded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id),
    UNIQUE KEY unique_batch_production_date (batch_id, production_date)
);

-- ตาราง Medicine Types สำหรับประเภทยาและวัคซีน
CREATE TABLE medicine_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    medicine_category ENUM('vaccine', 'antibiotic', 'vitamin', 'probiotic', 'treatment', 'prevention') NOT NULL,
    dosage_instruction TEXT,
    withdrawal_period_days INT DEFAULT 0,
    cost_per_unit DECIMAL(10,2),
    unit_type VARCHAR(50), -- ml, tablet, gram, etc.
    storage_instruction TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตาราง Medicine Records สำหรับบันทึกการใช้ยา
CREATE TABLE medicine_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    batch_id INT NOT NULL,
    medicine_type_id INT NOT NULL,
    treatment_date DATE NOT NULL,
    dosage_amount DECIMAL(10,2) NOT NULL,
    dosage_unit VARCHAR(50),
    administration_method VARCHAR(100), -- water, feed, injection, spray
    treated_bird_count INT,
    reason TEXT,
    next_treatment_date DATE,
    withdrawal_end_date DATE,
    cost DECIMAL(10,2),
    administered_by INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
    FOREIGN KEY (medicine_type_id) REFERENCES medicine_types(id),
    FOREIGN KEY (administered_by) REFERENCES users(id)
);

-- ตาราง Inventory สำหรับการจัดการคลัง
CREATE TABLE inventory (
    id INT PRIMARY KEY AUTO_INCREMENT,
    farm_id INT NOT NULL,
    item_type ENUM('feed', 'medicine', 'equipment', 'supplies') NOT NULL,
    item_id INT, -- reference to feed_types or medicine_types
    item_name VARCHAR(255) NOT NULL,
    current_stock DECIMAL(10,2) DEFAULT 0,
    unit VARCHAR(50), -- kg, liter, piece, box
    minimum_stock DECIMAL(10,2) DEFAULT 0,
    cost_per_unit DECIMAL(10,2),
    supplier VARCHAR(255),
    last_purchase_date DATE,
    expiry_date DATE,
    storage_location VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
);

-- ตาราง Inventory Transactions สำหรับการเคลื่อนไหวสต๊อก
CREATE TABLE inventory_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    inventory_id INT NOT NULL,
    transaction_type ENUM('in', 'out', 'adjustment', 'expired', 'lost') NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(10,2),
    reference_id INT, -- อ้างอิงไปยัง batch_id หรือ daily_record_id
    reference_type VARCHAR(50), -- 'daily_feeding', 'medicine_treatment', 'purchase', 'waste'
    transaction_date DATE NOT NULL,
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ตาราง Financial Records สำหรับบันทึกการเงิน
CREATE TABLE financial_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    farm_id INT NOT NULL,
    batch_id INT,
    transaction_type ENUM('income', 'expense') NOT NULL,
    category VARCHAR(100), -- feed, medicine, labor, utilities, sales, etc.
    amount DECIMAL(12,2) NOT NULL,
    transaction_date DATE NOT NULL,
    description TEXT,
    invoice_number VARCHAR(100),
    payment_method VARCHAR(50),
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Insert ข้อมูลเริ่มต้นสำหรับสายพันธุ์ไก่
INSERT INTO breeds (name, breed_type, origin_country, description, avg_mature_weight_grams, avg_daily_gain_grams, fcr_standard) VALUES
('Ross 308', 'broiler', 'UK', 'สายพันธุ์ไก่เนื้อเติบโตเร็ว', 2800, 65, 1.45),
('Cobb 500', 'broiler', 'USA', 'สายพันธุ์ไก่เนื้อที่นิยม', 2900, 68, 1.48),
('CP707', 'broiler', 'Thailand', 'สายพันธุ์ไก่เนื้อของไทย', 2600, 62, 1.52),
('Hy-Line Brown', 'layer', 'USA', 'ไก่ไข่สีน้ำตาล', 1800, 15, NULL),
('Lohmann Brown', 'layer', 'Germany', 'ไก่ไข่ผลผลิตสูง', 1900, 16, NULL),
('ISA Brown', 'layer', 'France', 'ไก่ไข่เชิงพาณิชย์', 1850, 15, NULL);

-- Insert ข้อมูลเริ่มต้นสำหรับประเภทอาหาร
INSERT INTO feed_types (name, brand, feed_category, protein_percent, energy_kcal_per_kg, cost_per_kg) VALUES
('สตาร์ทเตอร์ ไก่เนื้อ', 'CP', 'starter', 22.0, 3100, 18.50),
('โกรเวอร์ ไก่เนื้อ', 'CP', 'grower', 20.0, 3150, 17.80),
('ฟินิชเชอร์ ไก่เนื้อ', 'CP', 'finisher', 18.0, 3200, 17.20),
('อาหารไก่ไข่ เลเยอร์', 'CP', 'layer', 16.5, 2750, 16.90),
('สตาร์ทเตอร์ ไก่ไข่', 'Betagro', 'starter', 20.0, 2900, 19.20),
('โกรเวอร์ ไก่ไข่', 'Betagro', 'grower', 18.0, 2850, 18.40);

-- Insert ข้อมูลเริ่มต้นสำหรับประเภทยา
INSERT INTO medicine_types (name, medicine_category, dosage_instruction, withdrawal_period_days, unit_type) VALUES
('วัคซีนนิวคาสเซิล', 'vaccine', 'ให้ทางตา หรือ ฉีดใต้ผิวหนัง', 0, 'dose'),
('วัคซีน IBD', 'vaccine', 'ผสมน้ำดื่ม', 0, 'dose'),
('วิตามิน AD3E', 'vitamin', 'ผสมน้ำดื่ม 1ml:1L', 0, 'ml'),
('แอนติไบโอติก เอนโรฟล็อกซาซิน', 'antibiotic', 'ผสมน้ำดื่ม ตามใบสั่งแพทย์', 5, 'ml'),
('โปรไบโอติก', 'probiotic', 'ผสมอาหาร 1g:1kg', 0, 'gram'),
('ยาฆ่าเชื้อไวรัส', 'treatment', 'สเปรย์ในโรงเรือน', 1, 'ml');
