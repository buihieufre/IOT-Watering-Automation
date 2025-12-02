import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db-mongodb";
import { ObjectId } from "mongodb";

// Runtime config cho Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { schedules } = await getCollections();
    const id = params.id;
    const body = await request.json();
    const { hour, minute, enabled } = body;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid schedule ID" },
        { status: 400 }
      );
    }

    const update: any = {
      updated_at: new Date(),
    };

    if (hour !== undefined) update.hour = hour;
    if (minute !== undefined) update.minute = minute;
    if (enabled !== undefined) update.enabled = enabled;

    if (Object.keys(update).length === 1) {
      // Chỉ có updated_at, không có field nào để update
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const result = await schedules.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: result._id.toString(),
      hour: result.hour,
      minute: result.minute,
      enabled: result.enabled,
    });
  } catch (error: any) {
    console.error("PUT /api/schedules/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { schedules } = await getCollections();
    const id = params.id;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid schedule ID" },
        { status: 400 }
      );
    }

    const result = await schedules.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/schedules/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
