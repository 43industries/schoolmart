import type { FastifyInstance } from "fastify";
import { registerDeliveryPartnerSchema } from "@schoolmart/shared";
import { registerDeliveryPartner } from "./deliveries.service.js";
import { auditContextFromRequest } from "../audit/audit.service.js";
import { AppError, ValidationError } from "../../lib/errors.js";
import { saveLogbook } from "../uploads/uploads.service.js";

function asBool(v: unknown): unknown {
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}

export async function publicDeliveryRoutes(app: FastifyInstance) {
  app.post("/register", async (req, reply) => {
    let raw: Record<string, unknown> = {};
    let logbook: Awaited<ReturnType<typeof saveLogbook>> | undefined;

    if (req.isMultipart()) {
      const fields: Record<string, unknown> = {};
      const vehicleTypes: string[] = [];
      for await (const part of req.parts()) {
        if (part.type === "file") {
          if (part.fieldname === "logbook") {
            const buffer = await part.toBuffer();
            logbook = await saveLogbook({ buffer, mimetype: part.mimetype, originalFilename: part.filename });
          } else {
            await part.toBuffer();
          }
        } else if (part.fieldname === "vehicleTypes") {
          const v = String(part.value);
          // Accept repeated fields, comma lists, or a JSON array string.
          if (v.trim().startsWith("[")) {
            try {
              const arr = JSON.parse(v) as unknown;
              if (Array.isArray(arr)) vehicleTypes.push(...arr.map(String));
            } catch { /* validated below */ }
          } else {
            vehicleTypes.push(...v.split(",").map((s) => s.trim()).filter(Boolean));
          }
        } else {
          fields[part.fieldname] = part.value;
        }
      }
      raw = { ...fields, vehicleTypes, acceptTerms: asBool(fields.acceptTerms) };
    } else {
      raw = (req.body ?? {}) as Record<string, unknown>;
    }

    const parsed = registerDeliveryPartnerSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());
    if (!logbook) throw new AppError(400, "Attach a copy of the vehicle logbook");
    const result = await registerDeliveryPartner(parsed.data, auditContextFromRequest(req), logbook);
    return reply.status(201).send({
      success: true,
      ...result,
      message:
        "Delivery partner application submitted. Log in after approval to manage deliveries near schools.",
    });
  });
}
