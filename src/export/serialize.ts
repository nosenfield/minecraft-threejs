/**
 * M5.2: Space JSON Serialization
 * 
 * Converts Block objects to Space JSON format for export to backend.
 * Space JSON is the intermediate format between frontend and Rust backend.
 * 
 * Coordinate Transformation:
 * - Three.js coordinates (1x1x1 blocks) are scaled by 2x to Roblox studs (2x2x2)
 * - Coordinates are rounded to integers before serialization
 * - Y offset (+1) is applied in backend to center 2x2x2 Part correctly
 */

import Block from '../terrain/mesh/block'
import {
  SCALED_BLOCK_X_MIN,
  SCALED_BLOCK_X_MAX,
  SCALED_BLOCK_Z_MIN,
  SCALED_BLOCK_Z_MAX,
  SCALED_BLOCK_Y_MIN,
  SCALED_BLOCK_Y_MAX,
} from '../constants'

/**
 * Space JSON block format (schemaVersion 1)
 */
export interface SpaceJSONBlockV1 {
  x: number
  y: number
  z: number
  color: string // Hex format: "#FF0000"
}

/**
 * Space JSON block format (schemaVersion 2+)
 */
export interface SpaceJSONBlockV2 extends SpaceJSONBlockV1 {
  tags?: string[]
  tagConfig?: Record<string, any>
}

/**
 * Space JSON root object
 */
export interface SpaceJSON {
  schemaVersion: number
  name?: string
  blocks: (SpaceJSONBlockV1 | SpaceJSONBlockV2)[]
}

/**
 * Serializes blocks to Space JSON format
 * 
 * Filters blocks to only include:
 * - placed === true (excludes removed blocks)
 * - isGround !== true (excludes ground plane blocks)
 * 
 * @param blocks - Array of Block objects to serialize
 * @param schemaVersion - Schema version (1 for MVP, 2+ for tags/configs)
 * @param levelName - Optional level name (defaults to "Untitled Level")
 * @returns JSON string in Space JSON format
 */
export function serializeToSpaceJSON(
  blocks: Block[],
  schemaVersion: number = 1,
  levelName: string = 'Untitled Level'
): string {
  // Filter blocks: only placed blocks that are not ground
  const userPlacedBlocks = blocks.filter(
    (block) => block.placed === true && block.isGround !== true
  )

  // Map blocks to Space JSON format based on schema version
  // Scale coordinates from Three.js units (1x1x1) to Roblox studs (2x2x2)
  const serializedBlocks: (SpaceJSONBlockV1 | SpaceJSONBlockV2)[] =
    userPlacedBlocks.map((block) => {
      // Scale and round coordinates: Three.js units * 2 = Roblox studs
      const scaledX = Math.round(block.x * 2)
      const scaledY = Math.round(block.y * 2)
      const scaledZ = Math.round(block.z * 2)

      // Validate scaled coordinates (backend will also validate, but catch early)
      if (
        scaledX < SCALED_BLOCK_X_MIN || scaledX > SCALED_BLOCK_X_MAX ||
        scaledZ < SCALED_BLOCK_Z_MIN || scaledZ > SCALED_BLOCK_Z_MAX ||
        scaledY < SCALED_BLOCK_Y_MIN || scaledY > SCALED_BLOCK_Y_MAX
      ) {
        // Skip blocks outside scaled bounds (shouldn't happen if frontend validation works)
        // Log warning but don't throw - let backend handle validation errors
        console.warn(
          `Block at (${block.x}, ${block.y}, ${block.z}) scales to (${scaledX}, ${scaledY}, ${scaledZ}) which is out of bounds. Skipping.`
        )
        return null
      }

      const baseBlock: SpaceJSONBlockV1 = {
        x: scaledX,
        y: scaledY,
        z: scaledZ,
        color: block.color,
      }

      // Include tags and configs only for schemaVersion 2+ and if tags exist
      if (schemaVersion >= 2 && block.tags && block.tags.length > 0) {
        const v2Block: SpaceJSONBlockV2 = {
          ...baseBlock,
          tags: block.tags,
          tagConfig: block.tagConfig && Object.keys(block.tagConfig).length > 0
            ? block.tagConfig
            : undefined,
        }
        return v2Block
      }

      return baseBlock
    })
    .filter((block): block is SpaceJSONBlockV1 | SpaceJSONBlockV2 => block !== null) // Remove null entries from out-of-bounds blocks

  const spaceJSON: SpaceJSON = {
    schemaVersion,
    name: levelName,
    blocks: serializedBlocks,
  }

  return JSON.stringify(spaceJSON, null, 2)
}

