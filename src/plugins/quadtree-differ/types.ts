// ABOUTME: Type definitions for quadtree-based image diffing
// ABOUTME: Configuration and internal node structures

export interface QuadtreeConfig {
  minBlockSize: number;        // Stop recursion at this size (default: 32)
  similarityThreshold: number; // Hash match threshold (default: 0.95)
  maxDepth: number;            // Safety limit (default: 8)
}

export const DEFAULT_QUADTREE_CONFIG: QuadtreeConfig = {
  minBlockSize: 32,
  similarityThreshold: 0.95,
  maxDepth: 8
};

export interface QuadtreeNode {
  x: number;
  y: number;
  width: number;
  height: number;
  identical: boolean;
  children?: QuadtreeNode[];
}
