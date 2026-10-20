-- Reception now has full access to Meeting Room Bookings (see lib/permissions.ts).
-- New and edited users get it from applyRolePermissions(); this backfills
-- Reception users that already exist.
INSERT INTO "Permission" ("id", "userId", "module", "action", "createdAt")
SELECT gen_random_uuid()::text, u."id", 'meeting-room-bookings', a."action", CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN unnest(enum_range(NULL::"PermissionAction")) AS a("action")
WHERE u."role" = 'RECEPTION'
ON CONFLICT ("userId", "module", "action") DO NOTHING;
