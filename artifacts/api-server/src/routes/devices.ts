import { Router } from "express";
import { db, devicesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

const router = Router();

router.get("/devices", async (req, res) => {
  try {
    const { status, type } = req.query as { status?: string; type?: string };
    let query = db.select().from(devicesTable);
    const conditions: ReturnType<typeof eq>[] = [];
    if (status) conditions.push(eq(devicesTable.status, status as "online" | "offline" | "inactive"));
    if (type) conditions.push(eq(devicesTable.type, type));

    let devices;
    if (conditions.length > 0) {
      const { and } = await import("drizzle-orm");
      devices = await db.select().from(devicesTable).where(and(...conditions));
    } else {
      devices = await db.select().from(devicesTable);
    }

    res.json(devices.map(d => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Error listing devices");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/devices", async (req, res) => {
  try {
    const { name, type, description, location } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: "name and type are required" });
    }
    const accessToken = randomBytes(16).toString("hex");
    const [device] = await db.insert(devicesTable).values({
      name,
      type,
      description: description || null,
      location: location || null,
      accessToken,
      status: "offline",
    }).returning();

    res.status(201).json({
      ...device,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error creating device");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/devices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, id));
    if (!device) return res.status(404).json({ error: "Device not found" });
    res.json({
      ...device,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting device");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/devices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, type, status, description, location } = req.body;
    const updates: Partial<typeof devicesTable.$inferInsert> = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (status !== undefined) updates.status = status;
    if (description !== undefined) updates.description = description;
    if (location !== undefined) updates.location = location;
    updates.updatedAt = new Date();

    const [device] = await db.update(devicesTable).set(updates).where(eq(devicesTable.id, id)).returning();
    if (!device) return res.status(404).json({ error: "Device not found" });
    res.json({
      ...device,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error updating device");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/devices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(devicesTable).where(eq(devicesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting device");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /devices/:id/regenerate-token
 * Generate a new access token for the device. Invalidates the old token immediately.
 */
router.post("/devices/:id/regenerate-token", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const newToken = randomBytes(24).toString("hex");

    const [device] = await db
      .update(devicesTable)
      .set({ accessToken: newToken, updatedAt: new Date() })
      .where(eq(devicesTable.id, id))
      .returning();

    if (!device) return res.status(404).json({ error: "Device not found" });

    res.json({
      accessToken: device.accessToken,
      message: "Token regenerated. Update your device firmware with the new token.",
    });
  } catch (err) {
    req.log.error({ err }, "Error regenerating token");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
