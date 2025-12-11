/**
 * Export Turso data to MySQL-compatible SQL file with CREATE TABLE statements
 */

import { createClient } from '@libsql/client';
import * as fs from 'fs';

const TURSO_URL = 'libsql://webhook-unizap.aws-ap-south-1.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjM2MTg4MzAsImlkIjoiNTBiMzQzYTgtYzJhMi00N2QwLWJiNTktMmI3MTUwMzY5YTA5IiwicmlkIjoiMzM2NWE0ZGUtN2I0Zi00OWIzLTk3MjUtOTFjZGVjOWUwNzVlIn0.qKUbF7r6Ayds7jPToGMiIorQwtX2zpW7SUcmSZcnSxMk-eOaN3WCbTpVdkdKa2odwPJz3ugrE7LWi1pDZ93AAg';

const turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

function escapeString(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';

  const str = String(value);
  return `'${str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
}

function toBool(value: any): string {
  return (value === 1 || value === '1' || value === true) ? '1' : '0';
}

function toDateTime(value: any): string {
  if (!value) return 'NOW()';
  try {
    const d = new Date(value);
    return `'${d.toISOString().slice(0, 19).replace('T', ' ')}'`;
  } catch {
    return 'NOW()';
  }
}

const CREATE_TABLES = `
SET FOREIGN_KEY_CHECKS = 0;

-- Drop existing tables (reverse order for FK)
DROP TABLE IF EXISTS outbound_messages;
DROP TABLE IF EXISTS analytics_cache;
DROP TABLE IF EXISTS message_events;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS user_vendor_channels;
DROP TABLE IF EXISTS project_access;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS channels;
DROP TABLE IF EXISTS vendors;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- Create tables

CREATE TABLE users (
  id VARCHAR(30) NOT NULL,
  name VARCHAR(255) NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  account_type VARCHAR(20) NOT NULL DEFAULT 'PARENT',
  parent_id VARCHAR(30) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_key (email),
  KEY users_parent_id_fkey (parent_id),
  CONSTRAINT users_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vendors (
  id VARCHAR(30) NOT NULL,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY vendors_name_key (name),
  UNIQUE KEY vendors_slug_key (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE channels (
  id VARCHAR(30) NOT NULL,
  name VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY channels_name_key (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE projects (
  id VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  user_id VARCHAR(30) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY projects_name_user_id_key (name, user_id),
  KEY projects_user_id_fkey (user_id),
  CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE project_access (
  id VARCHAR(30) NOT NULL,
  project_id VARCHAR(30) NOT NULL,
  user_id VARCHAR(30) NOT NULL,
  access_type VARCHAR(20) NOT NULL,
  granted_by VARCHAR(30) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY project_access_project_id_user_id_key (project_id, user_id),
  KEY project_access_user_id_fkey (user_id),
  KEY project_access_granted_by_fkey (granted_by),
  CONSTRAINT project_access_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT project_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT project_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES users (id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_vendor_channels (
  id VARCHAR(30) NOT NULL,
  user_id VARCHAR(30) NOT NULL,
  vendor_id VARCHAR(30) NOT NULL,
  channel_id VARCHAR(30) NOT NULL,
  project_id VARCHAR(30) NOT NULL,
  webhook_url VARCHAR(255) NOT NULL,
  webhook_secret VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uvc_webhook_url_key (webhook_url),
  UNIQUE KEY uvc_user_vend_chan_proj_key (user_id, vendor_id, channel_id, project_id),
  KEY uvc_vendor_id_fkey (vendor_id),
  KEY uvc_channel_id_fkey (channel_id),
  KEY uvc_project_id_fkey (project_id),
  CONSTRAINT uvc_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uvc_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON UPDATE CASCADE,
  CONSTRAINT uvc_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES channels (id) ON UPDATE CASCADE,
  CONSTRAINT uvc_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE messages (
  id VARCHAR(30) NOT NULL,
  user_id VARCHAR(30) NOT NULL,
  vendor_id VARCHAR(30) NOT NULL,
  channel_id VARCHAR(30) NOT NULL,
  project_id VARCHAR(30) NOT NULL,
  recipient VARCHAR(100) NOT NULL,
  message_id VARCHAR(100) NULL,
  content_summary TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY messages_user_id_created_at_idx (user_id, created_at),
  KEY messages_user_id_project_id_created_at_idx (user_id, project_id, created_at),
  KEY messages_vendor_id_idx (vendor_id),
  KEY messages_channel_id_idx (channel_id),
  KEY messages_user_id_vendor_id_channel_id_message_id_idx (user_id, vendor_id, channel_id, message_id),
  KEY messages_project_id_fkey (project_id),
  CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT messages_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON UPDATE CASCADE,
  CONSTRAINT messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES channels (id) ON UPDATE CASCADE,
  CONSTRAINT messages_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE message_events (
  id VARCHAR(30) NOT NULL,
  message_id VARCHAR(30) NOT NULL,
  vendor_ref_id VARCHAR(100) NULL,
  status VARCHAR(20) NOT NULL,
  reason VARCHAR(255) NULL,
  timestamp DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  raw_payload TEXT NULL,
  user_id VARCHAR(30) NULL,
  vendor_id VARCHAR(30) NULL,
  channel_id VARCHAR(30) NULL,
  project_id VARCHAR(30) NULL,
  PRIMARY KEY (id),
  KEY me_msg_ts_idx (message_id, timestamp),
  KEY me_msg_idx (message_id),
  KEY me_status_idx (status),
  KEY me_vendor_ref_idx (vendor_ref_id),
  KEY me_user_status_ts_idx (user_id, status, timestamp),
  KEY me_user_vend_chan_proj_status_idx (user_id, vendor_id, channel_id, project_id, status),
  KEY me_user_vend_chan_ts_idx (user_id, vendor_id, channel_id, timestamp),
  KEY me_user_vend_chan_proj_ts_idx (user_id, vendor_id, channel_id, project_id, timestamp),
  CONSTRAINT me_message_id_fkey FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE analytics_cache (
  id VARCHAR(30) NOT NULL,
  user_id VARCHAR(30) NOT NULL,
  vendor_id VARCHAR(30) NULL,
  channel_id VARCHAR(30) NULL,
  project_id VARCHAR(30) NULL,
  date DATETIME(3) NOT NULL,
  total_sent INT NOT NULL DEFAULT 0,
  total_delivered INT NOT NULL DEFAULT 0,
  total_read INT NOT NULL DEFAULT 0,
  total_failed INT NOT NULL DEFAULT 0,
  success_rate DOUBLE NOT NULL DEFAULT 0,
  last_updated DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY ac_user_vend_chan_proj_date_key (user_id, vendor_id, channel_id, project_id, date),
  KEY ac_vendor_id_fkey (vendor_id),
  KEY ac_channel_id_fkey (channel_id),
  KEY ac_project_id_fkey (project_id),
  CONSTRAINT ac_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ac_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON UPDATE CASCADE,
  CONSTRAINT ac_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES channels (id) ON UPDATE CASCADE,
  CONSTRAINT ac_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE outbound_messages (
  id VARCHAR(30) NOT NULL,
  user_id VARCHAR(30) NOT NULL,
  project_id VARCHAR(30) NOT NULL,
  vendor_id VARCHAR(30) NOT NULL,
  channel_id VARCHAR(30) NOT NULL,
  vendor_ref_id VARCHAR(100) NOT NULL,
  recipient VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  sent_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY outbound_messages_vendor_ref_id_idx (vendor_ref_id),
  KEY outbound_messages_user_id_project_id_sent_at_idx (user_id, project_id, sent_at),
  KEY outbound_messages_user_id_vendor_id_channel_id_idx (user_id, vendor_id, channel_id),
  KEY outbound_messages_project_id_fkey (project_id),
  KEY outbound_messages_vendor_id_fkey (vendor_id),
  KEY outbound_messages_channel_id_fkey (channel_id),
  CONSTRAINT outbound_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT outbound_messages_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT outbound_messages_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON UPDATE CASCADE,
  CONSTRAINT outbound_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES channels (id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function main() {
  console.log('Exporting Turso data to SQL file...\n');

  const output: string[] = [];

  output.push('-- Turso to MySQL Migration');
  output.push('-- Generated: ' + new Date().toISOString());
  output.push('SET FOREIGN_KEY_CHECKS = 0;');
  output.push('SET NAMES utf8mb4;');
  output.push('');

  // Add CREATE TABLE statements
  output.push(CREATE_TABLES);
  output.push('');

  // 1. Users
  console.log('Exporting users...');
  const users = await turso.execute('SELECT * FROM users');
  output.push('-- Users');
  for (const row of users.rows) {
    output.push(`INSERT IGNORE INTO users (id, name, email, password, account_type, parent_id, created_at, updated_at) VALUES (${escapeString(row.id)}, ${escapeString(row.name)}, ${escapeString(row.email)}, ${escapeString(row.password)}, ${escapeString(row.account_type || 'PARENT')}, ${escapeString(row.parent_id)}, ${toDateTime(row.created_at)}, ${toDateTime(row.updated_at)});`);
  }
  console.log(`  ${users.rows.length} users`);
  output.push('');

  // 2. Vendors
  console.log('Exporting vendors...');
  const vendors = await turso.execute('SELECT * FROM vendors');
  output.push('-- Vendors');
  for (const row of vendors.rows) {
    output.push(`INSERT IGNORE INTO vendors (id, name, slug, description, is_active, created_at) VALUES (${escapeString(row.id)}, ${escapeString(row.name)}, ${escapeString(row.slug)}, ${escapeString(row.description)}, ${toBool(row.is_active)}, ${toDateTime(row.created_at)});`);
  }
  console.log(`  ${vendors.rows.length} vendors`);
  output.push('');

  // 3. Channels
  console.log('Exporting channels...');
  const channels = await turso.execute('SELECT * FROM channels');
  output.push('-- Channels');
  for (const row of channels.rows) {
    output.push(`INSERT IGNORE INTO channels (id, name, type, description, is_active, created_at) VALUES (${escapeString(row.id)}, ${escapeString(row.name)}, ${escapeString(row.type)}, ${escapeString(row.description)}, ${toBool(row.is_active)}, ${toDateTime(row.created_at)});`);
  }
  console.log(`  ${channels.rows.length} channels`);
  output.push('');

  // 4. Projects
  console.log('Exporting projects...');
  const projects = await turso.execute('SELECT * FROM projects');
  output.push('-- Projects');
  for (const row of projects.rows) {
    output.push(`INSERT IGNORE INTO projects (id, name, description, user_id, created_at, updated_at) VALUES (${escapeString(row.id)}, ${escapeString(row.name)}, ${escapeString(row.description)}, ${escapeString(row.user_id)}, ${toDateTime(row.created_at)}, ${toDateTime(row.updated_at)});`);
  }
  console.log(`  ${projects.rows.length} projects`);
  output.push('');

  // 5. Project Access
  console.log('Exporting project_access...');
  const projectAccess = await turso.execute('SELECT * FROM project_access');
  output.push('-- Project Access');
  for (const row of projectAccess.rows) {
    output.push(`INSERT IGNORE INTO project_access (id, project_id, user_id, access_type, granted_by, created_at) VALUES (${escapeString(row.id)}, ${escapeString(row.project_id)}, ${escapeString(row.user_id)}, ${escapeString(row.access_type)}, ${escapeString(row.granted_by)}, ${toDateTime(row.created_at)});`);
  }
  console.log(`  ${projectAccess.rows.length} project_access`);
  output.push('');

  // 6. User Vendor Channels
  console.log('Exporting user_vendor_channels...');
  const uvc = await turso.execute('SELECT * FROM user_vendor_channels');
  output.push('-- User Vendor Channels');
  for (const row of uvc.rows) {
    output.push(`INSERT IGNORE INTO user_vendor_channels (id, user_id, vendor_id, channel_id, project_id, webhook_url, webhook_secret, is_active, created_at) VALUES (${escapeString(row.id)}, ${escapeString(row.user_id)}, ${escapeString(row.vendor_id)}, ${escapeString(row.channel_id)}, ${escapeString(row.project_id)}, ${escapeString(row.webhook_url)}, ${escapeString(row.webhook_secret)}, ${toBool(row.is_active)}, ${toDateTime(row.created_at)});`);
  }
  console.log(`  ${uvc.rows.length} user_vendor_channels`);
  output.push('');

  // 7. Messages
  console.log('Exporting messages...');
  const messages = await turso.execute('SELECT * FROM messages');
  output.push('-- Messages');
  for (const row of messages.rows) {
    output.push(`INSERT IGNORE INTO messages (id, user_id, vendor_id, channel_id, project_id, recipient, message_id, content_summary, created_at) VALUES (${escapeString(row.id)}, ${escapeString(row.user_id)}, ${escapeString(row.vendor_id)}, ${escapeString(row.channel_id)}, ${escapeString(row.project_id)}, ${escapeString(row.recipient)}, ${escapeString(row.message_id)}, ${escapeString(row.content_summary)}, ${toDateTime(row.created_at)});`);
  }
  console.log(`  ${messages.rows.length} messages`);
  output.push('');

  // 8. Message Events
  console.log('Exporting message_events...');
  const events = await turso.execute('SELECT * FROM message_events');
  output.push('-- Message Events');
  for (const row of events.rows) {
    output.push(`INSERT IGNORE INTO message_events (id, message_id, vendor_ref_id, status, reason, timestamp, raw_payload, user_id, vendor_id, channel_id, project_id) VALUES (${escapeString(row.id)}, ${escapeString(row.message_id)}, ${escapeString(row.vendor_ref_id)}, ${escapeString(row.status)}, ${escapeString(row.reason)}, ${toDateTime(row.timestamp)}, ${escapeString(row.raw_payload)}, ${escapeString(row.user_id)}, ${escapeString(row.vendor_id)}, ${escapeString(row.channel_id)}, ${escapeString(row.project_id)});`);
  }
  console.log(`  ${events.rows.length} message_events`);
  output.push('');

  // 9. Analytics Cache
  console.log('Exporting analytics_cache...');
  const analytics = await turso.execute('SELECT * FROM analytics_cache');
  output.push('-- Analytics Cache');
  for (const row of analytics.rows) {
    output.push(`INSERT IGNORE INTO analytics_cache (id, user_id, vendor_id, channel_id, project_id, date, total_sent, total_delivered, total_read, total_failed, success_rate, last_updated) VALUES (${escapeString(row.id)}, ${escapeString(row.user_id)}, ${escapeString(row.vendor_id)}, ${escapeString(row.channel_id)}, ${escapeString(row.project_id)}, ${toDateTime(row.date)}, ${row.total_sent || 0}, ${row.total_delivered || 0}, ${row.total_read || 0}, ${row.total_failed || 0}, ${row.success_rate || 0}, NOW());`);
  }
  console.log(`  ${analytics.rows.length} analytics_cache`);
  output.push('');

  // 10. Outbound Messages
  console.log('Exporting outbound_messages...');
  const outbound = await turso.execute('SELECT * FROM outbound_messages');
  output.push('-- Outbound Messages');
  for (const row of outbound.rows) {
    output.push(`INSERT IGNORE INTO outbound_messages (id, user_id, project_id, vendor_id, channel_id, vendor_ref_id, recipient, content, sent_at, created_at) VALUES (${escapeString(row.id)}, ${escapeString(row.user_id)}, ${escapeString(row.project_id)}, ${escapeString(row.vendor_id)}, ${escapeString(row.channel_id)}, ${escapeString(row.vendor_ref_id)}, ${escapeString(row.recipient)}, ${escapeString(row.content)}, ${toDateTime(row.sent_at)}, ${toDateTime(row.created_at)});`);
  }
  console.log(`  ${outbound.rows.length} outbound_messages`);
  output.push('');

  output.push('SET FOREIGN_KEY_CHECKS = 1;');
  output.push('-- Migration complete');

  // Write to file
  const filename = 'turso_export.sql';
  fs.writeFileSync(filename, output.join('\n'), 'utf8');

  console.log(`\n✅ Exported to ${filename}`);
  console.log(`File size: ${(fs.statSync(filename).size / 1024 / 1024).toFixed(2)} MB`);

  turso.close();
}

main().catch(console.error);
