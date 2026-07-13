-- Reduce UserRole to MASTER_ADMIN, RECEPTION, TENANT only.
-- Users still holding a role being removed cannot be reassigned automatically
-- (no safe default), so they are deleted. FK constraints on Record/AuditLog
-- are ON DELETE SET NULL and Permission is ON DELETE CASCADE, so this is safe.
DELETE FROM "User" WHERE "role" IN ('MANAGER', 'SALES', 'FINANCE', 'OPERATIONS');

-- Drop the old default before changing the column's type.
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

-- Swap in a new enum type with only the surviving values.
CREATE TYPE "UserRole_new" AS ENUM ('MASTER_ADMIN', 'RECEPTION', 'TENANT');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- New default for newly created staff users.
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'TENANT';
