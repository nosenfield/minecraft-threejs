import {
  signInAnonymously,
  onAuthStateChanged,
  User,
  AuthError
} from 'firebase/auth'
import { auth } from './config'

export type AuthState = {
  user: User | null
  loading: boolean
  error: string | null
}

let currentUser: User | null = null
let authInitialized = false
let authInitPromise: Promise<User | null> | null = null

/**
 * Initialize anonymous auth. Call once on app start.
 * Returns the authenticated user.
 */
export async function initAuth(): Promise<User | null> {
  // Return existing promise if already initializing
  if (authInitPromise) {
    return authInitPromise
  }

  authInitPromise = new Promise((resolve, reject) => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (user) {
          // Already signed in (possibly from persistence)
          currentUser = user
          authInitialized = true
          unsubscribe()
          resolve(user)
        } else if (!authInitialized) {
          // Not signed in, create anonymous account
          try {
            const credential = await signInAnonymously(auth)
            currentUser = credential.user
            authInitialized = true
            unsubscribe()
            resolve(credential.user)
          } catch (error) {
            const authError = error as AuthError
            console.error('Anonymous auth failed:', authError.message)
            authInitialized = true
            unsubscribe()
            reject(error)
          }
        }
      },
      (error) => {
        console.error('Auth state error:', error)
        unsubscribe()
        reject(error)
      }
    )
  })

  return authInitPromise
}

/**
 * Get current user. Returns null if not authenticated.
 */
export function getCurrentUser(): User | null {
  return currentUser
}

/**
 * Get current user ID. Throws if not authenticated.
 */
export function getUserId(): string {
  if (!currentUser) {
    throw new Error('Not authenticated')
  }
  return currentUser.uid
}

/**
 * Check if auth has been initialized.
 */
export function isAuthInitialized(): boolean {
  return authInitialized
}

