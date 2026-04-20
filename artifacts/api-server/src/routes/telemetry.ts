import { Router } from "express";
import { db, telemetryTable, devicesTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";

const router = Router();

router.get("/telemetry", async (req, res) => {
  try {
    const { deviceId, key, limit = "100" } = req.query as { deviceId?: string; key?: string; limit?: string };
    const conditions: ReturnType<typeof eq>[] = [];
    if (deviceId) conditions.push(eq(telemetryTable.deviceId, parseInt(deviceId, 10)));
    if (key) conditions.push(eq(telemetryTable.key, key));

    let records;
    if (conditions.length > 0) {
      records = await db.select().from(telemetryTable)
        .where(and(...conditions))
        .orderBy(desc(telemetryTable.recordedAt))
        .limit(parseInt(limit, 10));
    } else {
      records = await db.select().from(telemetryTable)
        .orderBy(desc(telemetryTable.recordedAt))
        .limit(parseInt(limit, 10));
    }

    res.json(records.map(r => ({
      ...r,
      recordedAt: r.recordedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Error listing telemetry");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/telemetry", async (req, res) => {
  try {
    const { deviceId, key, value, numericValue } = req.body;
    if (!deviceId || !key || value === undefined) {
      return res.status(400).json({ error: "deviceId, key, value are required" });
    }
    const [record] = await db.insert(telemetryTable).values({
      deviceId,
      key,
      value: String(value),
      numericValue: numericValue !== undefined ? numericValue : null,
    }).returning();

    // Update device status to online
    await db.update(devicesTable).set({ status: "online", updatedAt: new Date() })
      .where(eq(devicesTable.id, deviceId));

    // Check alerts
    await checkAlerts(deviceId, key, numericValue);

    res.status(201).json({
      ...record,
      recordedAt: record.recordedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error ingesting telemetry");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/telemetry/latest", async (req, res) => {
  try {
    const { deviceId } = req.query as { deviceId?: string };

    const rawRows = await db.execute(sql`
      SELECT DISTINCT ON (t.device_id, t.key)
        t.device_id as "deviceId",
        d.name as "deviceName",
        t.key,
        t.value,
        t.numeric_value as "numericValue",
        t.recorded_at as "recordedAt"
      FROM telemetry t
      JOIN devices d ON d.id = t.device_id
      ${deviceId ? sql`WHERE t.device_id = ${parseInt(deviceId, 10)}` : sql``}
      ORDER BY t.device_id, t.key, t.recorded_at DESC
    `);

    const rows: any[] = Array.isArray(rawRows) ? rawRows : (rawRows as any).rows ?? [];
    res.json(rows.map((r: any) => ({
      ...r,
      recordedAt: r.recordedAt instanceof Date ? r.recordedAt.toISOString() : r.recordedAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Error getting latest telemetry");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function checkAlerts(deviceId: number, key: string, value: number | undefined | null) {
  if (value === undefined || value === null) return;
  const { alertsTable, triggeredAlertsTable } = await import("@workspace/db");
  const alerts = await db.select().from(alertsTable).where(
    and(eq(alertsTable.deviceId, deviceId), eq(alertsTable.telemetryKey, key), eq(alertsTable.enabled, true))
  );
  for (const alert of alerts) {
    let triggered = false;
    switch (alert.condition) {
      case "gt": triggered = value > alert.threshold; break;
      case "lt": triggered = value < alert.threshold; break;
      case "eq": triggered = value === alert.threshold; break;
      case "gte": triggered = value >= alert.threshold; break;
      case "lte": triggered = value <= alert.threshold; break;
    }
    if (triggered) {
      await db.insert(triggeredAlertsTable).values({ alertId: alert.id, value: String(value) });
    }
  }
}

export default router;
