/**
 * M5.2: Space JSON Serialization
 * 
 * Converts Block objects to Space JSON format for export to backend.
 * Space JSON is the intermediate format between frontend and Rust backend.
 */

import Block from '../terrain/mesh/block'

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
  const serializedBlocks: (SpaceJSONBlockV1 | SpaceJSONBlockV2)[] =
    userPlacedBlocks.map((block) => {
      const baseBlock: SpaceJSONBlockV1 = {
        x: block.x,
        y: block.y,
        z: block.z,
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

  const spaceJSON: SpaceJSON = {
    schemaVersion,
    name: levelName,
    blocks: serializedBlocks,
  }

  return JSON.stringify(spaceJSON, null, 2)
}

