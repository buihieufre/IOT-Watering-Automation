import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbPath = path.join(process.cwd(), "data", "tuoicay.db");

// Đảm bảo thư mục data tồn tại
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Tạo bảng lưu trạng thái hệ thống
db.exec(`
  CREATE TABLE IF NOT EXISTS system_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS watering_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hour INTEGER NOT NULL,
    minute INTEGER NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sensor_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    humidity REAL NOT NULL,
    analog_value INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS status_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pump_status BOOLEAN NOT NULL,
    threshold REAL NOT NULL,
    watering_duration INTEGER NOT NULL,
    auto_mode BOOLEAN NOT NULL,
    is_raining BOOLEAN NOT NULL,
    delayed_watering_enabled BOOLEAN DEFAULT 0,
    delayed_watering_hours INTEGER DEFAULT 0,
    delayed_watering_minutes INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_sensor_logs_timestamp ON sensor_logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_status_logs_created_at ON status_logs(created_at);
`);

export default db;

