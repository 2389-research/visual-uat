// ABOUTME: Type definitions for smart image diffing
// ABOUTME: Defines alignment regions, diff results, and configuration interfaces

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MatchedRegion {
  type: 'matched';
  baseline: BoundingBox;
  current: BoundingBox;
  similarity: number; // 0-1
}

export interface InsertedRegion {
  type: 'inserted';
  baseline: null;
  current: BoundingBox;
  similarity: null;
}

export interface DeletedRegion {
  type: 'deleted';
  baseline: BoundingBox;
  current: null;
  similarity: null;
}

export type AlignmentRegion = MatchedRegion | InsertedRegion | DeletedRegion;

export interface SmartDiffResult {
  strategy: 'adaptive' | 'feature-based';
  confidence: number; // 0.5-1.0
  regions: AlignmentRegion[];
}

export interface SmartDifferConfig {
  adaptiveThreshold: number;   // 0.95 default
  searchWindow: number;         // 50 default
  blockSize: number;            // 50 default
  fallbackThreshold: number;    // 3 default
  enableColumnPass: boolean;    // true default - enable column-based refinement
  columnPassThreshold: number;  // 0.5 default - threshold for column refinement (lower = more lenient)
}

export const DEFAULT_CONFIG: SmartDifferConfig = {
  adaptiveThreshold: 0.95,
  searchWindow: 50,
  blockSize: 50,
  fallbackThreshold: 3,
  enableColumnPass: true,
  columnPassThreshold: 0.5
};
