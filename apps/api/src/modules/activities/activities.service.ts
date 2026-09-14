import {
  prisma,
  ActivityStatus,
  ActivityRegistrationStatus,
  LinkStatus,
} from "@schoolmart/db";
import type {
  CreateActivityInput,
  UpdateActivityInput,
  RegisterActivityInput,
  ConfirmActivityRegistrationInput,
} from "@schoolmart/shared";
import { ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";

export async function listSchoolActivities(schoolId: string, includeDrafts = false) {
  return prisma.schoolActivity.findMany({
    where: {
      schoolId,
      ...(includeDrafts ? {} : { status: ActivityStatus.PUBLISHED }),
    },
    include: {
      _count: { select: { registrations: true } },
    },
    orderBy: { startsAt: "asc" },
  });
}

export async function createSchoolActivity(
  schoolId: string,
  input: CreateActivityInput,
  createdByUserId: string,
  ctx: AuditContext,
) {
  const activity = await prisma.schoolActivity.create({
    data: {
      schoolId,
      title: input.title,
      description: input.description,
      category: input.category,
      location: input.location,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      feeMinor: input.feeMinor,
      capacity: input.capacity,
      status: input.status as ActivityStatus,
      createdByUserId,
    },
  });

  await writeAuditLog({
    action: "ACTIVITY_CREATED",
    resourceType: "SchoolActivity",
    resourceId: activity.id,
    metadata: { schoolId, title: activity.title },
    context: { ...ctx, actorUserId: createdByUserId },
  });

  return activity;
}

export async function updateSchoolActivity(
  schoolId: string,
  activityId: string,
  input: UpdateActivityInput,
  ctx: AuditContext,
) {
  const existing = await prisma.schoolActivity.findFirst({ where: { id: activityId, schoolId } });
  if (!existing) throw new NotFoundError("Activity not found");

  const activity = await prisma.schoolActivity.update({
    where: { id: activityId },
    data: {
      ...input,
      status: input.status as ActivityStatus | undefined,
    },
  });

  await writeAuditLog({
    action: "ACTIVITY_UPDATED",
    resourceType: "SchoolActivity",
    resourceId: activityId,
    metadata: input,
    context: ctx,
  });

  return activity;
}

export async function listParentActivities(parentUserId: string) {
  const links = await prisma.parentStudentLink.findMany({
    where: { parentUserId, status: LinkStatus.ACTIVE },
    select: {
      studentId: true,
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          schoolId: true,
          school: { select: { id: true, name: true } },
        },
      },
    },
  });

  const schoolIds = [...new Set(links.map((l) => l.student.schoolId))];
  if (schoolIds.length === 0) return { activities: [], children: links.map((l) => l.student) };

  const activities = await prisma.schoolActivity.findMany({
    where: { schoolId: { in: schoolIds }, status: ActivityStatus.PUBLISHED },
    include: {
      school: { select: { id: true, name: true } },
      registrations: {
        where: { parentUserId },
        select: {
          id: true,
          studentId: true,
          status: true,
          paidMinor: true,
          confirmedAt: true,
        },
      },
      _count: { select: { registrations: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  return {
    children: links.map((l) => l.student),
    activities: activities.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      category: a.category,
      location: a.location,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      feeMinor: a.feeMinor,
      capacity: a.capacity,
      registrationCount: a._count.registrations,
      school: a.school,
      myRegistrations: a.registrations,
    })),
  };
}

export async function registerForActivity(
  parentUserId: string,
  input: RegisterActivityInput,
  ctx: AuditContext,
) {
  const link = await prisma.parentStudentLink.findUnique({
    where: { parentUserId_studentId: { parentUserId, studentId: input.studentId } },
  });
  if (!link || link.status !== LinkStatus.ACTIVE) {
    throw new ForbiddenError("You can only register approved children");
  }

  const activity = await prisma.schoolActivity.findUnique({ where: { id: input.activityId } });
  if (!activity || activity.status !== ActivityStatus.PUBLISHED) {
    throw new NotFoundError("Activity not available");
  }

  const student = await prisma.student.findUnique({ where: { id: input.studentId } });
  if (!student || student.schoolId !== activity.schoolId) {
    throw new ForbiddenError("Child is not at this school");
  }

  if (activity.capacity != null) {
    const count = await prisma.activityRegistration.count({
      where: {
        activityId: activity.id,
        status: { in: [ActivityRegistrationStatus.PENDING_PARENT, ActivityRegistrationStatus.CONFIRMED] },
      },
    });
    if (count >= activity.capacity) throw new ConflictError("Activity is full");
  }

  const existing = await prisma.activityRegistration.findUnique({
    where: { activityId_studentId: { activityId: activity.id, studentId: input.studentId } },
  });
  if (existing) throw new ConflictError("Already registered for this activity");

  const registration = await prisma.activityRegistration.create({
    data: {
      activityId: activity.id,
      studentId: input.studentId,
      parentUserId,
      notes: input.notes,
      status:
        activity.feeMinor > 0
          ? ActivityRegistrationStatus.PENDING_PARENT
          : ActivityRegistrationStatus.CONFIRMED,
      paidMinor: 0,
      confirmedAt: activity.feeMinor > 0 ? undefined : new Date(),
    },
    include: {
      activity: { select: { id: true, title: true, feeMinor: true, startsAt: true } },
      student: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  await writeAuditLog({
    action: "ACTIVITY_REGISTERED",
    resourceType: "ActivityRegistration",
    resourceId: registration.id,
    metadata: { activityId: activity.id, studentId: input.studentId },
    context: { ...ctx, actorUserId: parentUserId },
  });

  return registration;
}

export async function confirmActivityRegistration(
  parentUserId: string,
  input: ConfirmActivityRegistrationInput,
  ctx: AuditContext,
) {
  const registration = await prisma.activityRegistration.findFirst({
    where: {
      id: input.registrationId,
      parentUserId,
      status: ActivityRegistrationStatus.PENDING_PARENT,
    },
    include: { activity: true },
  });
  if (!registration) throw new NotFoundError("Pending registration not found");

  const updated = await prisma.activityRegistration.update({
    where: { id: registration.id },
    data: {
      status: ActivityRegistrationStatus.CONFIRMED,
      paidMinor: registration.activity.feeMinor,
      confirmedAt: new Date(),
    },
  });

  await writeAuditLog({
    action: "ACTIVITY_REGISTRATION_CONFIRMED",
    resourceType: "ActivityRegistration",
    resourceId: registration.id,
    metadata: { paidMinor: registration.activity.feeMinor, mockPay: true },
    context: { ...ctx, actorUserId: parentUserId },
  });

  return updated;
}

export async function listStudentActivities(userId: string) {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) throw new NotFoundError("Student profile not found");

  const activities = await prisma.schoolActivity.findMany({
    where: { schoolId: student.schoolId, status: ActivityStatus.PUBLISHED },
    include: {
      registrations: {
        where: { studentId: student.id },
        select: { id: true, status: true, paidMinor: true, confirmedAt: true },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  return activities.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    category: a.category,
    location: a.location,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    feeMinor: a.feeMinor,
    registration: a.registrations[0] ?? null,
  }));
}

export async function studentSelfRegisterActivity(
  userId: string,
  activityId: string,
  ctx: AuditContext,
) {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) throw new NotFoundError("Student profile not found");

  const parentLink = await prisma.parentStudentLink.findFirst({
    where: { studentId: student.id, status: LinkStatus.ACTIVE },
    orderBy: { approvedAt: "asc" },
  });
  if (!parentLink) {
    throw new ForbiddenError("An approved parent link is required before registering");
  }

  const activity = await prisma.schoolActivity.findUnique({ where: { id: activityId } });
  if (!activity || activity.status !== ActivityStatus.PUBLISHED) {
    throw new NotFoundError("Activity not available");
  }
  if (activity.schoolId !== student.schoolId) {
    throw new ForbiddenError("Activity is not at your school");
  }

  if (activity.capacity != null) {
    const count = await prisma.activityRegistration.count({
      where: {
        activityId: activity.id,
        status: { in: [ActivityRegistrationStatus.PENDING_PARENT, ActivityRegistrationStatus.CONFIRMED] },
      },
    });
    if (count >= activity.capacity) throw new ConflictError("Activity is full");
  }

  const existing = await prisma.activityRegistration.findUnique({
    where: { activityId_studentId: { activityId: activity.id, studentId: student.id } },
  });
  if (existing) throw new ConflictError("Already registered for this activity");

  let status: ActivityRegistrationStatus = ActivityRegistrationStatus.CONFIRMED;
  let paidMinor = 0;
  let confirmedAt: Date | undefined = new Date();

  if (activity.feeMinor > 0) {
    const { evaluateWalletSpend, debitWalletSpend } = await import("../cart/checkout.service.js");
    const evalResult = await evaluateWalletSpend(student.id, activity.feeMinor, "ALL");
    if (!evalResult.ok || evalResult.requiresApproval) {
      status = ActivityRegistrationStatus.PENDING_PARENT;
      confirmedAt = undefined;
    } else {
      await debitWalletSpend({
        studentId: student.id,
        amountMinor: activity.feeMinor,
        description: `Activity: ${activity.title}`,
        referenceId: `activity-${activity.id}-${student.id}`,
      });
      paidMinor = activity.feeMinor;
    }
  }

  const registration = await prisma.activityRegistration.create({
    data: {
      activityId: activity.id,
      studentId: student.id,
      parentUserId: parentLink.parentUserId,
      status,
      paidMinor,
      confirmedAt,
    },
    include: {
      activity: { select: { id: true, title: true, feeMinor: true, startsAt: true } },
    },
  });

  await writeAuditLog({
    action: "ACTIVITY_STUDENT_SELF_REGISTERED",
    resourceType: "ActivityRegistration",
    resourceId: registration.id,
    metadata: { activityId, status },
    context: { ...ctx, actorUserId: userId },
  });

  return registration;
}

