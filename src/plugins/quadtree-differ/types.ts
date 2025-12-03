// ABOUTME: Type definitions for quadtree-based image diffing
// ABOUTME: Configuration and internal node structures

export interface QuadtreeConfig {
  minBlockSize: number;        // Stop recursion at this size (default: 16)
  similarityThreshold: number; // Region match threshold (default: 0.95)
  maxDepth: number;            // Safety limit (default: 10)
  pixelThreshold: number;      // Per-pixel color difference threshold (default: 10)
}

export const DEFAULT_QUADTREE_CONFIG: QuadtreeConfig = {
  minBlockSize: 16,            // Smaller blocks for finer detection
  similarityThreshold: 0.95,
  maxDepth: 10,
  pixelThreshold: 10           // More sensitive to subtle changes like opacity
};

export interface QuadtreeNode {
  x: number;
  y: number;
  width: number;
  height: number;
  identical: boolean;
  children?: QuadtreeNode[];
}
