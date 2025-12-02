import { NextRequest, NextResponse } from "next/server";

// Runtime config cho Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lazy load db để tránh lỗi khi deploy
let db: any = null;
async function getDb() {
  if (!db) {
    const dbModule = await import("@/lib/db");
    db = dbModule.default;
  }
  return db;
}

export async function GET(request: NextRequest) {
  try {
    const database = await getDb();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    const startTime = searchParams.get("startTime");
    const endTime = searchParams.get("endTime");

    let query = "SELECT * FROM sensor_logs";
    const conditions: string[] = [];
    const params: any[] = [];

    if (startTime) {
      conditions.push("timestamp >= ?");
      params.push(parseInt(startTime));
    }

    if (endTime) {
      conditions.push("timestamp <= ?");
      params.push(parseInt(endTime));
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const logs = database.prepare(query).all(...params) as Array<{
      id: number;
      humidity: number;
      analog_value: number;
      timestamp: number;
      created_at: string;
    }>;

    // Đếm tổng số records
    let countQuery = "SELECT COUNT(*) as total FROM sensor_logs";
    if (conditions.length > 0) {
      countQuery += " WHERE " + conditions.join(" AND ");
    }
    const countResult = database.prepare(countQuery).get(...params.slice(0, -2)) as {
      total: number;
    };

    return NextResponse.json({
      logs,
      total: countResult.total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("GET /api/logs/sensor error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const database = await getDb();
    const body = await request.json();
    const { humidity, analog_value, timestamp } = body;

    if (
      humidity === undefined ||
      analog_value === undefined ||
      timestamp === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required fields: humidity, analog_value, timestamp" },
        { status: 400 }
      );
    }

    const insert = database.prepare(
      "INSERT INTO sensor_logs (humidity, analog_value, timestamp) VALUES (?, ?, ?)"
    );

    const result = insert.run(humidity, analog_value, timestamp);

    return NextResponse.json({
      success: true,
      id: result.lastInsertRowid,
    });
  } catch (error: any) {
    console.error("POST /api/logs/sensor error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
