// ABOUTME: Feature-based matching using perceptual hashing (Tier 2)
// ABOUTME: Handles complex scenarios with major content restructuring

import { PNG } from 'pngjs';
import { bmvbhash } from 'blockhash-core';
import type { AlignmentRegion, SmartDifferConfig } from './types';

export interface MatchResult {
  regions: AlignmentRegion[];
  confidence: number;
}

interface Block {
  y: number;
  height: number;
  hash: string;
  data: Buffer;
}

interface BlockMatch {
  baselineBlock: Block;
  currentBlock: Block;
  similarity: number;
}

export class FeatureMatcher {
  constructor(private config: SmartDifferConfig) {}

  async match(baseline: PNG, current: PNG): Promise<MatchResult> {
    // Divide images into blocks
    const baselineBlocks = this.divideIntoBlocks(baseline);
    const currentBlocks = this.divideIntoBlocks(current);

    // Find block correspondences
    const matches = this.findMatches(baselineBlocks, currentBlocks);

    // Build alignment regions
    const regions = this.buildRegions(matches, baselineBlocks, currentBlocks, baseline.width, current.width);

    // Calculate confidence
    const confidence = this.calculateConfidence(matches, baselineBlocks, currentBlocks);

    return { regions, confidence };
  }

  private divideIntoBlocks(image: PNG): Block[] {
    const blocks: Block[] = [];
    const { blockSize } = this.config;
    let y = 0;

    while (y < image.height) {
      const height = Math.min(blockSize, image.height - y);
      const data = this.extractBlock(image, y, height);
      const hash = this.computeHash(data, image.width, height);

      blocks.push({ y, height, hash, data });
      y += height;
    }

    return blocks;
  }

  private extractBlock(image: PNG, y: number, height: number): Buffer {
    const blockSize = image.width * height * 4;
    const data = Buffer.alloc(blockSize);

    for (let row = 0; row < height; row++) {
      const srcOffset = (image.width * (y + row)) << 2;
      const dstOffset = (image.width * row) << 2;
      const rowSize = image.width << 2;

      image.data.copy(data, dstOffset, srcOffset, srcOffset + rowSize);
    }

    return data;
  }

  private computeHash(data: Buffer, width: number, height: number): string {
    try {
      // Use blockhash with 16-bit precision
      const bits = 16;
      const imageData = {
        width,
        height,
        data: new Uint8ClampedArray(data)
      };
      const hash = bmvbhash(imageData, bits);

      // Add color checksum to differentiate uniform blocks
      // Calculate average color values
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }

      if (count > 0) {
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
      }

      const colorChecksum = (r << 16) | (g << 8) | b;

      return hash + ':' + colorChecksum.toString(36);
    } catch (error) {
      // Fallback: simple checksum
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i];
      }
      return sum.toString(36);
    }
  }

  private findMatches(baselineBlocks: Block[], currentBlocks: Block[]): BlockMatch[] {
    const matches: BlockMatch[] = [];
    const usedCurrent = new Set<number>();

    // Greedy matching: for each baseline block, find best matching current block
    for (const baselineBlock of baselineBlocks) {
      let bestMatch: { index: number; similarity: number } | null = null;

      for (let i = 0; i < currentBlocks.length; i++) {
        if (usedCurrent.has(i)) continue;

        const currentBlock = currentBlocks[i];
        const similarity = this.hashSimilarity(baselineBlock.hash, currentBlock.hash);

        if (similarity > 0.8 && (!bestMatch || similarity > bestMatch.similarity)) {
          bestMatch = { index: i, similarity };
        }
      }

      if (bestMatch) {
        matches.push({
          baselineBlock,
          currentBlock: currentBlocks[bestMatch.index],
          similarity: bestMatch.similarity
        });
        usedCurrent.add(bestMatch.index);
      }
    }

    return matches;
  }

  private hashSimilarity(hash1: string, hash2: string): number {
    if (hash1 === hash2) return 1.0;

    const [percepHash1, colorChecksum1] = hash1.split(':');
    const [percepHash2, colorChecksum2] = hash2.split(':');

    if (!percepHash1 || !percepHash2 || percepHash1.length !== percepHash2.length) return 0;

    // Hamming distance for perceptual hash
    let matches = 0;
    for (let i = 0; i < percepHash1.length; i++) {
      if (percepHash1[i] === percepHash2[i]) matches++;
    }
    const percepSimilarity = matches / percepHash1.length;

    // Compare color checksums (exact match for now)
    const colorMatch = colorChecksum1 === colorChecksum2 ? 1.0 : 0.0;

    // Weight: 80% perceptual hash, 20% color
    // Note: Color mismatch contributes 0, so max similarity with different colors is 0.8
    // This prevents false matches of solid-color blocks with different colors
    return percepSimilarity * 0.8 + colorMatch * 0.2;
  }

  private buildRegions(
    matches: BlockMatch[],
    baselineBlocks: Block[],
    currentBlocks: Block[],
    baselineWidth: number,
    currentWidth: number
  ): AlignmentRegion[] {
    const regions: AlignmentRegion[] = [];
    const matchedBaselineIndices = new Set(matches.map(m => baselineBlocks.indexOf(m.baselineBlock)));
    const matchedCurrentIndices = new Set(matches.map(m => currentBlocks.indexOf(m.currentBlock)));

    // Add matched regions
    for (const match of matches) {
      regions.push({
        type: 'matched',
        baseline: {
          x: 0,
          y: match.baselineBlock.y,
          width: baselineWidth,
          height: match.baselineBlock.height
        },
        current: {
          x: 0,
          y: match.currentBlock.y,
          width: currentWidth,
          height: match.currentBlock.height
        },
        similarity: match.similarity
      });
    }

    // Add deleted regions (unmatched baseline blocks)
    for (let i = 0; i < baselineBlocks.length; i++) {
      if (!matchedBaselineIndices.has(i)) {
        const block = baselineBlocks[i];
        regions.push({
          type: 'deleted',
          baseline: {
            x: 0,
            y: block.y,
            width: baselineWidth,
            height: block.height
          },
          current: null,
          similarity: null
        });
      }
    }

    // Add inserted regions (unmatched current blocks)
    for (let i = 0; i < currentBlocks.length; i++) {
      if (!matchedCurrentIndices.has(i)) {
        const block = currentBlocks[i];
        regions.push({
          type: 'inserted',
          baseline: null,
          current: {
            x: 0,
            y: block.y,
            width: currentWidth,
            height: block.height
          },
          similarity: null
        });
      }
    }

    // Sort regions by y-coordinate for better visualization
    regions.sort((a, b) => {
      const aY = a.baseline?.y ?? a.current?.y ?? 0;
      const bY = b.baseline?.y ?? b.current?.y ?? 0;
      return aY - bY;
    });

    // Merge consecutive matched regions with perfect similarity
    const mergedRegions: AlignmentRegion[] = [];
    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];

      if (region.type === 'matched' && region.similarity === 1.0 && mergedRegions.length > 0) {
        const lastRegion = mergedRegions[mergedRegions.length - 1];

        // Check if we can merge with the last region
        if (lastRegion.type === 'matched' &&
            lastRegion.similarity === 1.0 &&
            lastRegion.baseline && region.baseline &&
            lastRegion.current && region.current &&
            lastRegion.baseline.y + lastRegion.baseline.height === region.baseline.y &&
            lastRegion.current.y + lastRegion.current.height === region.current.y) {
          // Merge with last region
          lastRegion.baseline.height += region.baseline.height;
          lastRegion.current.height += region.current.height;
          continue;
        }
      }

      mergedRegions.push(region);
    }

    return mergedRegions;
  }

  private calculateConfidence(
    matches: BlockMatch[],
    baselineBlocks: Block[],
    currentBlocks: Block[]
  ): number {
    if (matches.length === 0) return 0.5;

    const totalBlocks = Math.max(baselineBlocks.length, currentBlocks.length);
    const matchRatio = matches.length / totalBlocks;
    const avgSimilarity = matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length;

    return 0.5 + (matchRatio * avgSimilarity * 0.5);
  }
}
