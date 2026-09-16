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

export const PAYMENT_METHODS = ["MPESA", "CARD", "BANK", "WALLET", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_PURPOSES = ["FUND_WALLET", "ORDER_CHECKOUT"] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

export const FUNDING_METHODS = ["MPESA", "CARD", "BANK", "OTHER"] as const;
export type FundingMethod = (typeof FUNDING_METHODS)[number];

export const CHECKOUT_METHODS = ["WALLET", "MPESA", "CARD", "BANK"] as const;
export type CheckoutMethod = (typeof CHECKOUT_METHODS)[number];

export const VENDOR_STATUSES = ["PENDING", "APPROVED", "SUSPENDED", "REJECTED"] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const VENDOR_SELL_CATEGORIES = [
  "MEALS_SNACKS",
  "SCHOOL_SUPPLIES",
  "PERSONAL_CARE",
  "CARE_PACKAGES",
  "EXAM_ESSENTIALS",
  "CAMPUS_ESSENTIALS",
] as const;
export type VendorSellCategory = (typeof VENDOR_SELL_CATEGORIES)[number];

export const VENDOR_TERMS_VERSION = "1.0";
export const PLATFORM_AGREEMENT_VERSION = "1.0";

export const WALLET_TX_TYPES = [
  "CREDIT_FUND",
  "DEBIT_SPEND",
  "CREDIT_REFUND",
  "ADJUSTMENT",
] as const;
export type WalletTxType = (typeof WALLET_TX_TYPES)[number];

export const WALLET_RULE_PERIODS = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type WalletRulePeriod = (typeof WALLET_RULE_PERIODS)[number];

export const WALLET_RULE_CATEGORIES = [
  "ALL",
  "MEALS_SNACKS",
  "SCHOOL_SUPPLIES",
  "PERSONAL_CARE",
  "CARE_PACKAGES",
  "EXAM_ESSENTIALS",
  "CAMPUS_ESSENTIALS",
] as const;
export type WalletRuleCategory = (typeof WALLET_RULE_CATEGORIES)[number];

export const ACTIVITY_CATEGORIES = [
  "FUNKIES",
  "SPORTS",
  "TRIP",
  "CLUB",
  "ACADEMIC",
  "OTHER",
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const ACTIVITY_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED", "CANCELLED"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const ACTIVITY_REGISTRATION_STATUSES = [
  "PENDING_PARENT",
  "CONFIRMED",
  "CANCELLED",
  "REJECTED",
] as const;
export type ActivityRegistrationStatus = (typeof ACTIVITY_REGISTRATION_STATUSES)[number];

export const VEHICLE_TYPES = ["CANTER", "PICKUP", "VAN", "BODA"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const DELIVERY_PARTNER_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"] as const;
export type DeliveryPartnerStatus = (typeof DELIVERY_PARTNER_STATUSES)[number];

export const DEFAULT_TIMEZONE = "Africa/Nairobi";
export const DEFAULT_CURRENCY = "KES";
