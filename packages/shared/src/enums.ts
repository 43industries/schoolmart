export const ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PARENT",
  "STUDENT",
  "VENDOR",
  "DRIVER",
  "SUPPORT",
  "FINANCE",
] as const;

export type Role = (typeof ROLES)[number];

export const SCOPE_TYPES = ["PLATFORM", "SCHOOL", "VENDOR"] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];

export const USER_STATUSES = [
  "PENDING_VERIFICATION",
  "ACTIVE",
  "SUSPENDED",
  "DISABLED",
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const SCHOOL_TYPES = [
  "PRIVATE_PRIMARY",
  "PRIVATE_SECONDARY",
  "BOARDING",
  "DAY",
  "MIXED",
] as const;
export type SchoolType = (typeof SCHOOL_TYPES)[number];

export const SCHOOL_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"] as const;
export type SchoolStatus = (typeof SCHOOL_STATUSES)[number];

export const STUDENT_STATUSES = ["ACTIVE", "INACTIVE", "GRADUATED"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const BOARDING_STATUSES = ["BOARDING", "DAY"] as const;
export type BoardingStatus = (typeof BOARDING_STATUSES)[number];

export const RELATIONSHIPS = ["MOTHER", "FATHER", "GUARDIAN", "OTHER"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const LINK_STATUSES = [
  "PENDING_SCHOOL_APPROVAL",
  "ACTIVE",
  "REJECTED",
  "REVOKED",
] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

export const ORDER_STATUSES = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PAYMENT_PROCESSING",
  "PAID",
  "GROUPED",
  "VENDOR_ACCEPTED",
  "PREPARING",
  "READY_FOR_DISPATCH",
  "DISPATCHED",
  "IN_TRANSIT",
  "RECEIVED_BY_SCHOOL",
  "READY_FOR_COLLECTION",
  "COLLECTED",
  "COMPLETED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
  "FAILED",
  "DELIVERY_FAILED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["MPESA", "CARD", "WALLET"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const VENDOR_STATUSES = ["PENDING", "APPROVED", "SUSPENDED", "REJECTED"] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const DEFAULT_TIMEZONE = "Africa/Nairobi";
export const DEFAULT_CURRENCY = "KES";
