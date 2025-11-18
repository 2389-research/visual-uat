// ABOUTME: Generates unique short run IDs for test executions.
// ABOUTME: Uses crypto to create 7-character hex strings for identifying runs.

import * as crypto from 'crypto';

export function generateRunId(): string {
  return crypto.randomBytes(4).toString('hex').slice(0, 7);
}
