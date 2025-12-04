import * as THREE from 'three'
import Terrain from '..'

/**
 * Highlight block on crosshair
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
    this.raycaster.far = 8
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

  // block simulation
  index = 0
  instanceMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(),
    new THREE.MeshBasicMaterial(),
    1000
  )

  update() {
    // remove last highlight and reset block simulation
    this.scene.remove(this.mesh)
    this.index = 0
    this.instanceMesh.instanceMatrix = new THREE.InstancedBufferAttribute(
      new Float32Array(1000 * 16),
      16
    )

    const matrix = new THREE.Matrix4()
    const position = this.camera.position
    const raycasterRange = 8 // Only check blocks within raycaster range
    
    // Performance: Spatial partitioning - only check blocks near camera
    // M2.1: Procedural terrain generation disabled in highlight system
    // Only use actual blocks from customBlocks array within range
    const minX = Math.floor(position.x - raycasterRange)
    const maxX = Math.ceil(position.x + raycasterRange)
    const minY = Math.floor(position.y - raycasterRange)
    const maxY = Math.ceil(position.y + raycasterRange)
    const minZ = Math.floor(position.z - raycasterRange)
    const maxZ = Math.ceil(position.z + raycasterRange)
    
    // Only iterate blocks within range (spatial partitioning)
    for (const block of this.terrain.customBlocks) {
      if (
        block.placed &&
        block.x >= minX && block.x <= maxX &&
        block.y >= minY && block.y <= maxY &&
        block.z >= minZ && block.z <= maxZ
      ) {
        matrix.setPosition(block.x, block.y, block.z)
        this.instanceMesh.setMatrixAt(this.index++, matrix)
      }
    }

    // highlight new block
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera)
    this.block = this.raycaster.intersectObject(this.instanceMesh)[0]
    if (
      this.block &&
      this.block.object instanceof THREE.InstancedMesh &&
      typeof this.block.instanceId === 'number'
    ) {
      this.mesh = new THREE.Mesh(this.geometry, this.material)
      let matrix = new THREE.Matrix4()
      this.block.object.getMatrixAt(this.block.instanceId, matrix)
      const position = new THREE.Vector3().setFromMatrixPosition(matrix)

      this.mesh.position.set(position.x, position.y, position.z)
      this.scene.add(this.mesh)
    }
  }
}
