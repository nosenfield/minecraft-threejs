import * as THREE from 'three'
import Terrain from '..'
import { BLOCK_INTERACTION_RANGE } from '../../constants'
import { EditMode } from '../../control/editMode'
import { calculateLinePositions, calculateFloorPositions, calculateWallPositions, filterExistingBlocks } from './positions'

/**
 * Block highlight and multi-block preview system.
 *
 * - Single mode: Shows highlight on targeted block
 * - Line/Floor/Wall modes: Shows ghost block preview during drag
 */
export default class BlockHighlight {
  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    terrain: Terrain
  ) {
    this.camera = camera
    this.scene = scene
    this.terrain = terrain
    this.raycaster = new THREE.Raycaster()
    this.raycaster.far = BLOCK_INTERACTION_RANGE
  }

  // Core references
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  terrain: Terrain
  raycaster: THREE.Raycaster
  block: THREE.Intersection | null = null

  // Single block highlight mesh
  geometry = new THREE.BoxGeometry(1.01, 1.01, 1.01)
  material = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0.25
  })
  mesh = new THREE.Mesh(new THREE.BoxGeometry(), this.material)

  // Multi-block preview
  previewMeshes: THREE.Mesh[] = []
  previewPositions: THREE.Vector3[] = []
  previewMaterial = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0.25
  })

  // Control state (set by terrain.update)
  editMode: EditMode = EditMode.Single
  dragStart: THREE.Vector3 | null = null
  isDragging = false
  previewColor: number = 0xff0000
  currentBlockCount = 0

  // Wall tool state
  wallPhase: 'idle' | 'drawing_line' | 'drawing_height' = 'idle'
  wallBaseLine: THREE.Vector3[] = []

  /**
   * Set the edit mode for preview calculation
   */
  setEditMode(mode: EditMode) {
    this.editMode = mode
  }

  /**
   * Set drag start position (null when not dragging)
   */
  setDragStart(position: THREE.Vector3 | null) {
    this.dragStart = position
    this.isDragging = position !== null
  }

  /**
   * Set preview color to match selected block
   */
  setPreviewColor(color: number) {
    this.previewColor = color
    this.material.color.setHex(color)
    this.previewMaterial.color.setHex(color)
  }

  /**
   * Set current block count for limit checking
   */
  setCurrentBlockCount(count: number) {
    this.currentBlockCount = count
  }

  /**
   * Set wall phase for two-phase wall drawing
   */
  setWallPhase(phase: 'idle' | 'drawing_line' | 'drawing_height') {
    this.wallPhase = phase
    if (phase === 'idle') {
      this.wallBaseLine = []
    }
  }

  /**
   * Set wall base line (confirmed line from Phase 1)
   */
  setWallBaseLine(line: THREE.Vector3[]) {
    this.wallBaseLine = line
  }

  /**
   * Get current preview positions (for placement on mouseup)
   */
  getPreviewPositions(): THREE.Vector3[] {
    return this.previewPositions
  }

  /**
   * Clear all preview meshes from scene
   */
  private clearPreviewMeshes() {
    for (const mesh of this.previewMeshes) {
      this.scene.remove(mesh)
    }
    this.previewMeshes = []
    this.previewPositions = []
  }

  /**
   * Render preview meshes at given positions
   */
  private renderPreviewMeshes(positions: THREE.Vector3[]) {
    this.clearPreviewMeshes()

    // Filter out existing blocks
    const filtered = filterExistingBlocks(positions, this.terrain.blocksMap)

    // Limit preview count for performance
    const maxPreview = Math.min(filtered.length, 1000)

    for (let i = 0; i < maxPreview; i++) {
      const pos = filtered[i]
      const mesh = new THREE.Mesh(this.geometry, this.previewMaterial)
      mesh.position.set(pos.x, pos.y, pos.z)
      this.scene.add(mesh)
      this.previewMeshes.push(mesh)
    }

    this.previewPositions = filtered
  }

  /**
   * Get placement position from raycast hit
   */
  private getPlacementPosition(hit: THREE.Intersection): THREE.Vector3 | null {
    if (!(hit.object instanceof THREE.InstancedMesh) || typeof hit.instanceId !== 'number') {
      return null
    }

    const matrix = new THREE.Matrix4()
    hit.object.getMatrixAt(hit.instanceId, matrix)
    const position = new THREE.Vector3().setFromMatrixPosition(matrix)
    const normal = hit.face!.normal

    return new THREE.Vector3(
      position.x + normal.x,
      position.y + normal.y,
      position.z + normal.z
    )
  }

  /**
   * Calculate wall height from camera ray intersection with wall plane
   */
  private calculateWallHeight(): number {
    if (this.wallBaseLine.length === 0) {
      return 0
    }

    const baseY = this.wallBaseLine[0].y
    const cameraDirection = new THREE.Vector3()
    this.camera.getWorldDirection(cameraDirection)

    // Determine wall plane orientation from base line
    const start = this.wallBaseLine[0]
    const end = this.wallBaseLine[this.wallBaseLine.length - 1]
    const dx = Math.abs(end.x - start.x)
    const dz = Math.abs(end.z - start.z)
    const constantAxis = dx >= dz ? 'z' : 'x'

    let targetY: number

    if (constantAxis === 'x') {
      // Wall plane at constant X
      const planeX = start.x
      if (Math.abs(cameraDirection.x) < 0.001) {
        targetY = this.camera.position.y
      } else {
        const t = (planeX - this.camera.position.x) / cameraDirection.x
        targetY = this.camera.position.y + t * cameraDirection.y
      }
    } else {
      // Wall plane at constant Z
      const planeZ = start.z
      if (Math.abs(cameraDirection.z) < 0.001) {
        targetY = this.camera.position.y
      } else {
        const t = (planeZ - this.camera.position.z) / cameraDirection.z
        targetY = this.camera.position.y + t * cameraDirection.y
      }
    }

    // Clamp to reasonable wall height (50 blocks)
    const maxHeight = 50
    const heightDelta = targetY - baseY
    const clampedDelta = Math.max(-maxHeight, Math.min(maxHeight, heightDelta))

    return Math.round(baseY + clampedDelta)
  }

  update() {
    // Remove last single-block highlight
    this.scene.remove(this.mesh)

    // Raycast from camera center
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera)
    const intersects = this.raycaster.intersectObjects(this.terrain.getRaycastTargets())

    // Handle wall Phase 2 (drawing height) - no raycast needed
    if (this.editMode === EditMode.Wall && this.wallPhase === 'drawing_height') {
      const targetY = this.calculateWallHeight()
      const wallPositions = calculateWallPositions(this.wallBaseLine, targetY)
      this.renderPreviewMeshes(wallPositions)
      this.block = null
      return
    }

    // Handle drag preview for Line, Floor, and Wall Phase 1
    if (this.isDragging && this.dragStart && intersects.length > 0) {
      const endPosition = this.getPlacementPosition(intersects[0])

      if (endPosition) {
        let positions: THREE.Vector3[] = []

        switch (this.editMode) {
          case EditMode.Line:
            positions = calculateLinePositions(this.dragStart, endPosition)
            break
          case EditMode.Floor:
            positions = calculateFloorPositions(this.dragStart, endPosition)
            break
          case EditMode.Wall:
            // Wall Phase 1: same as Line
            if (this.wallPhase === 'drawing_line') {
              positions = calculateLinePositions(this.dragStart, endPosition)
            }
            break
        }

        this.renderPreviewMeshes(positions)
        this.block = intersects[0]
        return
      }
    }

    // Clear preview when not dragging (except wall Phase 2)
    if (!this.isDragging || this.editMode === EditMode.Single) {
      this.clearPreviewMeshes()
    }

    // Single block highlight (default behavior)
    if (intersects.length > 0) {
      const hit = intersects[0]
      if (hit.object instanceof THREE.InstancedMesh && typeof hit.instanceId === 'number') {
        const matrix = new THREE.Matrix4()
        hit.object.getMatrixAt(hit.instanceId, matrix)
        const position = new THREE.Vector3().setFromMatrixPosition(matrix)

        this.mesh = new THREE.Mesh(this.geometry, this.material)
        this.mesh.position.copy(position)
        this.scene.add(this.mesh)
        this.block = hit
      } else {
        this.block = null
      }
    } else {
      this.block = null
    }
  }
}
