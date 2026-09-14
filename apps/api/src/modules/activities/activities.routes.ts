import type { FastifyInstance } from "fastify";
import {
  createActivitySchema,
  updateActivitySchema,
  registerActivitySchema,
  confirmActivityRegistrationSchema,
} from "@schoolmart/shared";
import { authenticate, requireParent, requireSchoolAdmin, requireStudent } from "../../middleware/auth.js";
import { auditContextFromRequest } from "../audit/audit.service.js";
import { ValidationError } from "../../lib/errors.js";
import {
  listSchoolActivities,
  createSchoolActivity,
  updateSchoolActivity,
  listParentActivities,
  registerForActivity,
  confirmActivityRegistration,
  listStudentActivities,
  studentSelfRegisterActivity,
} from "./activities.service.js";

export async function schoolActivityRoutes(app: FastifyInstance) {
  app.get("/:id/activities", {
    preHandler: [authenticate, requireSchoolAdmin("id")],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const activities = await listSchoolActivities(id, true);
    return reply.send({ activities });
  });

  app.post("/:id/activities", {
    preHandler: [authenticate, requireSchoolAdmin("id")],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = createActivitySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const activity = await createSchoolActivity(
      id,
      parsed.data,
      req.user!.sub,
      auditContextFromRequest(req, req.user!.sub),
    );
    return reply.status(201).send(activity);
  });

  app.patch("/:id/activities/:activityId", {
    preHandler: [authenticate, requireSchoolAdmin("id")],
  }, async (req, reply) => {
    const { id, activityId } = req.params as { id: string; activityId: string };
    const parsed = updateActivitySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const activity = await updateSchoolActivity(
      id,
      activityId,
      parsed.data,
      auditContextFromRequest(req, req.user!.sub),
    );
    return reply.send(activity);
  });
}

export async function parentActivityRoutes(app: FastifyInstance) {
  app.get("/activities", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const result = await listParentActivities(req.user!.sub);
    return reply.send(result);
  });

  app.post("/activities/register", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const parsed = registerActivitySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const registration = await registerForActivity(
      req.user!.sub,
      parsed.data,
      auditContextFromRequest(req, req.user!.sub),
    );
    return reply.status(201).send(registration);
  });

  app.post("/activities/confirm", { preHandler: [authenticate, requireParent()] }, async (req, reply) => {
    const parsed = confirmActivityRegistrationSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.flatten());

    const registration = await confirmActivityRegistration(
      req.user!.sub,
      parsed.data,
      auditContextFromRequest(req, req.user!.sub),
    );
    return reply.send(registration);
  });
}

export async function studentActivityRoutes(app: FastifyInstance) {
  app.get("/me/activities", { preHandler: [authenticate, requireStudent()] }, async (req, reply) => {
    const activities = await listStudentActivities(req.user!.sub);
    return reply.send({ activities });
  });

  app.post("/me/activities/:activityId/register", {
    preHandler: [authenticate, requireStudent()],
  }, async (req, reply) => {
    const { activityId } = req.params as { activityId: string };
    const registration = await studentSelfRegisterActivity(
      req.user!.sub,
      activityId,
      auditContextFromRequest(req, req.user!.sub),
    );
    return reply.status(201).send(registration);
  });
}
