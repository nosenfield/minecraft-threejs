import * as THREE from 'three'
import Materials, { MaterialType } from './mesh/materials'
import Block from './mesh/block'
import Highlight from './highlight'
import Noise from './noise'

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
  bedrock = 11
}
export default class Terrain {
  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene
    this.camera = camera
    this.maxCount =
      (this.distance * this.chunkSize * 2 + this.chunkSize) ** 2 + 500
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
    MaterialType.bedrock
  ]

  // other properties
  blocks: THREE.InstancedMesh[] = []
  blocksCount: number[] = []
  blocksFactor = [1, 0.2, 0.1, 0.7, 0.1, 1.0, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1] // M2.4: Increased stone (index 5) factor to 1.0 to support 10,000 ground blocks

  customBlocks: Block[] = []
  // Performance: Map for O(1) block lookups by position (key: `${x}_${y}_${z}`)
  blocksMap = new Map<string, Block>()
  highlight: Highlight

  idMap = new Map<string, number>()
  generateWorker = new Generate()

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
  createGroundPlane = () => {
    const groundSize = 100
    const groundColor = BlockType.stone // Use stone type temporarily (grey-ish), will be replaced with color system in M3.1
    const markerColor = BlockType.diamond // Use diamond for yellow markers (bright/visible), will be replaced with yellow color in M3.1
    const matrix = new THREE.Matrix4()
    
    // Performance: Create InstancedMesh for yellow markers instead of individual meshes
    const yellowMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 }) // Bright yellow
    const yellowGeometry = new THREE.BoxGeometry(1, 1, 1)
    const yellowMarkerMesh = new THREE.InstancedMesh(yellowGeometry, yellowMaterial, 121) // 11x11 = 121 markers
    let yellowMarkerIndex = 0
    
    // Generate 100x100 blocks at Y=0 (X: 0-99, Z: 0-99)
    for (let x = 0; x < groundSize; x++) {
      for (let z = 0; z < groundSize; z++) {
        const position = new THREE.Vector3(x, 0, z)
        const blockKey = `${x}_0_${z}` // Key for blocksMap lookup
        // Yellow markers at grid intersections: where both x and z are multiples of 10
        const isMarker = (x % 10 === 0) && (z % 10 === 0)
        
        if (isMarker) {
          // Create bright yellow marker block using InstancedMesh
          matrix.setPosition(position)
          yellowMarkerMesh.setMatrixAt(yellowMarkerIndex++, matrix)
          
          // Add to customBlocks with isGround flag
          const block = new Block(x, 0, z, markerColor, true, true)
          this.customBlocks.push(block)
          this.blocksMap.set(blockKey, block) // Add to Map for O(1) lookup
        } else {
          // Create regular grey ground block
          const block = new Block(x, 0, z, groundColor, true, true)
          this.customBlocks.push(block)
          this.blocksMap.set(blockKey, block) // Add to Map for O(1) lookup
          
          // Render block using InstancedMesh
          matrix.setPosition(position)
          this.blocks[groundColor].setMatrixAt(this.getCount(groundColor), matrix)
          this.setCount(groundColor)
        }
      }
    }
    
    // Add yellow marker InstancedMesh to scene and update
    yellowMarkerMesh.instanceMatrix.needsUpdate = true
    this.scene.add(yellowMarkerMesh)
    
    // Update instance matrix for rendering
    this.blocks[groundColor].instanceMatrix.needsUpdate = true
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
    const block = new Block(position.x, position.y, position.z, type, true)
    this.customBlocks.push(block)
    // Performance: Update blocksMap for O(1) lookups
    this.blocksMap.set(`${position.x}_${position.y}_${position.z}`, block)

    const matrix = new THREE.Matrix4()
    matrix.setPosition(position)
    this.blocks[type].setMatrixAt(this.getCount(type), matrix)
    this.blocks[type].instanceMatrix.needsUpdate = true
    this.setCount(type)
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
