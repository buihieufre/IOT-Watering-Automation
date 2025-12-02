import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db-mongodb";

// Runtime config cho Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { systemState, schedules } = await getCollections();

    // Lấy trạng thái hệ thống
    const stateRows = await systemState.find({}).toArray();
    const state: Record<string, any> = {};
    stateRows.forEach((row) => {
      state[row.key] = row.value;
    });

    // Lấy danh sách lịch tưới
    const schedulesList = await schedules
      .find({})
      .sort({ hour: 1, minute: 1 })
      .toArray();

    return NextResponse.json({
      ...state,
      schedules: schedulesList.map((s) => ({
        id: s._id?.toString(),
        hour: s.hour,
        minute: s.minute,
        enabled: s.enabled,
      })),
    });
  } catch (error: any) {
    console.error("GET /api/state error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { systemState } = await getCollections();
    const body = await request.json();

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

    // Update hoặc insert từng key
    const operations = keys
      .filter((key) => body[key] !== undefined)
      .map((key) => ({
        updateOne: {
          filter: { key },
          update: {
            $set: {
              key,
              value: body[key],
              updated_at: new Date(),
            },
          },
          upsert: true,
        },
      }));

    if (operations.length > 0) {
      await systemState.bulkWrite(operations);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/state error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
