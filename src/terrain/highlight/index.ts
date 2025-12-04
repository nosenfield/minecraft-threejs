import * as THREE from 'three'
import Terrain from '..'
import { BLOCK_INTERACTION_RANGE } from '../../constants'

/**
 * Highlight block on crosshair
 * 
 * Simplified approach: Raycast directly against rendered blocks (terrain.blocks[])
 * instead of maintaining a separate instanceMesh. This ensures consistency with
 * block placement/removal and eliminates range mismatches.
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

  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  terrain: Terrain
  raycaster: THREE.Raycaster
  block: THREE.Intersection | null = null

  // highlight block mesh
  geometry = new THREE.BoxGeometry(1.01, 1.01, 1.01)
  material = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0.25
    // depthWrite: false
  })
  mesh = new THREE.Mesh(new THREE.BoxGeometry(), this.material)

  update() {
    // Remove last highlight
    this.scene.remove(this.mesh)

    // Raycast directly against rendered blocks (already in scene)
    // raycaster.far is already set in constructor to BLOCK_INTERACTION_RANGE
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera)

    // Intersect with all block InstancedMeshes (terrain.blocks[])
    // Three.js raycasters are optimized for InstancedMesh intersection with bounding box culling
    const intersects = this.raycaster.intersectObjects(this.terrain.blocks)

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
