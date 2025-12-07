import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'
import { getUserId } from './auth'
import type {
  LevelDocument,
  Level,
  LevelSummary,
  CreateLevelData,
  UpdateLevelData
} from './types'

const LEVELS_COLLECTION = 'levels'
const MAX_LEVELS_PER_USER = 5

/**
 * Convert Firestore document to Level object
 * Converts Timestamp to Date for client-side use
 */
function docToLevel(id: string, data: LevelDocument): Level {
  return {
    id,
    userId: data.userId,
    name: data.name,
    blocks: data.blocks,
    seed: data.seed,
    camera: data.camera,
    thumbnail: data.thumbnail,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  }
}

/**
 * Convert Level to LevelSummary (for list display)
 */
function levelToSummary(level: Level): LevelSummary {
  return {
    id: level.id,
    name: level.name,
    thumbnail: level.thumbnail,
    updatedAt: level.updatedAt,
  }
}

/**
 * List all levels for current user
 * Returns levels ordered by updatedAt descending (most recent first)
 */
export async function listLevels(): Promise<LevelSummary[]> {
  const userId = getUserId()

  const q = query(
    collection(db, LEVELS_COLLECTION),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  )

  const snapshot = await getDocs(q)

  return snapshot.docs.map((doc) => {
    const data = doc.data() as LevelDocument
    return levelToSummary(docToLevel(doc.id, data))
  })
}

/**
 * Get a single level by ID
 * Verifies ownership before returning
 * @throws Error if level not found or access denied
 */
export async function getLevel(levelId: string): Promise<Level | null> {
  const userId = getUserId()

  const docRef = doc(db, LEVELS_COLLECTION, levelId)
  const snapshot = await getDoc(docRef)

  if (!snapshot.exists()) {
    return null
  }

  const data = snapshot.data() as LevelDocument

  // Verify ownership
  if (data.userId !== userId) {
    throw new Error('Access denied')
  }

  return docToLevel(snapshot.id, data)
}

/**
 * Create a new level
 * Enforces 5-level limit per user
 * @throws Error if user has reached maximum level limit
 */
export async function createLevel(data: CreateLevelData): Promise<Level> {
  const userId = getUserId()

  // Check level count
  const existingLevels = await listLevels()
  if (existingLevels.length >= MAX_LEVELS_PER_USER) {
    throw new Error(`Maximum ${MAX_LEVELS_PER_USER} levels allowed. Delete a level to create a new one.`)
  }

  const levelDoc: Omit<LevelDocument, 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>
    updatedAt: ReturnType<typeof serverTimestamp>
  } = {
    userId,
    name: data.name,
    blocks: data.blocks,
    seed: data.seed,
    camera: data.camera || null,
    thumbnail: data.thumbnail || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  const docRef = await addDoc(collection(db, LEVELS_COLLECTION), levelDoc)

  // Return created level
  return {
    id: docRef.id,
    userId,
    name: data.name,
    blocks: data.blocks,
    seed: data.seed,
    camera: data.camera || null,
    thumbnail: data.thumbnail || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/**
 * Update an existing level
 * Verifies ownership before updating
 * @throws Error if level not found or access denied
 */
export async function updateLevel(levelId: string, data: UpdateLevelData): Promise<void> {
  // Verify ownership first
  const existing = await getLevel(levelId)
  if (!existing) {
    throw new Error('Level not found')
  }

  const updates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  }

  if (data.name !== undefined) updates.name = data.name
  if (data.blocks !== undefined) updates.blocks = data.blocks
  if (data.seed !== undefined) updates.seed = data.seed
  if (data.camera !== undefined) updates.camera = data.camera
  if (data.thumbnail !== undefined) updates.thumbnail = data.thumbnail

  const docRef = doc(db, LEVELS_COLLECTION, levelId)
  await updateDoc(docRef, updates)
}

/**
 * Delete a level
 * Verifies ownership before deleting
 * @throws Error if level not found or access denied
 */
export async function deleteLevel(levelId: string): Promise<void> {
  // Verify ownership first
  const existing = await getLevel(levelId)
  if (!existing) {
    throw new Error('Level not found')
  }

  const docRef = doc(db, LEVELS_COLLECTION, levelId)
  await deleteDoc(docRef)
}

/**
 * Get the maximum number of levels allowed per user
 */
export function getMaxLevels(): number {
  return MAX_LEVELS_PER_USER
}
