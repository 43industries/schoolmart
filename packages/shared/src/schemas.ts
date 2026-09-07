import { z } from "zod";
import { normalizeKenyaPhone } from "./phone.js";
import {
  RELATIONSHIPS,
  SCHOOL_TYPES,
  ROLES,
  SCOPE_TYPES,
  VENDOR_STATUSES,
  PRODUCT_STATUSES,
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

export const registerSchema = z
  .object({
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    password: passwordSchema,
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
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

export const linkChildSchema = z.object({
  schoolId: z.string().uuid(),
  studentNumber: z.string().min(1).max(50),
  relationship: z.enum(RELATIONSHIPS),
});

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
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CatalogSearchInput = z.infer<typeof catalogSearchSchema>;
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
