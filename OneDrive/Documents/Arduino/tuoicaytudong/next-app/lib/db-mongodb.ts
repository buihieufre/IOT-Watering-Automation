import { getDb } from "./mongodb";
import { Collection, ObjectId } from "mongodb";

// MongoDB Collections
export interface SystemState {
  _id?: ObjectId;
  key: string;
  value: any;
  updated_at: Date;
}

export interface WateringSchedule {
  _id?: ObjectId;
  hour: number;
  minute: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SensorLog {
  _id?: ObjectId;
  humidity: number;
  analog_value: number;
  timestamp: number;
  created_at: Date;
}

export interface StatusLog {
  _id?: ObjectId;
  pump_status: boolean;
  threshold: number;
  watering_duration: number;
  auto_mode: boolean;
  is_raining: boolean;
  delayed_watering_enabled: boolean;
  delayed_watering_hours: number;
  delayed_watering_minutes: number;
  created_at: Date;
}

// Initialize collections và indexes
export async function initDatabase() {
  const db = await getDb();

  // System State collection
  const systemStateCollection = db.collection<SystemState>("system_state");
  await systemStateCollection.createIndex({ key: 1 }, { unique: true });

  // Watering Schedules collection
  const schedulesCollection =
    db.collection<WateringSchedule>("watering_schedules");
  await schedulesCollection.createIndex({ hour: 1, minute: 1 });

  // Sensor Logs collection
  const sensorLogsCollection = db.collection<SensorLog>("sensor_logs");
  await sensorLogsCollection.createIndex({ timestamp: -1 });
  await sensorLogsCollection.createIndex({ created_at: -1 });

  // Status Logs collection
  const statusLogsCollection = db.collection<StatusLog>("status_logs");
  await statusLogsCollection.createIndex({ created_at: -1 });

  return {
    systemState: systemStateCollection,
    schedules: schedulesCollection,
    sensorLogs: sensorLogsCollection,
    statusLogs: statusLogsCollection,
  };
}

// Helper function để lấy collections
export async function getCollections() {
  const db = await getDb();
  return {
    systemState: db.collection<SystemState>("system_state"),
    schedules: db.collection<WateringSchedule>("watering_schedules"),
    sensorLogs: db.collection<SensorLog>("sensor_logs"),
    statusLogs: db.collection<StatusLog>("status_logs"),
  };
}
