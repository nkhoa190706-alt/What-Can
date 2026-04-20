import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { devicesTable } from "./devices";

export const telemetryTable = pgTable("telemetry", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devicesTable.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: text("value").notNull(),
  numericValue: real("numeric_value"),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export const insertTelemetrySchema = createInsertSchema(telemetryTable).omit({
  id: true,
  recordedAt: true,
});

export type InsertTelemetry = z.infer<typeof insertTelemetrySchema>;
export type Telemetry = typeof telemetryTable.$inferSelect;
