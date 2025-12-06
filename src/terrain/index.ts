import * as THREE from 'three'
import Materials, { MaterialType } from './mesh/materials'
import Block from './mesh/block'
import Highlight from './highlight'
import Noise from './noise'
import { blockTypeToHex } from '../utils'

import Generate from './worker/generate?worker'

export enum BlockType {
  grass = 0,
  sand = 1,
  tree = 2,
  leaf = 3,
  dirt = 4,
  stone = 5,
  coal = 6,
  wood = 7,
  diamond = 8,
  quartz = 9,
  glass = 10,
  bedrock = 11,
  // M3.1: New color-based block types (removed indigo, moved violet to slot 6, added brown to slot 7)
  red = 12,
  orange = 13,
  yellow = 14,
  green = 15,
  blue = 16,
  violet = 17,
  brown = 18,
  white = 19,
  gray = 20,
  black = 21
}
export default class Terrain {
  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene
    this.camera = camera
    // M3.3 Performance: Reduced maxCount since procedural generation is disabled
    // Original: (distance * chunkSize * 2 + chunkSize) ** 2 + 500 = ~28,724
    // New: MAX_USER_BLOCKS (10,000) + buffer for ground plane (10,000) = 20,000
    // This significantly reduces memory allocation for InstancedMesh instances
    this.maxCount = 20000
    this.highlight = new Highlight(scene, camera, this)
    this.scene.add(this.cloud)

    // generate worker callback handler
    this.generateWorker.onmessage = (
      msg: MessageEvent<{
        idMap: Map<string, number>
        arrays: ArrayLike<number>[]
        blocksCount: number[]
      }>
    ) => {
      this.resetBlocks()
      this.idMap = msg.data.idMap
      this.blocksCount = msg.data.blocksCount

      for (let i = 0; i < msg.data.arrays.length; i++) {
        this.blocks[i].instanceMatrix = new THREE.InstancedBufferAttribute(
          (this.blocks[i].instanceMatrix.array = msg.data.arrays[i]),
          16
        )
      }

      for (const block of this.blocks) {
        block.instanceMatrix.needsUpdate = true
      }
    }
  }
  // core properties
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  distance = 3
  chunkSize = 24

  // terrain properties
  maxCount: number
  chunk = new THREE.Vector2(0, 0)
  previousChunk = new THREE.Vector2(0, 0)
  noise = new Noise()

  // materials
  materials = new Materials()
  materialType = [
    MaterialType.grass,
    MaterialType.sand,
    MaterialType.tree,
    MaterialType.leaf,
    MaterialType.dirt,
    MaterialType.stone,
    MaterialType.coal,
    MaterialType.wood,
    MaterialType.diamond,
    MaterialType.quartz,
    MaterialType.glass,
    MaterialType.bedrock,
    // M3.3: New color material types (removed indigo, moved violet to slot 6, added brown to slot 7)
    MaterialType.red,
    MaterialType.orange,
    MaterialType.yellow,
    MaterialType.green,
    MaterialType.blue,
    MaterialType.violet,
    MaterialType.brown,
    MaterialType.white,
    MaterialType.gray,
    MaterialType.black
  ]

  // other properties
  blocks: THREE.InstancedMesh[] = []
  blocksCount: number[] = []
  // Performance: Cached counter for user-placed blocks (excludes ground blocks)
  // Incremented/decremented on place/remove instead of filtering array every time
  userPlacedBlockCount = 0
  // M3.3 Performance: Texture blocks (indices 0-11) set to 0 since they're not used
  // Color types (indices 12-21) use 0.5 factor (10,000 max instances each)
  blocksFactor = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] // 12 texture blocks (unused) + 10 color types

  customBlocks: Block[] = []
  // Performance: Map for O(1) block lookups by position (key: `${x}_${y}_${z}`)
  blocksMap = new Map<string, Block>()
  highlight: Highlight

  idMap = new Map<string, number>()
  generateWorker = new Generate()

  // Additional meshes that need to be included in raycaster checks
  // (e.g., yellow marker mesh, future special block types)
  additionalRaycastMeshes: THREE.InstancedMesh[] = []

  // cloud
  cloud = new THREE.InstancedMesh(
    new THREE.BoxGeometry(20, 5, 14),
    new THREE.MeshStandardMaterial({
      transparent: true,
      color: 0xffffff,
      opacity: 0.4
    }),
    1000
  )
  cloudCount = 0
  cloudGap = 5

  getCount = (type: BlockType) => {
    return this.blocksCount[type]
  }

  setCount = (type: BlockType) => {
    this.blocksCount[type] = this.blocksCount[type] + 1
  }

  initBlocks = () => {
    // reset
    for (const block of this.blocks) {
      this.scene.remove(block)
    }
    this.blocks = []

    // create instance meshes
    const geometry = new THREE.BoxGeometry()

    for (let i = 0; i < this.materialType.length; i++) {
      let block = new THREE.InstancedMesh(
        geometry,
        this.materials.get(this.materialType[i]),
        this.maxCount * this.blocksFactor[i]
      )
      block.name = BlockType[i]
      this.blocks.push(block)
      this.scene.add(block)
    }

    this.blocksCount = new Array(this.materialType.length).fill(0)
    
    // M2.4: Create ground plane after initializing blocks
    this.createGroundPlane()
  }
  
  // M2.4: Create 100x100 grey ground plane at Y=0 with yellow marker blocks
  // M3.3: Updated to use gray and yellow color block types
  // Ground plane centered at (0, 0, 0) - spans X: -50 to 49, Z: -50 to 49
  createGroundPlane = () => {
    const groundSize = 100
    const groundColor = BlockType.gray // M3.3: Use gray color block type
    const markerColor = BlockType.yellow // M3.3: Use yellow color block type
    const matrix = new THREE.Matrix4()
    const offset = -groundSize / 2 // -50 to center the plane
    
    // M3.3: Yellow markers now use the yellow BlockType InstancedMesh (no separate mesh needed)
    // We'll render yellow markers using the blocks[yellow] InstancedMesh
    
    // Generate 100x100 blocks at Y=-0.5, centered at (0, 0, 0) (X: -50 to 49, Z: -50 to 49)
    // Top surface of ground plane is at Y=0
    const groundY = -0.5
    for (let x = 0; x < groundSize; x++) {
      for (let z = 0; z < groundSize; z++) {
        const worldX = x + offset // -50 to 49
        const worldZ = z + offset // -50 to 49
        const position = new THREE.Vector3(worldX, groundY, worldZ)
        const blockKey = `${worldX}_${groundY}_${worldZ}` // Key for blocksMap lookup
        // Yellow markers at grid intersections: where both x and z are multiples of 10
        const isMarker = (x % 10 === 0) && (z % 10 === 0)
        const blockColor = isMarker ? markerColor : groundColor
        
        // Create block with isGround flag (top surface at Y=0)
        const block = new Block(worldX, groundY, worldZ, blockColor, true, blockTypeToHex(blockColor), true)
        this.customBlocks.push(block)
        this.blocksMap.set(blockKey, block) // Add to Map for O(1) lookup
        
        // Render block using InstancedMesh
        matrix.setPosition(position)
        this.blocks[blockColor].setMatrixAt(this.getCount(blockColor), matrix)
        this.setCount(blockColor)
      }
    }
    
    // M3.3: Update instance matrices for both gray and yellow blocks
    this.blocks[groundColor].instanceMatrix.needsUpdate = true
    this.blocks[markerColor].instanceMatrix.needsUpdate = true
  }

  /**
   * Get all meshes that should be included in raycaster checks
   * Includes regular blocks array plus any additional special meshes (e.g., yellow markers)
   */
  getRaycastTargets(): THREE.InstancedMesh[] {
    return [...this.blocks, ...this.additionalRaycastMeshes]
  }

  resetBlocks = () => {
    // reest count and instance matrix
    for (let i = 0; i < this.blocks.length; i++) {
      this.blocks[i].instanceMatrix = new THREE.InstancedBufferAttribute(
        new Float32Array(this.maxCount * this.blocksFactor[i] * 16),
        16
      )
    }
  }

  generate = () => {
    // M2.1: Procedural terrain generation disabled
    // M2.2: Cloud generation disabled
    // This method is now a no-op to prevent errors from UI calls
    return
  }

  // generate adjacent blocks after removing a block (vertical infinity world)
  generateAdjacentBlocks = (position: THREE.Vector3) => {
    const { x, y, z } = position
    const noise = this.noise
    const yOffset = Math.floor(
      noise.get(x / noise.gap, z / noise.gap, noise.seed) * noise.amp
    )

    if (y > 30 + yOffset) {
      return
    }

    const stoneOffset =
      noise.get(x / noise.stoneGap, z / noise.stoneGap, noise.stoneSeed) *
      noise.stoneAmp

    let type: BlockType

    if (stoneOffset > noise.stoneThreshold || y < 23) {
      type = BlockType.stone
    } else {
      if (yOffset < -3) {
        type = BlockType.sand
      } else {
        type = BlockType.dirt
      }
    }

    this.buildBlock(new THREE.Vector3(x, y - 1, z), type)
    this.buildBlock(new THREE.Vector3(x, y + 1, z), type)
    this.buildBlock(new THREE.Vector3(x - 1, y, z), type)
    this.buildBlock(new THREE.Vector3(x + 1, y, z), type)
    this.buildBlock(new THREE.Vector3(x, y, z - 1), type)
    this.buildBlock(new THREE.Vector3(x, y, z + 1), type)

    this.blocks[type].instanceMatrix.needsUpdate = true
  }

  buildBlock = (position: THREE.Vector3, type: BlockType) => {
    const noise = this.noise
    // check if it's natural terrain
    const yOffset = Math.floor(
      noise.get(position.x / noise.gap, position.z / noise.gap, noise.seed) *
        noise.amp
    )
    if (position.y >= 30 + yOffset || position.y < 0) {
      return
    }

    position.y === 0 && (type = BlockType.bedrock)

    // check custom blocks
    for (const block of this.customBlocks) {
      if (
        block.x === position.x &&
        block.y === position.y &&
        block.z === position.z
      ) {
        return
      }
    }

    // build block
    const block = new Block(position.x, position.y, position.z, type, true, blockTypeToHex(type))
    this.customBlocks.push(block)
    // Performance: Update blocksMap for O(1) lookups
    this.blocksMap.set(`${position.x}_${position.y}_${position.z}`, block)

    const matrix = new THREE.Matrix4()
    matrix.setPosition(position)
    this.blocks[type].setMatrixAt(this.getCount(type), matrix)
    this.blocks[type].instanceMatrix.needsUpdate = true
    this.setCount(type)
  }

  /**
   * Render all custom blocks to InstancedMesh instances
   * Used when loading a saved game
   */
  renderCustomBlocks = () => {
    const matrix = new THREE.Matrix4()
    
    // Reset blocksMap and counters (but keep blocksCount array structure)
    this.blocksMap.clear()
    this.userPlacedBlockCount = 0
    // Reset block counts for all types
    this.blocksCount = new Array(this.materialType.length).fill(0)
    
    // Render all custom blocks
    for (const block of this.customBlocks) {
      const blockKey = `${block.x}_${block.y}_${block.z}`
      
      // Add to blocksMap for O(1) lookups
      this.blocksMap.set(blockKey, block)
      
      // Only render placed blocks (skip removed blocks where placed === false)
      if (block.placed) {
        const position = new THREE.Vector3(block.x, block.y, block.z)
        matrix.setPosition(position)
        
        // Render to appropriate InstancedMesh
        const blockType = block.type
        const count = this.getCount(blockType)
        this.blocks[blockType].setMatrixAt(count, matrix)
        this.setCount(blockType)
        
        // Update user-placed block counter (exclude ground blocks)
        if (block.isGround !== true) {
          this.userPlacedBlockCount++
        }
      }
    }
    
    // Update all instance matrices
    for (const blockMesh of this.blocks) {
      blockMesh.instanceMatrix.needsUpdate = true
    }
  }

  /**
   * M3.7: Get count of user-placed blocks (excludes ground blocks)
   * Performance: Uses cached counter instead of filtering array (O(1) instead of O(n))
   * @returns Number of blocks where placed === true AND isGround !== true
   */
  getUserPlacedBlockCount = (): number => {
    return this.userPlacedBlockCount
  }

  /**
   * Increment user-placed block count (called when placing non-ground blocks)
   */
  incrementUserPlacedCount = () => {
    this.userPlacedBlockCount++
  }

  /**
   * Decrement user-placed block count (called when removing non-ground blocks)
   */
  decrementUserPlacedCount = () => {
    if (this.userPlacedBlockCount > 0) {
      this.userPlacedBlockCount--
    }
  }

  update = () => {
    // M2.1: Chunk-based terrain generation disabled
    // Chunk tracking kept for potential future use but generation skipped
    this.chunk.set(
      Math.floor(this.camera.position.x / this.chunkSize),
      Math.floor(this.camera.position.z / this.chunkSize)
    )

    // Terrain generation on chunk change disabled (M2.1)
    // if (
    //   this.chunk.x !== this.previousChunk.x ||
    //   this.chunk.y !== this.previousChunk.y
    // ) {
    //   this.generate()
    // }

    this.previousChunk.copy(this.chunk)

    this.highlight.update()
  }
}
