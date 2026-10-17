-- Part C (dashboard rebuild): per-user dashboard section layout ("Customize
-- this screen"). One row per (user, business); `sections` is JSON
-- ([{ "key": "collected", "visible": true }, ...] in display order).
-- Missing row = role defaults (owner/admin: everything; dispatcher: no
-- money sections; technician: "My day" view).

CREATE TABLE IF NOT EXISTS "DashboardLayout" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "sections" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DashboardLayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DashboardLayout_userId_businessId_key"
  ON "DashboardLayout"("userId", "businessId");
CREATE INDEX IF NOT EXISTS "DashboardLayout_businessId_idx"
  ON "DashboardLayout"("businessId");
