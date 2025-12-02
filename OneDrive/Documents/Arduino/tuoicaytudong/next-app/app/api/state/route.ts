import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    // Lấy trạng thái hệ thống từ bảng system_state
    const stateRows = db
      .prepare("SELECT key, value FROM system_state")
      .all() as Array<{ key: string; value: string }>;

    const state: Record<string, any> = {};
    stateRows.forEach((row) => {
      try {
        state[row.key] = JSON.parse(row.value);
      } catch {
        state[row.key] = row.value;
      }
    });

    // Lấy danh sách lịch tưới
    const schedules = db
      .prepare(
        "SELECT id, hour, minute, enabled FROM watering_schedules ORDER BY hour, minute"
      )
      .all() as Array<{
      id: number;
      hour: number;
      minute: number;
      enabled: boolean;
    }>;

    return NextResponse.json({
      ...state,
      schedules: schedules.map((s) => ({
        id: s.id,
        hour: s.hour,
        minute: s.minute,
        enabled: Boolean(s.enabled),
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const insert = db.prepare(
      "INSERT OR REPLACE INTO system_state (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
    );

    const keys = [
      "pumpStatus",
      "threshold",
      "wateringDuration",
      "autoMode",
      "isRaining",
      "scheduleEnabled",
      "delayedWateringEnabled",
      "delayedWateringHours",
      "delayedWateringMinutes",
    ];

    const transaction = db.transaction(() => {
      keys.forEach((key) => {
        if (body[key] !== undefined) {
          insert.run(key, JSON.stringify(body[key]));
        }
      });
    });

    transaction();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

