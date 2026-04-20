import { Router } from "express";
import { db, devicesTable, telemetryTable, alertsTable, triggeredAlertsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { rateLimit, extractToken } from "../middlewares/rate-limit";
import { validateTelemetryPayload } from "../middlewares/validate-telemetry";

const router = Router();

// 300 requests per minute per access token (5 readings/sec — plenty for any IoT device)
const connectRateLimit = rateLimit(300, 60_000, extractToken);

/**
 * POST /api/v1/connect
 * IoT device telemetry ingestion endpoint.
 *
 * Security:
 *   - Bearer token authentication (per-device access token)
 *   - Rate limit: 300 requests/min per token
 *   - Body size limit: 50 KB (set in app.ts)
 *   - Input validation: max 50 keys, key format, value types, value length
 *
 * Headers:
 *   Authorization: Bearer <accessToken>
 *   Content-Type: application/json
 *
 * Body: { "key1": value1, "key2": value2, ... }
 * Example: { "temperature": 25.3, "humidity": 60, "status": "ok" }
 */
router.post(
  "/v1/connect",
  connectRateLimit,
  validateTelemetryPayload,
  async (req, res) => {
    try {
      const token = extractToken(req);
      if (!token) {
        return res
          .status(401)
          .json({ error: "Missing Authorization header. Use: Authorization: Bearer <accessToken>" });
      }

      const [device] = await db
        .select()
        .from(devicesTable)
        .where(eq(devicesTable.accessToken, token));

      if (!device) {
        return res.status(403).json({ error: "Invalid or expired access token." });
      }

      const payload = req.body as Record<string, string | number | boolean>;
      const entries = Object.entries(payload);

      const inserted: { key: string; value: string; numericValue: number | null }[] = [];

      for (const [key, rawValue] of entries) {
        const value = String(rawValue);
        const numericValue =
          typeof rawValue === "number"
            ? rawValue
            : typeof rawValue === "boolean"
            ? rawValue ? 1 : 0
            : parseFloat(String(rawValue));
        const numeric = isNaN(numericValue) ? null : numericValue;

        await db.insert(telemetryTable).values({
          deviceId: device.id,
          key,
          value,
          numericValue: numeric,
        });

        // Check and trigger alerts
        if (numeric !== null) {
          const alerts = await db
            .select()
            .from(alertsTable)
            .where(
              and(
                eq(alertsTable.deviceId, device.id),
                eq(alertsTable.telemetryKey, key),
                eq(alertsTable.enabled, true)
              )
            );

          for (const alert of alerts) {
            let triggered = false;
            switch (alert.condition) {
              case "gt":  triggered = numeric > alert.threshold;  break;
              case "lt":  triggered = numeric < alert.threshold;  break;
              case "eq":  triggered = numeric === alert.threshold; break;
              case "gte": triggered = numeric >= alert.threshold; break;
              case "lte": triggered = numeric <= alert.threshold; break;
            }
            if (triggered) {
              await db
                .insert(triggeredAlertsTable)
                .values({ alertId: alert.id, value: String(numeric) });
            }
          }
        }

        inserted.push({ key, value, numericValue: numeric });
      }

      // Mark device as online after successful data ingestion
      await db
        .update(devicesTable)
        .set({ status: "online", updatedAt: new Date() })
        .where(eq(devicesTable.id, device.id));

      res.status(200).json({
        deviceId: device.id,
        deviceName: device.name,
        recorded: inserted.length,
        keys: inserted.map((i) => i.key),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      req.log.error({ err }, "Error in /api/v1/connect");
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * GET /api/v1/connect/test
 * Validate token and return device info without writing data.
 */
router.get("/v1/connect/test", async (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const [device] = await db
      .select({
        id: devicesTable.id,
        name: devicesTable.name,
        type: devicesTable.type,
        status: devicesTable.status,
      })
      .from(devicesTable)
      .where(eq(devicesTable.accessToken, token));

    if (!device) return res.status(403).json({ error: "Invalid access token" });

    res.json({ ok: true, device });
  } catch (err) {
    req.log.error({ err }, "Error testing connection");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
