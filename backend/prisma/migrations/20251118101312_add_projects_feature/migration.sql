/*
  Migration to add Projects feature with data migration for existing data
  
  Steps:
  1. Create projects and project_access tables
  2. Create default projects for existing users
  3. Update existing tables to include project_id with proper data migration
*/

-- Step 1: Create new tables
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "project_access" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_type" TEXT NOT NULL,
    "granted_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_access_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Step 2: Create default projects for existing users
INSERT INTO "projects" ("id", "name", "description", "user_id", "created_at", "updated_at")
SELECT 
    lower(hex(randomblob(12))) as id,
    'Default Project' as name,
    'Auto-created project for existing data' as description,
    "id" as user_id,
    CURRENT_TIMESTAMP as created_at,
    CURRENT_TIMESTAMP as updated_at
FROM "users" 
WHERE "account_type" = 'PARENT';

-- Step 3: Migrate existing tables with project_id
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Migrate vendors table
CREATE TABLE "new_vendors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    CONSTRAINT "vendors_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_vendors" ("id", "name", "slug", "project_id")
SELECT 
    v."id",
    v."name",
    v."slug",
    (SELECT p."id" FROM "projects" p 
     JOIN "user_vendor_channels" uvc ON uvc."vendor_id" = v."id"
     JOIN "users" u ON u."id" = uvc."user_id" AND u."account_type" = 'PARENT'
     WHERE p."user_id" = u."id" AND p."name" = 'Default Project'
     LIMIT 1) as project_id
FROM "vendors" v;

DROP TABLE "vendors";
ALTER TABLE "new_vendors" RENAME TO "vendors";

-- Migrate channels table
CREATE TABLE "new_channels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    CONSTRAINT "channels_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_channels" ("id", "type", "name", "project_id")
SELECT 
    c."id",
    c."type", 
    c."name",
    (SELECT p."id" FROM "projects" p 
     JOIN "user_vendor_channels" uvc ON uvc."channel_id" = c."id"
     JOIN "users" u ON u."id" = uvc."user_id" AND u."account_type" = 'PARENT'
     WHERE p."user_id" = u."id" AND p."name" = 'Default Project'
     LIMIT 1) as project_id
FROM "channels" c;

DROP TABLE "channels";
ALTER TABLE "new_channels" RENAME TO "channels";

-- Migrate user_vendor_channels table
CREATE TABLE "new_user_vendor_channels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "webhook_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_vendor_channels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_vendor_channels_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_vendor_channels_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_vendor_channels_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_user_vendor_channels" ("id", "user_id", "vendor_id", "channel_id", "project_id", "webhook_url", "is_active", "created_at")
SELECT 
    uvc."id",
    uvc."user_id",
    uvc."vendor_id",
    uvc."channel_id",
    (SELECT p."id" FROM "projects" p 
     JOIN "users" u ON u."id" = uvc."user_id" 
     WHERE p."user_id" = CASE 
         WHEN u."account_type" = 'PARENT' THEN u."id"
         ELSE u."parent_id"
     END AND p."name" = 'Default Project'
     LIMIT 1) as project_id,
    uvc."webhook_url",
    uvc."is_active",
    uvc."created_at"
FROM "user_vendor_channels" uvc;

DROP TABLE "user_vendor_channels";
ALTER TABLE "new_user_vendor_channels" RENAME TO "user_vendor_channels";

-- Migrate messages table
CREATE TABLE "new_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "message_id" TEXT,
    "content_summary" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "messages_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_messages" ("id", "user_id", "vendor_id", "channel_id", "project_id", "recipient", "message_id", "content_summary", "created_at")
SELECT 
    m."id",
    m."user_id",
    m."vendor_id", 
    m."channel_id",
    (SELECT p."id" FROM "projects" p 
     JOIN "users" u ON u."id" = m."user_id"
     WHERE p."user_id" = CASE 
         WHEN u."account_type" = 'PARENT' THEN u."id"
         ELSE u."parent_id"
     END AND p."name" = 'Default Project'
     LIMIT 1) as project_id,
    m."recipient",
    m."message_id",
    m."content_summary", 
    m."created_at"
FROM "messages" m;

DROP TABLE "messages";
ALTER TABLE "new_messages" RENAME TO "messages";

-- Migrate analytics_cache table
CREATE TABLE "new_analytics_cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "vendor_id" TEXT,
    "channel_id" TEXT,
    "project_id" TEXT,
    "date" DATETIME NOT NULL,
    "total_sent" INTEGER NOT NULL DEFAULT 0,
    "total_delivered" INTEGER NOT NULL DEFAULT 0,
    "total_read" INTEGER NOT NULL DEFAULT 0,
    "total_failed" INTEGER NOT NULL DEFAULT 0,
    "success_rate" REAL NOT NULL DEFAULT 0,
    "last_updated" DATETIME NOT NULL,
    CONSTRAINT "analytics_cache_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "analytics_cache_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "analytics_cache_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "analytics_cache_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_analytics_cache" ("id", "user_id", "vendor_id", "channel_id", "project_id", "date", "total_sent", "total_delivered", "total_read", "total_failed", "success_rate", "last_updated")
SELECT 
    ac."id",
    ac."user_id", 
    ac."vendor_id",
    ac."channel_id",
    (SELECT p."id" FROM "projects" p 
     JOIN "users" u ON u."id" = ac."user_id"
     WHERE p."user_id" = CASE 
         WHEN u."account_type" = 'PARENT' THEN u."id"
         ELSE u."parent_id"
     END AND p."name" = 'Default Project'
     LIMIT 1) as project_id,
    ac."date",
    ac."total_sent",
    ac."total_delivered", 
    ac."total_read",
    ac."total_failed",
    ac."success_rate",
    ac."last_updated"
FROM "analytics_cache" ac;

DROP TABLE "analytics_cache";
ALTER TABLE "new_analytics_cache" RENAME TO "analytics_cache";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Step 4: Create indexes
CREATE UNIQUE INDEX "projects_name_user_id_key" ON "projects"("name", "user_id");
CREATE UNIQUE INDEX "project_access_project_id_user_id_key" ON "project_access"("project_id", "user_id");
CREATE UNIQUE INDEX "vendors_name_project_id_key" ON "vendors"("name", "project_id");
CREATE UNIQUE INDEX "channels_type_project_id_key" ON "channels"("type", "project_id");
CREATE UNIQUE INDEX "user_vendor_channels_webhook_url_key" ON "user_vendor_channels"("webhook_url");
CREATE UNIQUE INDEX "user_vendor_channels_user_id_vendor_id_channel_id_project_id_key" ON "user_vendor_channels"("user_id", "vendor_id", "channel_id", "project_id");
CREATE UNIQUE INDEX "analytics_cache_user_id_vendor_id_channel_id_project_id_date_key" ON "analytics_cache"("user_id", "vendor_id", "channel_id", "project_id", "date");
