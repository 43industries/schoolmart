import { prisma, Role, ScopeType, UserStatus, DeliveryPartnerStatus } from "@schoolmart/db";
import type { RegisterDeliveryPartnerInput } from "@schoolmart/shared";
import { ConflictError } from "../../lib/errors.js";
import { hashPassword } from "../../lib/crypto.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";

export interface LogbookMeta {
  storedName: string;
  fileName: string;
  mimetype: string;
}

export async function registerDeliveryPartner(
  input: RegisterDeliveryPartnerInput,
  ctx: AuditContext,
  logbook?: LogbookMeta,
) {
  const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingEmail) throw new ConflictError("Email already registered");

  const existingPhone = await prisma.user.findUnique({ where: { phoneE164: input.phone } });
  if (existingPhone) throw new ConflictError("Phone already registered");

  const existingPlate = await prisma.deliveryPartner.findUnique({
    where: { vehiclePlateNumber: input.vehiclePlateNumber },
  });
  if (existingPlate) throw new ConflictError("Vehicle plate number already registered");

  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        phoneE164: input.phone,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: now,
        phoneVerifiedAt: now,
        roles: {
          create: { role: Role.DRIVER, scopeType: ScopeType.PLATFORM },
        },
      },
    });

    const partner = await tx.deliveryPartner.create({
      data: {
        ownerUserId: user.id,
        status: DeliveryPartnerStatus.PENDING,
        county: input.county,
        town: input.town,
        serviceTowns: input.serviceTowns,
        vehicleTypes: input.vehicleTypes,
        primaryVehicleType: input.primaryVehicleType,
        vehiclePlateNumber: input.vehiclePlateNumber,
        logbookFileName: logbook?.fileName,
        logbookMimeType: logbook?.mimetype,
        logbookStoredName: logbook?.storedName,
        termsAcceptedAt: now,
      },
    });

    await tx.userRole.updateMany({
      where: { userId: user.id, role: Role.DRIVER },
      data: { scopeId: partner.id },
    });

    return { user, partner };
  });

  await writeAuditLog({
    action: "DELIVERY_PARTNER_REGISTERED",
    resourceType: "DeliveryPartner",
    resourceId: result.partner.id,
    metadata: {
      vehicleTypes: input.vehicleTypes,
      primaryVehicleType: input.primaryVehicleType,
      vehiclePlateNumber: input.vehiclePlateNumber,
      hasLogbook: !!logbook,
      town: input.town,
      county: input.county,
    },
    context: { ...ctx, actorUserId: result.user.id },
  });

  return {
    userId: result.user.id,
    partnerId: result.partner.id,
    status: result.partner.status,
  };
}
