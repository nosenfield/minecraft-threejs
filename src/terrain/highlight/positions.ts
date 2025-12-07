import * as THREE from 'three'

/**
 * Calculate positions for a line of blocks between two points.
 * Uses parametric interpolation to support diagonal lines.
 *
 * @param start - Starting position (first click)
 * @param end - Ending position (current cursor or release point)
 * @returns Array of integer grid positions along the line
 */
export function calculateLinePositions(
  start: THREE.Vector3,
  end: THREE.Vector3
): THREE.Vector3[] {
  const positions: THREE.Vector3[] = []

  // Calculate differences in grid coordinates
  // For Y, we need to preserve the 0.5 offset, so calculate the integer height difference
  const dx = Math.abs(Math.round(end.x) - Math.round(start.x))
  const dz = Math.abs(Math.round(end.z) - Math.round(start.z))
  const dy = Math.abs(Math.round(end.y - start.y)) // Height difference in whole blocks
  const steps = Math.max(dx, dy, dz)

  // Get the Y offset from start (e.g., 0.5)
  const yOffset = start.y - Math.floor(start.y)
  const startYFloor = Math.floor(start.y)
  const endYFloor = Math.floor(end.y)

  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps
    // Interpolate Y in whole blocks, then add back the offset
    const interpolatedYFloor = Math.round(startYFloor + t * (endYFloor - startYFloor))
    positions.push(new THREE.Vector3(
      Math.round(start.x + t * (end.x - start.x)),
      interpolatedYFloor + yOffset,
      Math.round(start.z + t * (end.z - start.z))
    ))
  }

  // Remove duplicates (can occur with diagonal lines)
  return deduplicatePositions(positions)
}

/**
 * Calculate positions for a horizontal rectangle of blocks.
 * Uses the start Y level for the entire floor.
 *
 * @param start - First corner position
 * @param end - Opposite corner position (Y ignored, uses start.y)
 * @returns Array of positions filling the rectangle
 */
export function calculateFloorPositions(
  start: THREE.Vector3,
  end: THREE.Vector3
): THREE.Vector3[] {
  const positions: THREE.Vector3[] = []
  const y = start.y  // Floor stays at start Y level

  const minX = Math.min(Math.round(start.x), Math.round(end.x))
  const maxX = Math.max(Math.round(start.x), Math.round(end.x))
  const minZ = Math.min(Math.round(start.z), Math.round(end.z))
  const maxZ = Math.max(Math.round(start.z), Math.round(end.z))

  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      positions.push(new THREE.Vector3(x, y, z))
    }
  }

  return positions
}

/**
 * Calculate positions for a wall (vertical plane from base line).
 * Extends each base line position vertically to the target height.
 *
 * @param baseLine - Array of positions forming the base line
 * @param targetY - Target Y level for wall top (or bottom if below base)
 * @returns Array of positions filling the wall
 */
export function calculateWallPositions(
  baseLine: THREE.Vector3[],
  targetY: number
): THREE.Vector3[] {
  if (baseLine.length === 0) return []

  const positions: THREE.Vector3[] = []
  // Use the exact baseY from the base line (preserves 0.5 offset)
  const baseY = baseLine[0].y
  // Calculate height difference in whole blocks
  const heightDiff = Math.round(targetY - baseY)
  const numBlocks = Math.abs(heightDiff) + 1
  const direction = heightDiff >= 0 ? 1 : -1

  for (const basePos of baseLine) {
    for (let i = 0; i < numBlocks; i++) {
      positions.push(new THREE.Vector3(basePos.x, baseY + i * direction, basePos.z))
    }
  }

  return positions
}

/**
 * Remove duplicate positions from an array.
 * Uses string key comparison for efficiency.
 */
function deduplicatePositions(positions: THREE.Vector3[]): THREE.Vector3[] {
  const seen = new Set<string>()
  const result: THREE.Vector3[] = []

  for (const pos of positions) {
    const key = `${pos.x}_${pos.y}_${pos.z}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(pos)
    }
  }

  return result
}

/**
 * Filter out positions that already have blocks.
 *
 * @param positions - Array of positions to filter
 * @param blocksMap - Map of existing block positions
 * @returns Positions that don't overlap with existing blocks
 */
export function filterExistingBlocks(
  positions: THREE.Vector3[],
  blocksMap: Map<string, unknown>
): THREE.Vector3[] {
  return positions.filter(pos => {
    const key = `${pos.x}_${pos.y}_${pos.z}`
    const block = blocksMap.get(key)
    // Skip if block exists and is placed (not a removed block marker)
    if (block && typeof block === 'object' && 'placed' in block) {
      return !(block as { placed: boolean }).placed
    }
    return !block
  })
}
