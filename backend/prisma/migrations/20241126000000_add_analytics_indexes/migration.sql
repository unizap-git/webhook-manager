-- CreateIndex for Message table (analytics queries)
CREATE INDEX IF NOT EXISTS "messages_userId_createdAt_idx" ON "messages"("user_id", "created_at");

-- CreateIndex for Message table (project + date filtering)
CREATE INDEX IF NOT EXISTS "messages_userId_projectId_createdAt_idx" ON "messages"("user_id", "project_id", "created_at");

-- CreateIndex for Message table (vendor filtering)
CREATE INDEX IF NOT EXISTS "messages_vendorId_idx" ON "messages"("vendor_id");

-- CreateIndex for Message table (channel filtering)
CREATE INDEX IF NOT EXISTS "messages_channelId_idx" ON "messages"("channel_id");

-- CreateIndex for MessageEvent table (getting latest event per message)
CREATE INDEX IF NOT EXISTS "message_events_messageId_timestamp_idx" ON "message_events"("message_id", "timestamp");

-- CreateIndex for MessageEvent table (status filtering)
CREATE INDEX IF NOT EXISTS "message_events_status_idx" ON "message_events"("status");
