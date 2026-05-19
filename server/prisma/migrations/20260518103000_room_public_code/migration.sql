ALTER TABLE "Room" ADD COLUMN "publicCode" TEXT;

UPDATE "Room"
SET "publicCode" = 'rm_' || substr(md5("id" || ':' || "name" || ':' || random()::text), 1, 24)
WHERE "publicCode" IS NULL;

ALTER TABLE "Room" ALTER COLUMN "publicCode" SET NOT NULL;
ALTER TABLE "Room" ALTER COLUMN "publicCode" SET DEFAULT ('rm_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24));

CREATE UNIQUE INDEX "Room_publicCode_key" ON "Room"("publicCode");
