UPDATE "RoomSession"
SET
  "active" = false,
  "closedAt" = CURRENT_TIMESTAMP,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  "active" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "Tab"
    WHERE "Tab"."roomSessionId" = "RoomSession"."id"
  );
