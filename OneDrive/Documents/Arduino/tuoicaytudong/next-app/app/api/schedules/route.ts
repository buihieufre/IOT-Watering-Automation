import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db-mongodb";

// Runtime config cho Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { schedules } = await getCollections();
    const schedulesList = await schedules
      .find({})
      .sort({ hour: 1, minute: 1 })
      .toArray();

    return NextResponse.json(
      schedulesList.map((s) => ({
        id: s._id?.toString(),
        hour: s.hour,
        minute: s.minute,
        enabled: s.enabled,
      }))
    );
  } catch (error: any) {
    console.error("GET /api/schedules error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schedules } = await getCollections();
    const body = await request.json();
    const { hour, minute, enabled = true } = body;

    if (hour === undefined || minute === undefined) {
      return NextResponse.json(
        { error: "hour and minute are required" },
        { status: 400 }
      );
    }

    const result = await schedules.insertOne({
      hour,
      minute,
      enabled,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return NextResponse.json({
      id: result.insertedId.toString(),
      hour,
      minute,
      enabled,
    });
  } catch (error: any) {
    console.error("POST /api/schedules error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
