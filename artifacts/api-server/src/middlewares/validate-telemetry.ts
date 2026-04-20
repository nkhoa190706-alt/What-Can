import type { Request, Response, NextFunction } from "express";

const KEY_REGEX = /^[a-zA-Z0-9_\-\.]{1,64}$/;
const MAX_KEYS = 50;
const MAX_VALUE_LENGTH = 512;

/**
 * Validates and sanitizes telemetry payload on POST /api/v1/connect.
 * - Ensures body is a flat JSON object (no nested objects)
 * - Max 50 keys per request
 * - Key names: alphanumeric + underscore + hyphen + dot, 1–64 chars
 * - Values: string/number/boolean only, max 512 chars
 */
export function validateTelemetryPayload(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const payload = req.body;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return res.status(400).json({
      error: "Request body must be a flat JSON object: { \"key\": value, ... }",
    });
  }

  const keys = Object.keys(payload);
  if (keys.length === 0) {
    return res.status(400).json({ error: "At least one telemetry key is required." });
  }

  if (keys.length > MAX_KEYS) {
    return res.status(400).json({
      error: `Too many keys in one request. Maximum is ${MAX_KEYS}.`,
    });
  }

  const errors: string[] = [];
  const sanitized: Record<string, string | number | boolean> = {};

  for (const key of keys) {
    if (!KEY_REGEX.test(key)) {
      errors.push(
        `Invalid key "${key}". Keys must be 1–64 alphanumeric characters (a-z, A-Z, 0-9, _, -, .).`
      );
      continue;
    }

    const value = payload[key];
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      errors.push(
        `Invalid value type for key "${key}". Values must be a string, number, or boolean.`
      );
      continue;
    }

    const strValue = String(value);
    if (strValue.length > MAX_VALUE_LENGTH) {
      errors.push(
        `Value for key "${key}" is too long. Max ${MAX_VALUE_LENGTH} characters.`
      );
      continue;
    }

    sanitized[key] = value;
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  // Replace body with sanitized version
  req.body = sanitized;
  next();
}
