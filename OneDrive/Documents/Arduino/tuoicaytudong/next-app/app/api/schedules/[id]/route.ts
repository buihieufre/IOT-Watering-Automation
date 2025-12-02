import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const body = await request.json();
    const { hour, minute, enabled } = body;

    const updates: string[] = [];
    const values: any[] = [];

    if (hour !== undefined) {
      updates.push("hour = ?");
      values.push(hour);
    }
    if (minute !== undefined) {
      updates.push("minute = ?");
      values.push(minute);
    }
    if (enabled !== undefined) {
      updates.push("enabled = ?");
      values.push(enabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const sql = `UPDATE watering_schedules SET ${updates.join(", ")} WHERE id = ?`;
    db.prepare(sql).run(...values);

    const updated = db
      .prepare("SELECT id, hour, minute, enabled FROM watering_schedules WHERE id = ?")
      .get(id) as {
      id: number;
      hour: number;
      minute: number;
      enabled: number;
    };

    return NextResponse.json({
      id: updated.id,
      hour: updated.hour,
      minute: updated.minute,
      enabled: Boolean(updated.enabled),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    db.prepare("DELETE FROM watering_schedules WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

