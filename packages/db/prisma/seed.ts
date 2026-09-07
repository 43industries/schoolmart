import { PrismaClient, Role, ScopeType, UserStatus, SchoolStatus, LinkStatus, Relationship, VendorStatus, ProductStatus } from "@prisma/client";
import argon2 from "argon2";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo@SchoolMart2026";

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

async function hashPin(pin: string): Promise<string> {
  return argon2.hash(pin, { type: argon2.argon2id });
}

async function main() {
  console.log("🌱 Seeding SchoolMart demo data...\n");

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const pinHash = await hashPin("1234");

  // Platform settings
  await prisma.platformSettings.upsert({
    where: { key: "platform_commission_bps" },
    update: {},
    create: { key: "platform_commission_bps", value: 800 },
  });
  await prisma.platformSettings.upsert({
    where: { key: "feature_flags" },
    update: {},
    create: { key: "feature_flags", value: { wallet: false, marketplace: false } },
  });

  // Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@schoolmart.demo" },
    update: {},
    create: {
      email: "admin@schoolmart.demo",
      passwordHash,
      firstName: "[DEMO] Super",
      lastName: "Admin",
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      roles: {
        create: { role: Role.SUPER_ADMIN, scopeType: ScopeType.PLATFORM },
      },
    },
  });
  console.log(`✓ Super Admin: admin@schoolmart.demo`);

  // Finance staff
  await prisma.user.upsert({
    where: { email: "finance@schoolmart.demo" },
    update: {},
    create: {
      email: "finance@schoolmart.demo",
      passwordHash,
      firstName: "[DEMO] Finance",
      lastName: "Staff",
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      roles: {
        create: { role: Role.FINANCE, scopeType: ScopeType.PLATFORM },
      },
    },
  });
  console.log(`✓ Finance: finance@schoolmart.demo`);

  // Support staff
  await prisma.user.upsert({
    where: { email: "support@schoolmart.demo" },
    update: {},
    create: {
      email: "support@schoolmart.demo",
      passwordHash,
      firstName: "[DEMO] Support",
      lastName: "Staff",
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      roles: {
        create: { role: Role.SUPPORT, scopeType: ScopeType.PLATFORM },
      },
    },
  });
  console.log(`✓ Support: support@schoolmart.demo`);

  // Schools
  const schools = [
    {
      name: "[DEMO] Greenfield Academy",
      slug: "greenfield-academy",
      type: "PRIVATE_SECONDARY" as const,
      county: "Nairobi",
      town: "Karen",
      boardingSupported: true,
    },
    {
      name: "[DEMO] Sunrise Primary School",
      slug: "sunrise-primary",
      type: "PRIVATE_PRIMARY" as const,
      county: "Kiambu",
      town: "Thika",
      boardingSupported: false,
    },
    {
      name: "[DEMO] Coastal Boarding School",
      slug: "coastal-boarding",
      type: "BOARDING" as const,
      county: "Mombasa",
      town: "Nyali",
      boardingSupported: true,
    },
  ];

  const createdSchools = [];
  for (const s of schools) {
    const school = await prisma.school.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        ...s,
        status: SchoolStatus.ACTIVE,
        addressLine: `${s.town}, ${s.county}`,
        settings: { create: {} },
      },
    });
    createdSchools.push(school);
    console.log(`✓ School: ${school.name}`);
  }

  const [greenfield, sunrise, coastal] = createdSchools;

  // School admins
  const schoolAdmin1 = await prisma.user.upsert({
    where: { email: "admin@greenfield.demo" },
    update: {},
    create: {
      email: "admin@greenfield.demo",
      passwordHash,
      firstName: "[DEMO] Jane",
      lastName: "Mwangi",
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      roles: {
        create: { role: Role.SCHOOL_ADMIN, scopeType: ScopeType.SCHOOL, scopeId: greenfield!.id },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@sunrise.demo" },
    update: {},
    create: {
      email: "admin@sunrise.demo",
      passwordHash,
      firstName: "[DEMO] Peter",
      lastName: "Ochieng",
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      roles: {
        create: { role: Role.SCHOOL_ADMIN, scopeType: ScopeType.SCHOOL, scopeId: sunrise!.id },
      },
    },
  });
  console.log(`✓ School Admins: admin@greenfield.demo, admin@sunrise.demo`);

  // Parents
  const parentData = [
    { email: "parent1@demo.ke", phone: "+254712345001", firstName: "[DEMO] Mary", lastName: "Kamau" },
    { email: "parent2@demo.ke", phone: "+254712345002", firstName: "[DEMO] John", lastName: "Otieno" },
    { email: "parent3@demo.ke", phone: "+254712345003", firstName: "[DEMO] Grace", lastName: "Wanjiku" },
    { email: "parent4@demo.ke", phone: "+254712345004", firstName: "[DEMO] David", lastName: "Mutua" },
  ];

  const parents = [];
  for (const p of parentData) {
    const parent = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        email: p.email,
        phoneE164: p.phone,
        passwordHash,
        firstName: p.firstName,
        lastName: p.lastName,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        roles: { create: { role: Role.PARENT, scopeType: ScopeType.PLATFORM } },
        parentProfile: { create: {} },
      },
    });
    parents.push(parent);
  }
  console.log(`✓ Parents: parent1@demo.ke – parent4@demo.ke`);

  // Students
  const studentData = [
    { schoolId: greenfield!.id, number: "GF-2024-001", firstName: "Brian", lastName: "Kamau", grade: "Form 2", boarding: "BOARDING" as const },
    { schoolId: greenfield!.id, number: "GF-2024-002", firstName: "Faith", lastName: "Kamau", grade: "Form 1", boarding: "BOARDING" as const },
    { schoolId: greenfield!.id, number: "GF-2024-003", firstName: "Kevin", lastName: "Otieno", grade: "Form 3", boarding: "DAY" as const },
    { schoolId: sunrise!.id, number: "SR-2024-001", firstName: "Lucy", lastName: "Otieno", grade: "Grade 5", boarding: "DAY" as const },
    { schoolId: sunrise!.id, number: "SR-2024-002", firstName: "James", lastName: "Wanjiku", grade: "Grade 6", boarding: "DAY" as const },
    { schoolId: coastal!.id, number: "CB-2024-001", firstName: "Amina", lastName: "Mutua", grade: "Form 4", boarding: "BOARDING" as const },
    { schoolId: coastal!.id, number: "CB-2024-002", firstName: "Hassan", lastName: "Mutua", grade: "Form 2", boarding: "BOARDING" as const },
    { schoolId: coastal!.id, number: "CB-2024-003", firstName: "Zara", lastName: "Wanjiku", grade: "Form 1", boarding: "BOARDING" as const },
  ];

  const students = [];
  for (const s of studentData) {
    const student = await prisma.student.upsert({
      where: { schoolId_studentNumber: { schoolId: s.schoolId, studentNumber: s.number } },
      update: {},
      create: {
        schoolId: s.schoolId,
        studentNumber: s.number,
        firstName: s.firstName,
        lastName: s.lastName,
        grade: s.grade,
        boardingStatus: s.boarding,
        collectionPinHash: pinHash,
        qrSecret: randomBytes(16).toString("hex"),
      },
    });
    students.push(student);
  }
  console.log(`✓ Students: 8 students across 3 schools`);

  // Parent-student links
  const links = [
    { parentIdx: 0, studentIdx: 0, relationship: Relationship.MOTHER, status: LinkStatus.ACTIVE },
    { parentIdx: 0, studentIdx: 1, relationship: Relationship.MOTHER, status: LinkStatus.ACTIVE },
    { parentIdx: 1, studentIdx: 2, relationship: Relationship.FATHER, status: LinkStatus.ACTIVE },
    { parentIdx: 1, studentIdx: 3, relationship: Relationship.FATHER, status: LinkStatus.ACTIVE },
    { parentIdx: 2, studentIdx: 4, relationship: Relationship.MOTHER, status: LinkStatus.PENDING_SCHOOL_APPROVAL },
    { parentIdx: 3, studentIdx: 5, relationship: Relationship.FATHER, status: LinkStatus.ACTIVE },
    { parentIdx: 3, studentIdx: 6, relationship: Relationship.FATHER, status: LinkStatus.ACTIVE },
    { parentIdx: 2, studentIdx: 7, relationship: Relationship.GUARDIAN, status: LinkStatus.PENDING_SCHOOL_APPROVAL },
  ];

  for (const link of links) {
    const parent = parents[link.parentIdx]!;
    const student = students[link.studentIdx]!;
    await prisma.parentStudentLink.upsert({
      where: { parentUserId_studentId: { parentUserId: parent.id, studentId: student.id } },
      update: {},
      create: {
        parentUserId: parent.id,
        studentId: student.id,
        relationship: link.relationship,
        status: link.status,
        consentedAt: new Date(),
        approvedByUserId: link.status === LinkStatus.ACTIVE ? schoolAdmin1.id : undefined,
        approvedAt: link.status === LinkStatus.ACTIVE ? new Date() : undefined,
      },
    });
  }
  console.log(`✓ Parent-student links: 6 active, 2 pending approval`);

  // Marketplace seed
  const meals = await prisma.category.upsert({
    where: { slug: "meals" },
    update: {},
    create: { name: "Meals", slug: "meals", description: "[DEMO] Hot meals and lunch", sortOrder: 1 },
  });
  const supplies = await prisma.category.upsert({
    where: { slug: "school-supplies" },
    update: {},
    create: { name: "School Supplies", slug: "school-supplies", description: "[DEMO] Stationery and essentials", sortOrder: 2 },
  });
  const care = await prisma.category.upsert({
    where: { slug: "care-packages" },
    update: {},
    create: { name: "Care Packages", slug: "care-packages", description: "[DEMO] Curated packages", sortOrder: 3 },
  });
  console.log(`✓ Categories: meals, school-supplies, care-packages`);

  const kitchen = await prisma.vendor.upsert({
    where: { slug: "demo-campus-kitchen" },
    update: {},
    create: {
      name: "[DEMO] Campus Kitchen",
      slug: "demo-campus-kitchen",
      description: "School-approved meal vendor",
      contactEmail: "kitchen@demo.ke",
      status: VendorStatus.APPROVED,
    },
  });
  const stationery = await prisma.vendor.upsert({
    where: { slug: "demo-stationery-hub" },
    update: {},
    create: {
      name: "[DEMO] Stationery Hub",
      slug: "demo-stationery-hub",
      description: "Exercise books, pens, and supplies",
      contactEmail: "stationery@demo.ke",
      status: VendorStatus.APPROVED,
    },
  });
  console.log(`✓ Vendors: Campus Kitchen, Stationery Hub`);

  async function upsertProduct(data: {
    vendorId: string;
    categoryId: string;
    name: string;
    slug: string;
    description: string;
    priceMinor: number;
    qty: number;
  }) {
    const product = await prisma.product.upsert({
      where: { vendorId_slug: { vendorId: data.vendorId, slug: data.slug } },
      update: {},
      create: {
        vendorId: data.vendorId,
        categoryId: data.categoryId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        priceMinor: data.priceMinor,
        status: ProductStatus.ACTIVE,
        inventory: { create: { availableQty: data.qty, lowStockThreshold: 10 } },
      },
    });
    return product;
  }

  const lunch = await upsertProduct({
    vendorId: kitchen.id,
    categoryId: meals.id,
    name: "[DEMO] Chicken Rice Lunch",
    slug: "chicken-rice-lunch",
    description: "Hot lunch with chicken, rice, and vegetables",
    priceMinor: 35000,
    qty: 100,
  });
  const breakfast = await upsertProduct({
    vendorId: kitchen.id,
    categoryId: meals.id,
    name: "[DEMO] Breakfast Bundle",
    slug: "breakfast-bundle",
    description: "Tea, bread, and fruit",
    priceMinor: 20000,
    qty: 80,
  });
  const books = await upsertProduct({
    vendorId: stationery.id,
    categoryId: supplies.id,
    name: "[DEMO] Exercise Book Pack (5)",
    slug: "exercise-book-pack",
    description: "Pack of 5 A4 exercise books",
    priceMinor: 45000,
    qty: 200,
  });
  const examPack = await upsertProduct({
    vendorId: stationery.id,
    categoryId: care.id,
    name: "[DEMO] Exam Survival Package",
    slug: "exam-survival-package",
    description: "Snacks, stationery, and toiletries for exam week",
    priceMinor: 150000,
    qty: 50,
  });
  console.log(`✓ Products: 4 demo products`);

  // Approve vendors + products at Greenfield and Sunrise
  for (const school of [greenfield!, sunrise!]) {
    for (const vendor of [kitchen, stationery]) {
      await prisma.schoolVendor.upsert({
        where: { schoolId_vendorId: { schoolId: school.id, vendorId: vendor.id } },
        update: { approved: true },
        create: { schoolId: school.id, vendorId: vendor.id, approved: true },
      });
    }
    for (const product of [lunch, breakfast, books, examPack]) {
      await prisma.schoolProduct.upsert({
        where: { schoolId_productId: { schoolId: school.id, productId: product.id } },
        update: { approved: true },
        create: { schoolId: school.id, productId: product.id, approved: true },
      });
    }
  }
  console.log(`✓ School catalog: Greenfield & Sunrise approved`);

  console.log(`\n✅ Seed complete!`);
  console.log(`\nDemo password for all accounts: ${DEMO_PASSWORD}`);
  console.log(`Demo student collection PIN: 1234`);
  console.log(`\nAccounts:`);
  console.log(`  Super Admin:  admin@schoolmart.demo`);
  console.log(`  School Admin: admin@greenfield.demo`);
  console.log(`  Parent:       parent1@demo.ke`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
