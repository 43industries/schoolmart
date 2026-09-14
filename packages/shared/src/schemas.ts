import { z } from "zod";
import { normalizeKenyaPhone } from "./phone.js";
import {
  RELATIONSHIPS,
  SCHOOL_TYPES,
  ROLES,
  SCOPE_TYPES,
  VENDOR_STATUSES,
  PRODUCT_STATUSES,
  VENDOR_SELL_CATEGORIES,
  WALLET_RULE_CATEGORIES,
  WALLET_RULE_PERIODS,
  ACTIVITY_CATEGORIES,
  ACTIVITY_STATUSES,
} from "./enums.js";

export const emailSchema = z.string().email().toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number");

export const phoneSchema = z
  .string()
  .transform((val, ctx) => {
    const normalized = normalizeKenyaPhone(val);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid Kenyan phone number" });
      return z.NEVER;
    }
    return normalized;
  });

export const childOnboardingSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  schoolId: z.string().uuid(),
  /** Admission number — unique with school, not a global DB primary key */
  studentNumber: z.string().min(1).max(50),
  classTeacherName: z.string().min(1).max(150),
  relationship: z.enum(RELATIONSHIPS),
});

export const registerSchema = z
  .object({
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    password: passwordSchema,
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    child: childOnboardingSchema,
  })
  .refine((data) => data.email || data.phone, {
    message: "Email or phone is required",
    path: ["email"],
  });

export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
});

export const createSchoolSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  type: z.enum(SCHOOL_TYPES),
  county: z.string().min(1).max(100),
  town: z.string().min(1).max(100),
  addressLine: z.string().max(500).optional(),
  boardingSupported: z.boolean().default(false),
  collectionPinRequired: z.boolean().default(true),
});

export const updateSchoolSchema = createSchoolSchema.partial().extend({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]).optional(),
});

export const createStudentSchema = z.object({
  studentNumber: z.string().min(1).max(50),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  preferredName: z.string().max(100).optional(),
  grade: z.string().min(1).max(50),
  className: z.string().max(50).optional(),
  boardingStatus: z.enum(["BOARDING", "DAY"]),
  collectionPin: z.string().min(4).max(6).optional(),
});

export const linkChildSchema = childOnboardingSchema;

export const createAdminUserSchema = z.object({
  email: emailSchema,
  phone: phoneSchema.optional(),
  password: passwordSchema,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(ROLES),
  scopeType: z.enum(SCOPE_TYPES),
  scopeId: z.string().uuid().optional(),
});

export const createVendorSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().max(2000).optional(),
  contactEmail: emailSchema.optional(),
  contactPhone: phoneSchema.optional(),
});

export const updateVendorSchema = createVendorSchema.partial().extend({
  status: z.enum(VENDOR_STATUSES).optional(),
});

export const registerVendorSchema = z
  .object({
    businessName: z.string().min(2).max(200),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    password: passwordSchema,
    description: z.string().max(2000).optional(),
    county: z.string().min(2).max(100),
    town: z.string().min(2).max(100),
    addressLine: z.string().max(300).optional(),
    sellCategories: z.array(z.enum(VENDOR_SELL_CATEGORIES)).min(1, "Select at least one category"),
    acceptVendorTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the vendor terms" }),
    }),
    acceptPlatformAgreement: z.literal(true, {
      errorMap: () => ({ message: "You must accept the platform agreement" }),
    }),
  })
  .refine((data) => data.email || data.phone, {
    message: "Email or phone is required",
    path: ["email"],
  });

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  parentId: z.string().uuid().optional(),
  sortOrder: z.number().int().default(0),
});

export const createProductSchema = z.object({
  vendorId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional(),
  priceMinor: z.number().int().positive(),
  status: z.enum(PRODUCT_STATUSES).default("DRAFT"),
  availableQty: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
});

export const updateProductSchema = createProductSchema.partial().omit({ vendorId: true });

export const catalogSearchSchema = z.object({
  schoolId: z.string().uuid(),
  q: z.string().max(200).optional(),
  categoryId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  minPrice: z.coerce.number().int().optional(),
  maxPrice: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const addCartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99).default(1),
  schoolId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(99),
});

export const fundWalletSchema = z.object({
  studentId: z.string().uuid(),
  /** Amount in minor units (cents). e.g. 100000 = KSh 1,000 */
  amountMinor: z.number().int().positive().max(50_000_000),
  phone: phoneSchema.optional(),
});

export const upsertWalletRuleSchema = z.object({
  studentId: z.string().uuid(),
  category: z.enum(WALLET_RULE_CATEGORIES),
  period: z.enum(WALLET_RULE_PERIODS),
  limitMinor: z.number().int().positive().max(50_000_000),
  requiresApproval: z.boolean().default(false),
});

export const activateStudentSchema = z
  .object({
    schoolId: z.string().uuid(),
    studentNumber: z.string().min(1).max(50),
    collectionPin: z.string().min(4).max(6),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    password: passwordSchema,
  })
  .refine((data) => data.email || data.phone, {
    message: "Email or phone is required",
    path: ["email"],
  });

export const confirmCollectionSchema = z.object({
  orderId: z.string().uuid(),
  collectionPin: z.string().min(4).max(6),
});

export const createActivitySchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  category: z.enum(ACTIVITY_CATEGORIES).default("FUNKIES"),
  location: z.string().max(200).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  feeMinor: z.number().int().min(0).max(50_000_000).default(0),
  capacity: z.number().int().positive().max(10000).optional(),
  status: z.enum(ACTIVITY_STATUSES).default("DRAFT"),
});

export const updateActivitySchema = createActivitySchema.partial();

export const registerActivitySchema = z.object({
  activityId: z.string().uuid(),
  studentId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export const confirmActivityRegistrationSchema = z.object({
  registrationId: z.string().uuid(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type LinkChildInput = z.infer<typeof linkChildSchema>;
export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;
export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type RegisterVendorInput = z.infer<typeof registerVendorSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CatalogSearchInput = z.infer<typeof catalogSearchSchema>;
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type FundWalletInput = z.infer<typeof fundWalletSchema>;
export type UpsertWalletRuleInput = z.infer<typeof upsertWalletRuleSchema>;
export type ActivateStudentInput = z.infer<typeof activateStudentSchema>;
export type ConfirmCollectionInput = z.infer<typeof confirmCollectionSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type RegisterActivityInput = z.infer<typeof registerActivitySchema>;
export type ConfirmActivityRegistrationInput = z.infer<typeof confirmActivityRegistrationSchema>;
