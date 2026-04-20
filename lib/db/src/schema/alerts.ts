import { pgTable, serial, integer, text, real, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { devicesTable } from "./devices";

export const alertConditionEnum = pgEnum("alert_condition", ["gt", "lt", "eq", "gte", "lte"]);
export const alertSeverityEnum = pgEnum("alert_severity", ["info", "warning", "critical"]);

export const alertsTable = pgTable("alerts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  deviceId: integer("device_id").notNull().references(() => devicesTable.id, { onDelete: "cascade" }),
  telemetryKey: text("telemetry_key").notNull(),
  condition: alertConditionEnum("condition").notNull(),
  threshold: real("threshold").notNull(),
  severity: alertSeverityEnum("severity").notNull().default("warning"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAlertSchema = createInsertSchema(alertsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alertsTable.$inferSelect;

export const triggeredAlertsTable = pgTable("triggered_alerts", {
  id: serial("id").primaryKey(),
  alertId: integer("alert_id").notNull().references(() => alertsTable.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
});

export type TriggeredAlert = typeof triggeredAlertsTable.$inferSelect;
