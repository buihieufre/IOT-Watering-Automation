import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
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

    return NextResponse.json(
      schedules.map((s) => ({
        id: s.id,
        hour: s.hour,
        minute: s.minute,
        enabled: Boolean(s.enabled),
      }))
    );
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
    const { hour, minute, enabled = true } = body;

    if (hour === undefined || minute === undefined) {
      return NextResponse.json(
        { error: "hour and minute are required" },
        { status: 400 }
      );
    }

    const result = db
      .prepare(
        "INSERT INTO watering_schedules (hour, minute, enabled) VALUES (?, ?, ?) RETURNING id, hour, minute, enabled"
      )
      .get(hour, minute, enabled ? 1 : 0) as {
      id: number;
      hour: number;
      minute: number;
      enabled: number;
    };

    return NextResponse.json({
      id: result.id,
      hour: result.hour,
      minute: result.minute,
      enabled: Boolean(result.enabled),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

