import { Timestamp } from 'firebase/firestore'

/**
 * Block interface for Firestore storage
 * Simplified structure matching Space JSON format
 */
export interface Block {
  x: number
  y: number
  z: number
  color: string // Hex format: "#FF0000"
}

/**
 * Camera state for view restoration
 * Matches localStorage format used in ui/index.ts
 */
export interface CameraState {
  position: { x: number; y: number; z: number }
  quaternion: { x: number; y: number; z: number; w: number }
}

/**
 * Firestore document shape for levels collection
 */
export interface LevelDocument {
  userId: string
  name: string
  blocks: Block[]
  seed: number
  camera: CameraState | null
  thumbnail: string | null // Base64 PNG
  createdAt: Timestamp
  updatedAt: Timestamp
}

/**
 * Client-side level object with ID and Date conversions
 */
export interface Level extends Omit<LevelDocument, 'createdAt' | 'updatedAt'> {
  id: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Level summary for list display (less data)
 */
export interface LevelSummary {
  id: string
  name: string
  thumbnail: string | null
  updatedAt: Date
}

/**
 * Data for creating a new level
 */
export interface CreateLevelData {
  name: string
  blocks: Block[]
  seed: number
  camera?: CameraState
  thumbnail?: string
}

/**
 * Data for updating an existing level
 */
export interface UpdateLevelData {
  name?: string
  blocks?: Block[]
  seed?: number
  camera?: CameraState
  thumbnail?: string
}
