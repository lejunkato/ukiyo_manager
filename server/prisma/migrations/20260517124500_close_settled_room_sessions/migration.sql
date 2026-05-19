UPDATE "RoomSession"
SET
  "active" = false,
  "closedAt" = CURRENT_TIMESTAMP,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  "active" = true
  AND EXISTS (
    SELECT 1
    FROM "Tab"
    WHERE "Tab"."roomSessionId" = "RoomSession"."id"
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "Tab"
    WHERE
      "Tab"."roomSessionId" = "RoomSession"."id"
      AND "Tab"."paid" = false
  );

UPDATE "Tab"
SET
  "active" = false,
  "closedAt" = COALESCE("closedAt", CURRENT_TIMESTAMP),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  "paid" = true
  AND "roomSessionId" IN (
    SELECT "id"
    FROM "RoomSession"
    WHERE "active" = false
  );
