const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, data.message ?? "Request failed", data.error, data.details);
  }

  return data as T;
}

export interface UserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: string;
  roles: Array<{ role: string; scopeType: string; scopeId: string | null }>;
  hasParentProfile: boolean;
  createdAt: string;
}

export interface School {
  id: string;
  name: string;
  town: string;
  county?: string;
  type?: string;
  boardingSupported?: boolean;
}

export interface ParentLink {
  id: string;
  status: string;
  relationship: string;
  claimedFirstName?: string | null;
  claimedLastName?: string | null;
  classTeacherName?: string | null;
  approvedAt: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    preferredName?: string | null;
    studentNumber: string;
    grade: string;
    className?: string;
    boardingStatus?: string;
    school: { id: string; name: string; town: string };
  };
  createdAt: string;
}

export const authApi = {
  register: (data: {
    email?: string;
    phone?: string;
    password: string;
    firstName: string;
    lastName: string;
    child: {
      firstName: string;
      lastName: string;
      schoolId: string;
      studentNumber: string;
      classTeacherName: string;
      relationship: string;
    };
  }) =>
    api<{ success: boolean; userId: string; linkId: string }>("/auth/register", { method: "POST", body: data }),

  login: (data: { identifier: string; password: string }) =>
    api<{ accessToken: string; user: { sub: string; roles: UserProfile["roles"] } }>("/auth/login", { method: "POST", body: data }),

  logout: () => api<{ success: boolean }>("/auth/logout", { method: "POST" }),

  me: () => api<UserProfile>("/users/me"),
};

export const vendorsApi = {
  register: (data: Record<string, unknown>) =>
    api<{ success: boolean; userId: string; vendorId: string; status: string; message: string }>(
      "/vendors/register",
      { method: "POST", body: data },
    ),
};

export const schoolsApi = {
  list: () => api<{ schools: School[] }>("/schools"),
  get: (id: string) => api<School>(`/schools/${id}`),
};

export const parentsApi = {
  children: () => api<{ children: ParentLink[] }>("/parents/children"),
  linkChild: (data: {
    firstName: string;
    lastName: string;
    schoolId: string;
    studentNumber: string;
    classTeacherName: string;
    relationship: string;
  }) => api<ParentLink>("/parents/children/link", { method: "POST", body: data }),
};

export interface ParentWalletSummary {
  studentId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentNumber: string;
    school: { id: string; name: string };
  };
  wallet: {
    id: string;
    balanceMinor: number;
    currency: string;
    lowBalanceThresholdMinor: number;
    rules: Array<{
      id: string;
      category: string;
      period: string;
      limitMinor: number;
      requiresApproval: boolean;
    }>;
    updatedAt: string;
  };
}

export interface ParentWalletDetail extends ParentWalletSummary {
  wallet: ParentWalletSummary["wallet"] & {
    transactions: Array<{
      id: string;
      type: string;
      amountMinor: number;
      balanceAfterMinor: number;
      description: string | null;
      referenceId: string | null;
      createdAt: string;
    }>;
  };
}

export const walletsApi = {
  list: () => api<{ wallets: ParentWalletSummary[] }>("/parents/wallets"),
  get: (studentId: string) => api<ParentWalletDetail>(`/parents/wallets/${studentId}`),
  fund: (data: { studentId: string; amountMinor: number; phone?: string }) =>
    api<{
      balanceMinor: number;
      currency: string;
      referenceId: string;
      provider: string;
      transaction: { id: string; amountMinor: number; balanceAfterMinor: number };
    }>("/parents/wallets/fund", { method: "POST", body: data }),
  upsertRule: (data: {
    studentId: string;
    category: string;
    period: string;
    limitMinor: number;
    requiresApproval?: boolean;
  }) => api<{ id: string }>("/parents/wallets/rules", { method: "PUT", body: data }),
  deleteRule: (ruleId: string) =>
    api<{ success: boolean }>(`/parents/wallets/rules/${ruleId}`, { method: "DELETE" }),
};

export const adminApi = {
  schools: () => api<{ schools: unknown[] }>("/admin/schools"),
  auditLogs: (page = 1) => api<{ logs: unknown[]; pagination: unknown }>(`/admin/audit-logs?page=${page}`),
  vendors: () => api<{ vendors: Vendor[] }>("/admin/vendors"),
  categories: () => api<{ categories: Category[] }>("/admin/categories"),
  products: () => api<{ products: Product[] }>("/admin/products"),
  createVendor: (data: { name: string; slug: string; description?: string; contactEmail?: string }) =>
    api<Vendor>("/admin/vendors", { method: "POST", body: data }),
  updateVendor: (id: string, data: Partial<Vendor>) =>
    api<Vendor>(`/admin/vendors/${id}`, { method: "PATCH", body: data }),
  createProduct: (data: Record<string, unknown>) =>
    api<Product>("/admin/products", { method: "POST", body: data }),
};

export interface Vendor {
  id: string;
  name: string;
  slug: string;
  status: string;
  description?: string | null;
  _count?: { products: number };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  priceMinor: number;
  status: string;
  vendor?: { id: string; name: string };
  category?: { id: string; name: string } | null;
  inventory?: { availableQty: number } | null;
}

export interface CartResponse {
  id: string | null;
  schoolId?: string | null;
  studentId?: string | null;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    lineTotalMinor: number;
    product: {
      id: string;
      name: string;
      priceMinor: number;
      vendor: { id: string; name: string };
      availableQty: number;
    };
  }>;
  subtotalMinor: number;
  itemCount: number;
}

export const catalogApi = {
  search: (params: { schoolId: string; q?: string; categoryId?: string; page?: number }) => {
    const qs = new URLSearchParams();
    qs.set("schoolId", params.schoolId);
    if (params.q) qs.set("q", params.q);
    if (params.categoryId) qs.set("categoryId", params.categoryId);
    if (params.page) qs.set("page", String(params.page));
    return api<{ products: Product[]; pagination: { total: number; pages: number } }>(`/catalog/search?${qs}`);
  },
  product: (id: string) => api<Product>(`/catalog/products/${id}`),
  categories: () => api<{ categories: Category[] }>("/catalog/categories"),
};

export const cartApi = {
  get: () => api<CartResponse>("/cart"),
  addItem: (data: { productId: string; quantity?: number; schoolId?: string; studentId?: string }) =>
    api<CartResponse>("/cart/items", { method: "POST", body: data }),
  updateItem: (itemId: string, quantity: number) =>
    api<CartResponse>(`/cart/items/${itemId}`, { method: "PATCH", body: { quantity } }),
};

export const schoolAdminApi = {
  students: (schoolId: string) => api<{ students: unknown[] }>(`/schools/${schoolId}/students`),
  pendingLinks: (schoolId: string) => api<{ links: unknown[] }>(`/schools/${schoolId}/parent-links/pending`),
  approveLink: (schoolId: string, linkId: string) =>
    api(`/schools/${schoolId}/parent-links/${linkId}/approve`, { method: "POST" }),
  rejectLink: (schoolId: string, linkId: string, reason?: string) =>
    api(`/schools/${schoolId}/parent-links/${linkId}/reject`, { method: "POST", body: { reason } }),
  catalogVendors: (schoolId: string) => api<{ vendors: unknown[] }>(`/schools/${schoolId}/catalog/vendors`),
  catalogProducts: (schoolId: string) => api<{ products: unknown[] }>(`/schools/${schoolId}/catalog/products`),
  approveVendor: (schoolId: string, vendorId: string, approved: boolean) =>
    api(`/schools/${schoolId}/catalog/vendors/${vendorId}`, { method: "POST", body: { approved } }),
  approveProduct: (schoolId: string, productId: string, approved: boolean) =>
    api(`/schools/${schoolId}/catalog/products/${productId}`, { method: "POST", body: { approved } }),
  activities: (schoolId: string) => api<{ activities: unknown[] }>(`/schools/${schoolId}/activities`),
  createActivity: (schoolId: string, data: Record<string, unknown>) =>
    api(`/schools/${schoolId}/activities`, { method: "POST", body: data }),
  updateActivity: (schoolId: string, activityId: string, data: Record<string, unknown>) =>
    api(`/schools/${schoolId}/activities/${activityId}`, { method: "PATCH", body: data }),
};

export interface StudentProfile {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  grade: string;
  className?: string | null;
  boardingStatus: string;
  status: string;
  school: { id: string; name: string; town: string };
}

export interface StudentWallet {
  studentId: string;
  balanceMinor: number;
  currency: string;
  rules: Array<{
    id: string;
    category: string;
    period: string;
    limitMinor: number;
    requiresApproval: boolean;
  }>;
  transactions: Array<{
    id: string;
    type: string;
    amountMinor: number;
    balanceAfterMinor: number;
    description: string | null;
    createdAt: string;
  }>;
}

export interface StudentCollection {
  id: string;
  orderNumber: string;
  status: string;
  totalMinor: number;
  currency: string;
  deliveryDate: string | null;
  vendor: { id: string; name: string } | null;
  items: Array<{ id: string; productName: string; quantity: number; totalMinor: number }>;
  canCollect: boolean;
  updatedAt: string;
}

export const studentsApi = {
  activate: (data: {
    schoolId: string;
    studentNumber: string;
    collectionPin: string;
    email?: string;
    phone?: string;
    password: string;
  }) =>
    api<{ success: boolean; userId: string; studentId: string; message: string }>("/students/activate", {
      method: "POST",
      body: data,
    }),
  me: () => api<StudentProfile>("/students/me"),
  wallet: () => api<StudentWallet>("/students/me/wallet"),
  collections: () => api<{ collections: StudentCollection[] }>("/students/me/collections"),
  confirmCollection: (data: { orderId: string; collectionPin: string }) =>
    api<{ id: string; orderNumber: string; status: string }>("/students/me/collections/confirm", {
      method: "POST",
      body: data,
    }),
  activities: () =>
    api<{
      activities: Array<{
        id: string;
        title: string;
        description: string | null;
        category: string;
        location: string | null;
        startsAt: string;
        endsAt: string | null;
        feeMinor: number;
        registration: { id: string; status: string; paidMinor: number; confirmedAt: string | null } | null;
      }>;
    }>("/students/me/activities"),
};

export interface ParentActivitiesResponse {
  children: Array<{
    id: string;
    firstName: string;
    lastName: string;
    schoolId: string;
    school: { id: string; name: string };
  }>;
  activities: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    location: string | null;
    startsAt: string;
    endsAt: string | null;
    feeMinor: number;
    capacity: number | null;
    registrationCount: number;
    school: { id: string; name: string };
    myRegistrations: Array<{
      id: string;
      studentId: string;
      status: string;
      paidMinor: number;
      confirmedAt: string | null;
    }>;
  }>;
}

export const activitiesApi = {
  listForParent: () => api<ParentActivitiesResponse>("/parents/activities"),
  register: (data: { activityId: string; studentId: string; notes?: string }) =>
    api<{ id: string; status: string }>("/parents/activities/register", { method: "POST", body: data }),
  confirm: (data: { registrationId: string }) =>
    api<{ id: string; status: string }>("/parents/activities/confirm", { method: "POST", body: data }),
};
