import { Router } from "express";
import { db, devicesTable, telemetryTable, alertsTable, triggeredAlertsTable } from "@workspace/db";
import { eq, sql, gte, count } from "drizzle-orm";

const router = Router();

router.get("/stats/overview", async (req, res) => {
  try {
    const [deviceStats] = await db.select({
      totalDevices: count(),
      onlineDevices: sql<number>`count(*) filter (where status = 'online')`,
      offlineDevices: sql<number>`count(*) filter (where status = 'offline')`,
    }).from(devicesTable);

    const [telemetryStats] = await db.select({ totalTelemetry: count() }).from(telemetryTable);
    const [alertStats] = await db.select({ activeAlerts: count() }).from(alertsTable).where(eq(alertsTable.enabled, true));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [triggeredToday] = await db.select({ triggeredAlertsToday: count() }).from(triggeredAlertsTable)
      .where(gte(triggeredAlertsTable.triggeredAt, today));

    res.json({
      totalDevices: Number(deviceStats?.totalDevices ?? 0),
      onlineDevices: Number(deviceStats?.onlineDevices ?? 0),
      offlineDevices: Number(deviceStats?.offlineDevices ?? 0),
      totalTelemetry: Number(telemetryStats?.totalTelemetry ?? 0),
      activeAlerts: Number(alertStats?.activeAlerts ?? 0),
      triggeredAlertsToday: Number(triggeredToday?.triggeredAlertsToday ?? 0),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats/activity", async (req, res) => {
  try {
    const rawRows = await db.execute(sql`
      SELECT
        to_char(date_trunc('hour', recorded_at), 'HH24:MI') as hour,
        count(*)::int as count
      FROM telemetry
      WHERE recorded_at >= now() - interval '24 hours'
      GROUP BY date_trunc('hour', recorded_at)
      ORDER BY date_trunc('hour', recorded_at) ASC
    `);
    const rows: any[] = Array.isArray(rawRows) ? rawRows : (rawRows as any).rows ?? [];
    res.json(rows as { hour: string; count: number }[]);
  } catch (err) {
    req.log.error({ err }, "Error getting activity");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
