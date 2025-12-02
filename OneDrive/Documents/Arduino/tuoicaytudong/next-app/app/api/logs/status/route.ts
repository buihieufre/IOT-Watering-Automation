import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db-mongodb";

// Runtime config cho Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { statusLogs } = await getCollections();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const query: any = {};
    if (startDate) {
      query.created_at = { ...query.created_at, $gte: new Date(startDate) };
    }
    if (endDate) {
      query.created_at = { ...query.created_at, $lte: new Date(endDate) };
    }

    const logs = await statusLogs
      .find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .skip(offset)
      .toArray();

    const total = await statusLogs.countDocuments(query);

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log._id?.toString(),
        pump_status: log.pump_status,
        threshold: log.threshold,
        watering_duration: log.watering_duration,
        auto_mode: log.auto_mode,
        is_raining: log.is_raining,
        delayed_watering_enabled: log.delayed_watering_enabled,
        delayed_watering_hours: log.delayed_watering_hours,
        delayed_watering_minutes: log.delayed_watering_minutes,
        created_at: log.created_at,
      })),
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("GET /api/logs/status error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { statusLogs } = await getCollections();
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

    const result = await statusLogs.insertOne({
      pump_status: Boolean(pump_status),
      threshold,
      watering_duration,
      auto_mode: Boolean(auto_mode),
      is_raining: Boolean(is_raining),
      delayed_watering_enabled: Boolean(delayed_watering_enabled || false),
      delayed_watering_hours: delayed_watering_hours || 0,
      delayed_watering_minutes: delayed_watering_minutes || 0,
      created_at: new Date(),
    });

    return NextResponse.json({
      success: true,
      id: result.insertedId.toString(),
    });
  } catch (error: any) {
    console.error("POST /api/logs/status error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
