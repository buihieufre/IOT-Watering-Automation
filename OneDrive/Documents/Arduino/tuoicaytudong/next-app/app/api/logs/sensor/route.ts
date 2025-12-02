import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db-mongodb";

// Runtime config cho Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { sensorLogs } = await getCollections();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    const startTime = searchParams.get("startTime");
    const endTime = searchParams.get("endTime");

    const query: any = {};
    if (startTime) {
      query.timestamp = { ...query.timestamp, $gte: parseInt(startTime) };
    }
    if (endTime) {
      query.timestamp = { ...query.timestamp, $lte: parseInt(endTime) };
    }

    const logs = await sensorLogs
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(offset)
      .toArray();

    const total = await sensorLogs.countDocuments(query);

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log._id?.toString(),
        humidity: log.humidity,
        analog_value: log.analog_value,
        timestamp: log.timestamp,
        created_at: log.created_at,
      })),
      total,
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
    const { sensorLogs } = await getCollections();
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

    const result = await sensorLogs.insertOne({
      humidity,
      analog_value,
      timestamp,
      created_at: new Date(),
    });

    return NextResponse.json({
      success: true,
      id: result.insertedId.toString(),
    });
  } catch (error: any) {
    console.error("POST /api/logs/sensor error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
