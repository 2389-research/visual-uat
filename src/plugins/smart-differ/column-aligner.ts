// ABOUTME: Column-based alignment for horizontal change isolation
// ABOUTME: Identifies which columns within a row range actually changed

import { PNG } from 'pngjs';
import type { SmartDifferConfig } from './types';

export interface ColumnRange {
  startX: number;
  endX: number;
  similarity: number;
}

export interface ColumnAlignmentResult {
  changedColumns: ColumnRange[];
  unchangedColumns: ColumnRange[];
}

export class ColumnAligner {
  constructor(private config: SmartDifferConfig) {}

  async alignColumns(
    baseline: PNG,
    current: PNG,
    rowRange: { startRow: number; endRow: number }
  ): Promise<ColumnAlignmentResult> {
    const width = Math.min(baseline.width, current.width);
    const columnWidth = Math.max(1, Math.floor(width / 10)); // Divide into ~10 strips

    const rawChangedColumns: ColumnRange[] = [];
    const rawUnchangedColumns: ColumnRange[] = [];

    for (let startX = 0; startX < width; startX += columnWidth) {
      const endX = Math.min(startX + columnWidth, width);
      const similarity = this.compareColumnStrip(
        baseline,
        current,
        startX,
        endX,
        rowRange.startRow,
        rowRange.endRow
      );

      const range: ColumnRange = { startX, endX, similarity };

      // Use columnPassThreshold for column refinement (lower than adaptiveThreshold)
      // This separates columns with major changes (like image areas) from columns
      // with minor/no changes (like text margins and whitespace)
      const threshold = this.config.columnPassThreshold ?? 0.5;
      if (similarity >= threshold) {
        rawUnchangedColumns.push(range);
      } else {
        rawChangedColumns.push(range);
      }
    }

    // Merge contiguous changed columns
    const changedColumns = this.mergeContiguousColumns(rawChangedColumns);
    const unchangedColumns = this.mergeContiguousColumns(rawUnchangedColumns);

    return { changedColumns, unchangedColumns };
  }

  private mergeContiguousColumns(columns: ColumnRange[]): ColumnRange[] {
    if (columns.length === 0) return [];

    const merged: ColumnRange[] = [];
    let current = { ...columns[0] };

    for (let i = 1; i < columns.length; i++) {
      if (columns[i].startX === current.endX) {
        // Contiguous - extend the current range
        current.endX = columns[i].endX;
        // Average the similarity
        current.similarity = (current.similarity + columns[i].similarity) / 2;
      } else {
        // Not contiguous - push current and start new range
        merged.push(current);
        current = { ...columns[i] };
      }
    }
    merged.push(current);

    return merged;
  }

  private compareColumnStrip(
    baseline: PNG,
    current: PNG,
    startX: number,
    endX: number,
    startRow: number,
    endRow: number
  ): number {
    let matchingPixels = 0;
    let totalPixels = 0;

    for (let y = startRow; y < endRow && y < baseline.height && y < current.height; y++) {
      for (let x = startX; x < endX; x++) {
        const idx1 = (y * baseline.width + x) << 2;
        const idx2 = (y * current.width + x) << 2;

        const rDiff = Math.abs(baseline.data[idx1] - current.data[idx2]);
        const gDiff = Math.abs(baseline.data[idx1 + 1] - current.data[idx2 + 1]);
        const bDiff = Math.abs(baseline.data[idx1 + 2] - current.data[idx2 + 2]);
        const avgDiff = (rDiff + gDiff + bDiff) / 3;

        if (avgDiff < 25) {
          matchingPixels++;
        }
        totalPixels++;
      }
    }

    return totalPixels > 0 ? matchingPixels / totalPixels : 0;
  }
}
