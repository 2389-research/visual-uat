// ABOUTME: Tests for run ID generator, ensuring unique 7-character hex identifiers are created.
// ABOUTME: Validates format and uniqueness of generated run IDs.
import { generateRunId } from './run-id-generator';

describe('generateRunId', () => {
  it('should generate 7-character hash', () => {
    const runId = generateRunId();
    expect(runId).toHaveLength(7);
    expect(runId).toMatch(/^[a-f0-9]{7}$/);
  });

  it('should generate unique IDs', () => {
    const id1 = generateRunId();
    const id2 = generateRunId();
    expect(id1).not.toBe(id2);
  });
});
