import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls'
import Player, { Mode, Speed } from '../player'
import Terrain, { BlockType } from '../terrain'

import Block from '../terrain/mesh/block'
import Noise from '../terrain/noise'
import Audio from '../audio'
import { isMobile } from '../utils'
import { BLOCK_INTERACTION_RANGE } from '../constants'
enum Side {
  front,
  back,
  left,
  right,
  down,
  up
}

export default class Control {
  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    player: Player,
    terrain: Terrain,
    audio: Audio
  ) {
    this.scene = scene
    this.camera = camera
    this.player = player
    this.terrain = terrain
    this.control = new PointerLockControls(camera, document.body)
    this.audio = audio

    this.raycaster = new THREE.Raycaster()
    this.raycaster.far = BLOCK_INTERACTION_RANGE
    this.far = this.player.body.height

    this.initRayCaster()
    this.initEventListeners()
    
    // Initialize speed to walking speed (base speed for flying mode)
    this.player.speed = Speed.walking
  }

  // core properties
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  player: Player
  terrain: Terrain
  control: PointerLockControls
  audio: Audio
  velocity = new THREE.Vector3(0, 0, 0)

  // collide and jump properties
  frontCollide = false
  backCollide = false
  leftCollide = false
  rightCollide = false
  downCollide = true
  upCollide = false
  isJumping = false

  raycasterDown = new THREE.Raycaster()
  raycasterUp = new THREE.Raycaster()
  raycasterFront = new THREE.Raycaster()
  raycasterBack = new THREE.Raycaster()
  raycasterRight = new THREE.Raycaster()
  raycasterLeft = new THREE.Raycaster()

  tempMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial(),
    100
  )
  tempMeshMatrix = new THREE.InstancedBufferAttribute(
    new Float32Array(100 * 16),
    16
  )

  // other properties
  p1 = performance.now()
  p2 = performance.now()
  raycaster: THREE.Raycaster
  far: number

  holdingBlock = BlockType.grass
  holdingBlocks = [
    BlockType.grass,
    BlockType.stone,
    BlockType.tree,
    BlockType.wood,
    BlockType.diamond,
    BlockType.quartz,
    BlockType.glass,
    BlockType.grass,
    BlockType.grass,
    BlockType.grass
  ]
  holdingIndex = 0
  wheelGap = false
  clickInterval?: ReturnType<typeof setInterval>
  jumpInterval?: ReturnType<typeof setInterval>
  mouseHolding = false
  spaceHolding = false
  isFastMode = false

  initRayCaster = () => {
    this.raycasterUp.ray.direction = new THREE.Vector3(0, 1, 0)
    this.raycasterDown.ray.direction = new THREE.Vector3(0, -1, 0)
    this.raycasterFront.ray.direction = new THREE.Vector3(1, 0, 0)
    this.raycasterBack.ray.direction = new THREE.Vector3(-1, 0, 0)
    this.raycasterLeft.ray.direction = new THREE.Vector3(0, 0, -1)
    this.raycasterRight.ray.direction = new THREE.Vector3(0, 0, 1)

    this.raycasterUp.far = 1.2
    this.raycasterDown.far = this.player.body.height
    this.raycasterFront.far = this.player.body.width
    this.raycasterBack.far = this.player.body.width
    this.raycasterLeft.far = this.player.body.width
    this.raycasterRight.far = this.player.body.width
  }

  downKeys = {
    a: false,
    d: false,
    w: false,
    s: false
  }
  setMovementHandler = (e: KeyboardEvent) => {
    if (e.repeat) {
      return
    }

    switch (e.key) {
      case 'q':
      case 'Q':
        // Q: Move down (absolute vertical axis)
        this.velocity.y = -this.player.speed
        break
      case 'e':
      case 'E':
        // E: Move up (absolute vertical axis)
        this.velocity.y = this.player.speed
        break
      case 'w':
      case 'W':
        this.downKeys.w = true
        this.velocity.x = this.player.speed // Forward (will be applied along camera direction)
        break
      case 's':
      case 'S':
        this.downKeys.s = true
        this.velocity.x = -this.player.speed // Backward (will be applied opposite camera direction)
        break
      case 'a':
      case 'A':
        this.downKeys.a = true
        this.velocity.z = -this.player.speed
        break
      case 'd':
      case 'D':
        this.downKeys.d = true
        this.velocity.z = this.player.speed
        break
      case ' ':
        // Space: Toggle speed (walking speed <-> sprint flying speed)
        e.preventDefault() // Prevent page scroll
        this.isFastMode = !this.isFastMode
        if (this.isFastMode) {
          this.player.speed = Speed.sprintFlying
        } else {
          this.player.speed = Speed.walking
        }
        // Update current velocities to match new speed
        if (this.velocity.x !== 0) {
          this.velocity.x = this.velocity.x > 0 ? this.player.speed : -this.player.speed
        }
        if (this.velocity.z !== 0) {
          this.velocity.z = this.velocity.z > 0 ? this.player.speed : -this.player.speed
        }
        if (this.velocity.y !== 0) {
          this.velocity.y = this.velocity.y > 0 ? this.player.speed : -this.player.speed
        }
        break
      case 'Shift':
        // Shift: Move down (same as Q for consistency)
        this.velocity.y = -this.player.speed
        break
      default:
        break
    }
  }

  resetMovementHandler = (e: KeyboardEvent) => {
    if (e.repeat) {
      return
    }

    switch (e.key) {
      case 'w':
      case 'W':
        this.downKeys.w = false
        this.velocity.x = 0
        break
      case 's':
      case 'S':
        this.downKeys.s = false
        this.velocity.x = 0
        break
      case 'a':
      case 'A':
        this.downKeys.a = false
        this.velocity.z = 0
        break
      case 'd':
      case 'D':
        this.downKeys.d = false
        this.velocity.z = 0
        break
      case 'q':
      case 'Q':
        // Q: Stop vertical movement
        this.velocity.y = 0
        break
      case 'e':
      case 'E':
        // E: Stop vertical movement
        this.velocity.y = 0
        break
      case ' ':
        // Space: Toggle behavior - do nothing on keyup
        // Speed toggle is handled on keydown only for true toggle behavior
        break
      case 'Shift':
        // Shift: Stop vertical movement
        this.velocity.y = 0
        break
      default:
        break
    }
  }

  mousedownHandler = (e: MouseEvent) => {
    e.preventDefault()
    // let p1 = performance.now()
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera)
    // Get all meshes that should be included in raycaster checks
    const block = this.raycaster.intersectObjects(this.terrain.getRaycastTargets())[0]
    const matrix = new THREE.Matrix4()

    switch (e.button) {
      // left click to place block
      case 0:
        {
          if (block && block.object instanceof THREE.InstancedMesh) {
            // calculate normal and position
            const normal = block.face!.normal
            block.object.getMatrixAt(block.instanceId!, matrix)
            const position = new THREE.Vector3().setFromMatrixPosition(matrix)

            // return when block overlaps with player
            if (
              position.x + normal.x === Math.round(this.camera.position.x) &&
              position.z + normal.z === Math.round(this.camera.position.z) &&
              (position.y + normal.y === Math.round(this.camera.position.y) ||
                position.y + normal.y ===
                  Math.round(this.camera.position.y - 1))
            ) {
              return
            }

            // put the block
            matrix.setPosition(
              normal.x + position.x,
              normal.y + position.y,
              normal.z + position.z
            )
            this.terrain.blocks[this.holdingBlock].setMatrixAt(
              this.terrain.getCount(this.holdingBlock),
              matrix
            )
            this.terrain.setCount(this.holdingBlock)

            //sound effect
            this.audio.playSound(this.holdingBlock)

            // update
            this.terrain.blocks[this.holdingBlock].instanceMatrix.needsUpdate =
              true

            // add to custom blocks
            const newBlock = new Block(
              normal.x + position.x,
              normal.y + position.y,
              normal.z + position.z,
              this.holdingBlock,
              true
            )
            this.terrain.customBlocks.push(newBlock)
            // Performance: Update blocksMap for O(1) lookups
            const blockKey = `${newBlock.x}_${newBlock.y}_${newBlock.z}`
            this.terrain.blocksMap.set(blockKey, newBlock)
          }
        }
        break

      // right click to remove block
      case 2:
        {
          if (block && block.object instanceof THREE.InstancedMesh) {
            // calculate position
            block.object.getMatrixAt(block.instanceId!, matrix)
            const position = new THREE.Vector3().setFromMatrixPosition(matrix)

            // M2.5: Prevent removal of ground blocks
            // Performance: Use Map for O(1) lookup instead of linear search
            const blockKey = `${position.x}_${position.y}_${position.z}`
            const blockData = this.terrain.blocksMap.get(blockKey)
            if (blockData?.isGround === true) {
              // Ground blocks cannot be removed
              return
            }

            // remove the block
            block.object.setMatrixAt(
              block.instanceId!,
              new THREE.Matrix4().set(
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0
              )
            )

            // block and sound effect
            this.audio.playSound(
              BlockType[block.object.name as any] as unknown as BlockType
            )

            const mesh = new THREE.Mesh(
              new THREE.BoxGeometry(1, 1, 1),
              this.terrain.materials.get(
                this.terrain.materialType[
                  parseInt(BlockType[block.object.name as any])
                ]
              )
            )
            mesh.position.set(position.x, position.y, position.z)
            this.scene.add(mesh)
            const time = performance.now()
            let raf = 0
            const animate = () => {
              if (performance.now() - time > 250) {
                this.scene.remove(mesh)
                cancelAnimationFrame(raf)
                return
              }
              raf = requestAnimationFrame(animate)
              mesh.geometry.scale(0.85, 0.85, 0.85)
            }
            animate()

            // update
            block.object.instanceMatrix.needsUpdate = true

            // Performance: Use Map for O(1) lookup instead of linear search
            // Reuse blockKey from above (line 316)
            const existingBlock = this.terrain.blocksMap.get(blockKey)
            let existed = false
            if (existingBlock) {
              existed = true
              existingBlock.placed = false
            }

            // add to custom blocks when it's not existed
            if (!existed) {
              const removedBlock = new Block(
                position.x,
                position.y,
                position.z,
                BlockType[block.object.name as any] as unknown as BlockType,
                false
              )
              this.terrain.customBlocks.push(removedBlock)
              // Performance: Update blocksMap for O(1) lookups
              const blockKey = `${position.x}_${position.y}_${position.z}`
              this.terrain.blocksMap.set(blockKey, removedBlock)
            }

            // M2.1: generateAdjacentBlocks removed - no longer needed without procedural terrain
          }
        }
        break
      default:
        break
    }

    if (!isMobile && !this.mouseHolding) {
      this.mouseHolding = true
      this.clickInterval = setInterval(() => {
        this.mousedownHandler(e)
      }, 250) // Decreased hold-to-place interval to 0.25s (250ms)
    }

    // console.log(performance.now() - p1)
  }
  mouseupHandler = () => {
    this.clickInterval && clearInterval(this.clickInterval)
    this.mouseHolding = false
  }

  changeHoldingBlockHandler = (e: KeyboardEvent) => {
    if (isNaN(parseInt(e.key)) || e.key === '0') {
      return
    }
    this.holdingIndex = parseInt(e.key) - 1

    this.holdingBlock = this.holdingBlocks[this.holdingIndex] ?? BlockType.grass
  }

  wheelHandler = (e: WheelEvent) => {
    if (!this.wheelGap) {
      this.wheelGap = true
      setTimeout(() => {
        this.wheelGap = false
      }, 100)
      if (e.deltaY > 0) {
        this.holdingIndex++
        this.holdingIndex > 9 && (this.holdingIndex = 0)
      } else if (e.deltaY < 0) {
        this.holdingIndex--
        this.holdingIndex < 0 && (this.holdingIndex = 9)
      }
      this.holdingBlock =
        this.holdingBlocks[this.holdingIndex] ?? BlockType.grass
    }
  }

  initEventListeners = () => {
    // add / remove handler when pointer lock / unlock
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement) {
        document.body.addEventListener(
          'keydown',
          this.changeHoldingBlockHandler
        )
        document.body.addEventListener('wheel', this.wheelHandler)
        document.body.addEventListener('keydown', this.setMovementHandler)
        document.body.addEventListener('keyup', this.resetMovementHandler)
        document.body.addEventListener('mousedown', this.mousedownHandler)
        document.body.addEventListener('mouseup', this.mouseupHandler)
      } else {
        document.body.removeEventListener(
          'keydown',
          this.changeHoldingBlockHandler
        )
        document.body.removeEventListener('wheel', this.wheelHandler)
        document.body.removeEventListener('keydown', this.setMovementHandler)
        document.body.removeEventListener('keyup', this.resetMovementHandler)
        document.body.removeEventListener('mousedown', this.mousedownHandler)
        document.body.removeEventListener('mouseup', this.mouseupHandler)
        this.velocity = new THREE.Vector3(0, 0, 0)
      }
    })
  }

  // move along X with direction factor
  moveX(distance: number, delta: number) {
    this.camera.position.x +=
      distance * (this.player.speed / Math.PI) * 2 * delta
  }

  // move along Z with direction factor
  moveZ = (distance: number, delta: number) => {
    this.camera.position.z +=
      distance * (this.player.speed / Math.PI) * 2 * delta
  }

  // Get camera's forward direction vector (including pitch/vertical angle)
  getCameraForwardVector(): THREE.Vector3 {
    const direction = new THREE.Vector3()
    this.camera.getWorldDirection(direction)
    return direction
  }

  // collide checking
  collideCheckAll = (
    position: THREE.Vector3,
    noise: Noise,
    customBlocks: Block[],
    far: number
  ) => {
    this.collideCheck(Side.down, position, noise, customBlocks, far)
    this.collideCheck(Side.front, position, noise, customBlocks)
    this.collideCheck(Side.back, position, noise, customBlocks)
    this.collideCheck(Side.left, position, noise, customBlocks)
    this.collideCheck(Side.right, position, noise, customBlocks)
    this.collideCheck(Side.up, position, noise, customBlocks)
  }

  collideCheck = (
    side: Side,
    position: THREE.Vector3,
    noise: Noise,
    customBlocks: Block[],
    far: number = this.player.body.width
  ) => {
    const matrix = new THREE.Matrix4()

    //reset simulation blocks
    let index = 0
    this.tempMesh.instanceMatrix = new THREE.InstancedBufferAttribute(
      new Float32Array(100 * 16),
      16
    )

    // block to remove
    let removed = false
    let treeRemoved = new Array<boolean>(
      this.terrain.noise.treeHeight + 1
    ).fill(false)

    // get block position
    let x = Math.round(position.x)
    let z = Math.round(position.z)

    switch (side) {
      case Side.front:
        x++
        this.raycasterFront.ray.origin = position
        break
      case Side.back:
        x--
        this.raycasterBack.ray.origin = position
        break
      case Side.left:
        z--
        this.raycasterLeft.ray.origin = position
        break
      case Side.right:
        z++
        this.raycasterRight.ray.origin = position
        break
      case Side.down:
        this.raycasterDown.ray.origin = position
        this.raycasterDown.far = far
        break
      case Side.up:
        this.raycasterUp.ray.origin = new THREE.Vector3().copy(position)
        this.raycasterUp.ray.origin.y--
        break
    }

    let y =
      Math.floor(
        noise.get(x / noise.gap, z / noise.gap, noise.seed) * noise.amp
      ) + 30

    // check custom blocks
    for (const block of customBlocks) {
      if (block.x === x && block.z === z) {
        if (block.placed) {
          // placed blocks
          matrix.setPosition(block.x, block.y, block.z)
          this.tempMesh.setMatrixAt(index++, matrix)
        } else if (block.y === y) {
          // removed blocks
          removed = true
        } else {
          for (let i = 1; i <= this.terrain.noise.treeHeight; i++) {
            if (block.y === y + i) {
              treeRemoved[i] = true
            }
          }
        }
      }
    }

    // update simulation blocks (ignore removed blocks)
    if (!removed) {
      matrix.setPosition(x, y, z)
      this.tempMesh.setMatrixAt(index++, matrix)
    }
    for (let i = 1; i <= this.terrain.noise.treeHeight; i++) {
      if (!treeRemoved[i]) {
        let treeOffset =
          noise.get(x / noise.treeGap, z / noise.treeGap, noise.treeSeed) *
          noise.treeAmp

        let stoneOffset =
          noise.get(x / noise.stoneGap, z / noise.stoneGap, noise.stoneSeed) *
          noise.stoneAmp

        if (
          treeOffset > noise.treeThreshold &&
          y >= 27 &&
          stoneOffset < noise.stoneThreshold
        ) {
          matrix.setPosition(x, y + i, z)
          this.tempMesh.setMatrixAt(index++, matrix)
        }
      }
    }

    // sneaking check
    if (
      this.player.mode === Mode.sneaking &&
      y < Math.floor(this.camera.position.y - 2) &&
      side !== Side.down &&
      side !== Side.up
    ) {
      matrix.setPosition(x, Math.floor(this.camera.position.y - 1), z)
      this.tempMesh.setMatrixAt(index++, matrix)
    }
    this.tempMesh.instanceMatrix.needsUpdate = true

    // update collide
    const origin = new THREE.Vector3(position.x, position.y - 1, position.z)
    switch (side) {
      case Side.front: {
        const c1 = this.raycasterFront.intersectObject(this.tempMesh).length
        this.raycasterFront.ray.origin = origin
        const c2 = this.raycasterFront.intersectObject(this.tempMesh).length
        c1 || c2 ? (this.frontCollide = true) : (this.frontCollide = false)

        break
      }
      case Side.back: {
        const c1 = this.raycasterBack.intersectObject(this.tempMesh).length
        this.raycasterBack.ray.origin = origin
        const c2 = this.raycasterBack.intersectObject(this.tempMesh).length
        c1 || c2 ? (this.backCollide = true) : (this.backCollide = false)
        break
      }
      case Side.left: {
        const c1 = this.raycasterLeft.intersectObject(this.tempMesh).length
        this.raycasterLeft.ray.origin = origin
        const c2 = this.raycasterLeft.intersectObject(this.tempMesh).length
        c1 || c2 ? (this.leftCollide = true) : (this.leftCollide = false)
        break
      }
      case Side.right: {
        const c1 = this.raycasterRight.intersectObject(this.tempMesh).length
        this.raycasterRight.ray.origin = origin
        const c2 = this.raycasterRight.intersectObject(this.tempMesh).length
        c1 || c2 ? (this.rightCollide = true) : (this.rightCollide = false)
        break
      }
      case Side.down: {
        const c1 = this.raycasterDown.intersectObject(this.tempMesh).length
        c1 ? (this.downCollide = true) : (this.downCollide = false)
        break
      }
      case Side.up: {
        const c1 = this.raycasterUp.intersectObject(this.tempMesh).length
        c1 ? (this.upCollide = true) : (this.upCollide = false)
        break
      }
    }
  }

  update = () => {
    this.p1 = performance.now()
    const delta = (this.p1 - this.p2) / 1000
    
    // Always in flying mode (physics and collisions removed)
    // Forward/backward movement along camera direction (including vertical component)
    if (this.velocity.x !== 0) {
      const forwardVector = this.getCameraForwardVector()
      const movementDistance = this.velocity.x * delta
      this.camera.position.addScaledVector(forwardVector, movementDistance)
    }
    
    // Strafe left/right (horizontal only, camera-relative)
    if (this.velocity.z !== 0) {
      this.control.moveRight(this.velocity.z * delta)
    }
    
    // Vertical movement (absolute Y axis)
    if (this.velocity.y !== 0) {
      this.camera.position.y += this.velocity.y * delta
    }
    
    // Legacy collision code removed - always in flying mode
    // All collision checking and physics removed (M1.2)
    
    // Safety net: prevent falling too far below ground
    if (this.camera.position.y < -100) {
      this.camera.position.y = 60
    }
    this.p2 = this.p1
  }
}
