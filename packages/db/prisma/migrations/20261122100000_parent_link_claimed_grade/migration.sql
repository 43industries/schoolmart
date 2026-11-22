-- Parent link form writes claimed_grade; column was in schema but never migrated.
ALTER TABLE "parent_student_links" ADD COLUMN IF NOT EXISTS "claimed_grade" TEXT;

-- Repair demo parent↔student links so Parent → Funkies can resolve school activities.
-- Idempotent: insert when missing, force ACTIVE when present.
INSERT INTO "parent_student_links" (
  "id",
  "parent_user_id",
  "student_id",
  "relationship",
  "status",
  "consented_at",
  "approved_at",
  "created_at",
  "updated_at"
)
SELECT
  md5(random()::text || clock_timestamp()::text || v.parent_email || v.student_number)::uuid::text,
  u.id,
  s.id,
  v.relationship::"Relationship",
  'ACTIVE'::"LinkStatus",
  NOW(),
  NOW(),
  NOW(),
  NOW()
FROM (
  VALUES
    ('parent1@demo.ke', 'greenfield-academy', 'GF-2024-001', 'MOTHER'),
    ('parent1@demo.ke', 'greenfield-academy', 'GF-2024-002', 'MOTHER'),
    ('parent2@demo.ke', 'greenfield-academy', 'GF-2024-003', 'FATHER'),
    ('parent2@demo.ke', 'sunrise-primary', 'SR-2024-001', 'FATHER'),
    ('parent4@demo.ke', 'coastal-boarding', 'CB-2024-001', 'FATHER'),
    ('parent4@demo.ke', 'coastal-boarding', 'CB-2024-002', 'FATHER')
) AS v(parent_email, school_slug, student_number, relationship)
JOIN "users" u ON u.email = v.parent_email
JOIN "parent_profiles" pp ON pp.user_id = u.id
JOIN "schools" sch ON sch.slug = v.school_slug
JOIN "students" s ON s.school_id = sch.id AND s.student_number = v.student_number
ON CONFLICT ("parent_user_id", "student_id") DO UPDATE SET
  "status" = 'ACTIVE'::"LinkStatus",
  "approved_at" = COALESCE("parent_student_links"."approved_at", NOW()),
  "updated_at" = NOW();
