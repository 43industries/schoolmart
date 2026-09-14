-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActivityRegistrationStatus" AS ENUM ('PENDING_PARENT', 'CONFIRMED', 'CANCELLED', 'REJECTED');

-- CreateTable
CREATE TABLE "school_activities" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'FUNKIES',
    "location" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "fee_minor" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER,
    "status" "ActivityStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_registrations" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "parent_user_id" TEXT NOT NULL,
    "status" "ActivityRegistrationStatus" NOT NULL DEFAULT 'PENDING_PARENT',
    "paid_minor" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_activities_school_id_idx" ON "school_activities"("school_id");
CREATE INDEX "school_activities_status_idx" ON "school_activities"("status");
CREATE INDEX "school_activities_starts_at_idx" ON "school_activities"("starts_at");
CREATE UNIQUE INDEX "activity_registrations_activity_id_student_id_key" ON "activity_registrations"("activity_id", "student_id");
CREATE INDEX "activity_registrations_parent_user_id_idx" ON "activity_registrations"("parent_user_id");
CREATE INDEX "activity_registrations_student_id_idx" ON "activity_registrations"("student_id");
CREATE INDEX "activity_registrations_status_idx" ON "activity_registrations"("status");

-- AddForeignKey
ALTER TABLE "school_activities" ADD CONSTRAINT "school_activities_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_registrations" ADD CONSTRAINT "activity_registrations_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "school_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_registrations" ADD CONSTRAINT "activity_registrations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
