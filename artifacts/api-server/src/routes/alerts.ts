import { Router } from "express";
import { db, alertsTable, triggeredAlertsTable, devicesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/alerts", async (req, res) => {
  try {
    const rows = await db.select({
      id: alertsTable.id,
      name: alertsTable.name,
      deviceId: alertsTable.deviceId,
      deviceName: devicesTable.name,
      telemetryKey: alertsTable.telemetryKey,
      condition: alertsTable.condition,
      threshold: alertsTable.threshold,
      severity: alertsTable.severity,
      enabled: alertsTable.enabled,
      createdAt: alertsTable.createdAt,
    }).from(alertsTable).innerJoin(devicesTable, eq(alertsTable.deviceId, devicesTable.id))
      .orderBy(desc(alertsTable.createdAt));

    res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Error listing alerts");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/alerts", async (req, res) => {
  try {
    const { name, deviceId, telemetryKey, condition, threshold, severity } = req.body;
    if (!name || !deviceId || !telemetryKey || !condition || threshold === undefined || !severity) {
      return res.status(400).json({ error: "All fields required" });
    }
    const [alert] = await db.insert(alertsTable).values({
      name, deviceId, telemetryKey, condition, threshold, severity, enabled: true,
    }).returning();

    const [device] = await db.select({ name: devicesTable.name }).from(devicesTable).where(eq(devicesTable.id, deviceId));
    res.status(201).json({
      ...alert,
      deviceName: device?.name ?? "Unknown",
      createdAt: alert.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error creating alert");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/alerts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(alertsTable).where(eq(alertsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting alert");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/alerts/triggered", async (req, res) => {
  try {
    const { limit = "50" } = req.query as { limit?: string };
    const rows = await db.select({
      id: triggeredAlertsTable.id,
      alertId: triggeredAlertsTable.alertId,
      alertName: alertsTable.name,
      deviceName: devicesTable.name,
      telemetryKey: alertsTable.telemetryKey,
      value: triggeredAlertsTable.value,
      severity: alertsTable.severity,
      triggeredAt: triggeredAlertsTable.triggeredAt,
    }).from(triggeredAlertsTable)
      .innerJoin(alertsTable, eq(triggeredAlertsTable.alertId, alertsTable.id))
      .innerJoin(devicesTable, eq(alertsTable.deviceId, devicesTable.id))
      .orderBy(desc(triggeredAlertsTable.triggeredAt))
      .limit(parseInt(limit, 10));

    res.json(rows.map(r => ({ ...r, triggeredAt: r.triggeredAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Error listing triggered alerts");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
