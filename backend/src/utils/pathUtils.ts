import path from 'path';
import fs from 'fs';

/**
 * Robustly find the database schema file across different environments
 */
export function findSchemaPath(): string {
  const pathsToTry = [
    path.join(__dirname, '../db/schema.sql'),      // src/utils -> src/db
    path.join(__dirname, '../../src/db/schema.sql'), // dist/utils -> src/db
    path.join(__dirname, '../../db/schema.sql'),     // dist/utils -> dist/db (if copied)
    path.join(process.cwd(), 'backend/src/db/schema.sql'),
    path.join(process.cwd(), 'src/db/schema.sql'),
    '/app/backend/src/db/schema.sql', // Railway specific fallback
  ];

  for (const p of pathsToTry) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error('Could not find schema.sql in any expected location');
}

/**
 * Get the path to the frontend build artifacts
 */
export function getFrontendPath(): string {
  const pathsToTry = [
    path.join(__dirname, '../../../admin_dashboard/dist'), // src/utils -> root -> admin_dashboard/dist
    path.join(__dirname, '../../admin_dashboard/dist'),     // dist/utils -> admin_dashboard/dist
    path.join(process.cwd(), 'admin_dashboard/dist'),
  ];

  for (const p of pathsToTry) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Default fallback if not found during startup (will be checked by server)
  return path.join(process.cwd(), 'admin_dashboard/dist');
}
