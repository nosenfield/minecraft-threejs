import * as THREE from 'three'

/**
 * Capture current WebGL canvas as a base64 JPEG thumbnail.
 * Returns a data URL suitable for img src or Firestore storage.
 * 
 * @param renderer - Three.js WebGL renderer with canvas
 * @returns Base64 JPEG data URL, or empty string if capture fails
 */
export function captureThumbnail(renderer: THREE.WebGLRenderer): string {
  const canvas = renderer.domElement

  // Create smaller canvas for thumbnail
  const thumbCanvas = document.createElement('canvas')
  thumbCanvas.width = 240
  thumbCanvas.height = 180

  const ctx = thumbCanvas.getContext('2d')
  if (!ctx) {
    console.warn('Failed to get 2D context for thumbnail capture')
    return ''
  }

  // Draw scaled down version
  ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height)

  // Return base64 JPEG (quality 0.7 for smaller file size)
  return thumbCanvas.toDataURL('image/jpeg', 0.7)
}
