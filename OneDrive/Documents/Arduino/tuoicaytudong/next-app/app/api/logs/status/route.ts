import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query = "SELECT * FROM status_logs";
    const conditions: string[] = [];
    const params: any[] = [];

    if (startDate) {
      conditions.push("created_at >= ?");
      params.push(startDate);
    }

    if (endDate) {
      conditions.push("created_at <= ?");
      params.push(endDate);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const logs = db.prepare(query).all(...params) as Array<{
      id: number;
      pump_status: number;
      threshold: number;
      watering_duration: number;
      auto_mode: number;
      is_raining: number;
      delayed_watering_enabled: number;
      delayed_watering_hours: number;
      delayed_watering_minutes: number;
      created_at: string;
    }>;

    // Đếm tổng số records
    let countQuery = "SELECT COUNT(*) as total FROM status_logs";
    if (conditions.length > 0) {
      countQuery += " WHERE " + conditions.join(" AND ");
    }
    const countResult = db
      .prepare(countQuery)
      .get(...params.slice(0, -2)) as { total: number };

    // Convert boolean values từ SQLite (0/1) sang boolean
    const formattedLogs = logs.map((log) => ({
      ...log,
      pump_status: Boolean(log.pump_status),
      auto_mode: Boolean(log.auto_mode),
      is_raining: Boolean(log.is_raining),
      delayed_watering_enabled: Boolean(log.delayed_watering_enabled),
    }));

    return NextResponse.json({
      logs: formattedLogs,
      total: countResult.total,
      limit,
      offset,
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
    const {
      pump_status,
      threshold,
      watering_duration,
      auto_mode,
      is_raining,
      delayed_watering_enabled,
      delayed_watering_hours,
      delayed_watering_minutes,
    } = body;

    if (
      pump_status === undefined ||
      threshold === undefined ||
      watering_duration === undefined ||
      auto_mode === undefined ||
      is_raining === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: pump_status, threshold, watering_duration, auto_mode, is_raining",
        },
        { status: 400 }
      );
    }

    const insert = db.prepare(
      `INSERT INTO status_logs (
        pump_status, threshold, watering_duration, auto_mode, is_raining,
        delayed_watering_enabled, delayed_watering_hours, delayed_watering_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const result = insert.run(
      pump_status ? 1 : 0,
      threshold,
      watering_duration,
      auto_mode ? 1 : 0,
      is_raining ? 1 : 0,
      delayed_watering_enabled ? 1 : 0,
      delayed_watering_hours || 0,
      delayed_watering_minutes || 0
    );

    return NextResponse.json({
      success: true,
      id: result.lastInsertRowid,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

