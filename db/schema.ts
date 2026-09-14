// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const demoWorkspaces = sqliteTable('solar_demo_workspaces', { id:text('id').primaryKey(), snapshot:text('snapshot').notNull(), revision:integer('revision').notNull().default(0), updatedAt:text('updated_at').notNull() });
