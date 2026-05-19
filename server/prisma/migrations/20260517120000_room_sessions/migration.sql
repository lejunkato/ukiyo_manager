CREATE TABLE "RoomSession" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Tab" ADD COLUMN "roomSessionId" TEXT;
ALTER TABLE "Order" ADD COLUMN "roomSessionId" TEXT;

INSERT INTO "RoomSession" ("id", "roomId", "active", "startedAt", "createdAt", "updatedAt")
SELECT
  'session_' || "Room"."id",
  "Room"."id",
  true,
  COALESCE(MIN("Tab"."createdAt"), CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Room"
LEFT JOIN "Tab" ON "Tab"."roomId" = "Room"."id"
GROUP BY "Room"."id";

UPDATE "Tab"
SET "roomSessionId" = 'session_' || "roomId"
WHERE "roomSessionId" IS NULL;

UPDATE "Order"
SET "roomSessionId" = 'session_' || "roomId"
WHERE "roomSessionId" IS NULL;

CREATE INDEX "RoomSession_roomId_active_idx" ON "RoomSession"("roomId", "active");
CREATE INDEX "Tab_roomSessionId_idx" ON "Tab"("roomSessionId");
CREATE INDEX "Order_roomSessionId_idx" ON "Order"("roomSessionId");

ALTER TABLE "RoomSession" ADD CONSTRAINT "RoomSession_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Tab" ADD CONSTRAINT "Tab_roomSessionId_fkey"
  FOREIGN KEY ("roomSessionId") REFERENCES "RoomSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD CONSTRAINT "Order_roomSessionId_fkey"
  FOREIGN KEY ("roomSessionId") REFERENCES "RoomSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
