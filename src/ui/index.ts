import FPS from './fps'
import Bag from './bag'
import Terrain from '../terrain'
import Block from '../terrain/mesh/block'
import Control from '../control'
import { Mode } from '../player'
// Joystick import removed - mobile controls not needed for MVP
// import Joystick from './joystick'
import { isMobile, blockTypeToHex } from '../utils'
import { captureThumbnail } from '../utils/thumbnail'
import * as THREE from 'three'
import { serializeToSpaceJSON } from '../export'
import { listLevels, createLevel, getLevel, updateLevel, getMaxLevels } from '../firebase/levels'
import type { LevelSummary, CameraState } from '../firebase/types'
import { BlockType } from '../terrain'
import {
  COLOR_RED,
  COLOR_ORANGE,
  COLOR_YELLOW,
  COLOR_GREEN,
  COLOR_BLUE,
  COLOR_VIOLET,
  COLOR_BROWN,
  COLOR_WHITE,
  COLOR_GRAY,
  COLOR_BLACK,
} from '../constants'

// Helper function to map hex color to BlockType
function hexToBlockType(hex: string): BlockType {
  const colorMap: Record<string, BlockType> = {
    [COLOR_RED]: BlockType.red,
    [COLOR_ORANGE]: BlockType.orange,
    [COLOR_YELLOW]: BlockType.yellow,
    [COLOR_GREEN]: BlockType.green,
    [COLOR_BLUE]: BlockType.blue,
    [COLOR_VIOLET]: BlockType.violet,
    [COLOR_BROWN]: BlockType.brown,
    [COLOR_WHITE]: BlockType.white,
    [COLOR_GRAY]: BlockType.gray,
    [COLOR_BLACK]: BlockType.black,
  }
  return colorMap[hex] ?? BlockType.gray // Default fallback
}

export default class UI {
  constructor(terrain: Terrain, control: Control, renderer: THREE.WebGLRenderer) {
    this.terrain = terrain
    this.control = control
    this.renderer = renderer
    this.fps = new FPS()
    this.bag = new Bag()
    // Joystick removed - mobile controls not needed for MVP
    // this.joystick = new Joystick(control)

    // Create block counter element right after FPS element
    this.blockCounter = document.createElement('div')
    this.blockCounter.id = 'block-counter'
    this.blockCounter.className = 'block-counter'
    this.blockCounter.textContent = '0 / 10,000'
    // Insert block counter right after FPS element
    this.fps.fps.insertAdjacentElement('afterend', this.blockCounter)

    this.crossHair.className = 'cross-hair'
    this.crossHair.innerHTML = '+'
    document.body.appendChild(this.crossHair)

    // play
    this.play?.addEventListener('click', () => {
      if (this.play?.innerHTML === 'Play') {
        this.onPlay()

        // reset game
        terrain.noise.seed = Math.random()
        terrain.noise.stoneSeed = Math.random()
        terrain.noise.treeSeed = Math.random()
        terrain.noise.coalSeed = Math.random()
        terrain.noise.leafSeed = Math.random()
        terrain.customBlocks = []
        terrain.initBlocks()
        terrain.generate()
        // Reset camera to initial position (40, 5, 40) looking at (0, 0, 0)
        terrain.camera.position.set(10, 5, 10)
        terrain.camera.lookAt(0, 0, 0)
        control.player.setMode(Mode.walking)
      }
      !isMobile && control.control.lock()
    })

    // Load Game button handler
    this.save?.addEventListener('click', () => {
      // Load Game button clicked - only load if button is enabled
      if (this.save && !this.save.disabled && this.save.innerHTML === 'Load Game') {
        // load game
        terrain.noise.seed =
          Number(window.localStorage.getItem('seed')) ?? Math.random()

        const customBlocks =
          (JSON.parse(
            window.localStorage.getItem('block') || 'null'
          ) as Block[]) ?? []

        // Initialize blocks (creates InstancedMesh instances)
        // Note: This will create a new ground plane, but we'll replace customBlocks with loaded data
        terrain.initBlocks()
        
        // Backward compatibility - ensure all loaded blocks have color property
        // If color is missing (old saves), derive it from BlockType
        for (const block of customBlocks) {
          if (!block.color && block.type !== undefined) {
            block.color = blockTypeToHex(block.type)
          }
          // Ensure isGround is boolean (old saves might have undefined)
          if (block.isGround === undefined) {
            block.isGround = false
          }
        }
        
        // Load custom blocks (this includes the ground plane if it was saved)
        terrain.customBlocks = customBlocks
        
        // Rebuild blocksMap and render all loaded blocks to InstancedMesh instances
        terrain.renderCustomBlocks()

        // Load camera state (position and quaternion for view restoration)
        const cameraData =
          (JSON.parse(window.localStorage.getItem('camera') || 'null') as {
            position: { x: number; y: number; z: number }
            quaternion: { x: number; y: number; z: number; w: number }
          }) ?? null

        // Fallback to legacy 'position' for backward compatibility
        const legacyPosition =
          (JSON.parse(window.localStorage.getItem('position') || 'null') as {
            x: number
            y: number
            z: number
          }) ?? null

        if (cameraData) {
          // Restore position and quaternion (complete view restoration)
          terrain.camera.position.set(
            cameraData.position.x,
            cameraData.position.y,
            cameraData.position.z
          )
          terrain.camera.quaternion.set(
            cameraData.quaternion.x,
            cameraData.quaternion.y,
            cameraData.quaternion.z,
            cameraData.quaternion.w
          )
        } else if (legacyPosition) {
          // Legacy save - only restore position, use default lookAt
          terrain.camera.position.set(
            legacyPosition.x,
            legacyPosition.y,
            legacyPosition.z
          )
          terrain.camera.lookAt(0, 0, 0) // Default lookAt for legacy saves (ground plane centered at origin)
        }

        // ui update
        this.onPlay()
        this.onLoad()
        !isMobile && control.control.lock()
      }
    })

    // Export button handler
    this.export?.addEventListener('click', async () => {
      await this.handleExport()
    })

    // Error message close button
    this.errorClose?.addEventListener('click', () => {
      this.hideErrorMessage()
    })

    // controls
    this.controls?.addEventListener('click', () => {
      this.controlsModal?.classList.remove('hidden')
    })
    this.back?.addEventListener('click', () => {
      this.controlsModal?.classList.add('hidden')
    })

    // setting
    this.setting?.addEventListener('click', () => {
      this.settings?.classList.remove('hidden')
    })
    this.settingBack?.addEventListener('click', () => {
      this.settings?.classList.add('hidden')
    })

    // render distance
    this.distanceInput?.addEventListener('input', (e: Event) => {
      if (this.distance && e.target instanceof HTMLInputElement) {
        this.distance.innerHTML = `Render Distance: ${e.target.value}`
      }
    })

    // fov
    this.fovInput?.addEventListener('input', (e: Event) => {
      if (this.fov && e.target instanceof HTMLInputElement) {
        this.fov.innerHTML = `Field of View: ${e.target.value}`
        control.camera.fov = parseInt(e.target.value)
        control.camera.updateProjectionMatrix()
      }
    })

    // music
    this.musicInput?.addEventListener('input', (e: Event) => {
      if (this.fov && e.target instanceof HTMLInputElement) {
        const disabled = e.target.value === '0'
        control.audio.disabled = disabled
        this.music!.innerHTML = `Music: ${disabled ? 'Off' : 'On'}`
      }
    })

    // apply settings
    this.settingBack?.addEventListener('click', () => {
      if (this.distanceInput instanceof HTMLInputElement) {
        terrain.distance = parseInt(this.distanceInput.value)
        terrain.maxCount =
          (terrain.distance * terrain.chunkSize * 2 + terrain.chunkSize) ** 2 +
          500

        terrain.initBlocks()
        terrain.generate()
        // Fog removed - no longer setting fog in settings
        // terrain.scene.fog = new THREE.Fog(
        //   0x87ceeb,
        //   1,
        //   terrain.distance * 24 + 24
        // )
      }
    })

    // menu and fullscreen
    document.body.addEventListener('keydown', (e: KeyboardEvent) => {
      // E key removed - now used for upward movement in controls
      // Menu can be accessed via Escape key or clicking outside pointer lock

      // fullscreen
      if (e.key === 'f') {
        if (document.fullscreenElement) {
          document.exitFullscreen()
        } else {
          document.body.requestFullscreen()
        }
      }
    })

    // exit
    this.exit?.addEventListener('click', () => {
      this.onExit()
    })

    // play / pause handler
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement) {
        this.onPlay()
      } else {
        this.onPause()
      }
    })

    // disable context menu
    document.addEventListener('contextmenu', e => {
      e.preventDefault()
    })

    // fallback lock handler
    document.querySelector('canvas')?.addEventListener('click', (e: Event) => {
      e.preventDefault()
      !isMobile && control.control.lock()
    })

    // Auto-save on page unload
    window.addEventListener('beforeunload', () => {
      if (this.currentLevelId) {
        // Attempt sync save (may not complete)
        this.saveCurrentLevel()
      }
    })
  }

  // Level selection initialization (call after auth init)
  async initLevelSelection() {
    // Load saved levels
    await this.refreshLevelsList()

    // New Level click
    this.newLevelCard?.addEventListener('click', () => {
      this.showLevelNameModal()
    })

    // Modal handlers
    this.levelNameCancel?.addEventListener('click', () => {
      this.hideLevelNameModal()
    })

    this.levelNameConfirm?.addEventListener('click', () => {
      this.handleCreateLevel()
    })

    this.levelNameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleCreateLevel()
      } else if (e.key === 'Escape') {
        this.hideLevelNameModal()
      }
    })
  }

  async refreshLevelsList() {
    this.isLoadingLevels = true
    this.levelsLoading?.classList.remove('hidden')

    try {
      this.levels = await listLevels()
      this.renderLevelsRow()
      this.updateNextLevelNumber()
    } catch (error) {
      console.error('Failed to load levels:', error)
      this.showError('Failed to load levels')
    } finally {
      this.isLoadingLevels = false
      this.levelsLoading?.classList.add('hidden')
    }
  }

  renderLevelsRow() {
    if (!this.levelsRow) return
    this.levelsRow.innerHTML = ''

    for (const level of this.levels) {
      const card = document.createElement('div')
      card.className = 'level-card'
      
      // Create thumbnail container
      const thumbnail = document.createElement('div')
      thumbnail.className = 'level-thumbnail'
      
      if (level.thumbnail) {
        const img = document.createElement('img')
        img.src = level.thumbnail
        img.alt = level.name // Safe: img.alt automatically escapes
        thumbnail.appendChild(img)
      } else {
        const span = document.createElement('span')
        span.textContent = level.name.charAt(0).toUpperCase() // Safe: textContent escapes
        thumbnail.appendChild(span)
      }
      
      // Create level name element
      const nameSpan = document.createElement('span')
      nameSpan.className = 'level-name'
      nameSpan.textContent = level.name // Safe: textContent escapes HTML
      
      card.appendChild(thumbnail)
      card.appendChild(nameSpan)
      card.addEventListener('click', () => this.handleLoadLevel(level.id))
      this.levelsRow.appendChild(card)
    }
  }

  updateNextLevelNumber() {
    // Find highest "Untitled Level N" number
    let maxNum = 0
    for (const level of this.levels) {
      const match = level.name.match(/^Untitled Level (\d+)$/)
      if (match) {
        maxNum = Math.max(maxNum, parseInt(match[1]))
      }
    }
    this.nextLevelNumber = maxNum + 1
  }

  showLevelNameModal() {
    if (this.levels.length >= getMaxLevels()) {
      this.showError(`Maximum ${getMaxLevels()} levels allowed. Delete a level to create a new one.`)
      return
    }

    if (this.levelNameInput) {
      this.levelNameInput.value = `Untitled Level ${this.nextLevelNumber}`
      this.levelNameInput.select()
    }
    this.levelNameModal?.classList.remove('hidden')
    this.levelNameInput?.focus()
  }

  hideLevelNameModal() {
    this.levelNameModal?.classList.add('hidden')
  }

  async handleCreateLevel() {
    const name = this.levelNameInput?.value.trim() || `Untitled Level ${this.nextLevelNumber}`
    this.hideLevelNameModal()

    try {
      // Reset terrain for new level
      const newSeed = Math.random()
      this.terrain.noise.seed = newSeed
      this.terrain.customBlocks = []
      this.terrain.initBlocks()
      this.terrain.generate()

      // Create level in Firestore
      const level = await createLevel({
        name,
        blocks: [],
        seed: newSeed,
      })

      this.currentLevelId = level.id
      this.levels.unshift({
        id: level.id,
        name,
        thumbnail: null,
        updatedAt: new Date()
      })
      this.updateNextLevelNumber()
      this.renderLevelsRow()

      this.onPlay()
      !isMobile && this.control.control.lock()
    } catch (error) {
      console.error('Failed to create level:', error)
      this.showError(error instanceof Error ? error.message : 'Failed to create level')
    }
  }

  async handleLoadLevel(levelId: string) {
    try {
      const level = await getLevel(levelId)
      if (!level) {
        this.showError('Level not found')
        return
      }

      // Apply level data to terrain
      this.terrain.noise.seed = level.seed
      this.terrain.initBlocks()

      // Convert blocks to internal format
      const blocks = level.blocks.map(b => {
        const blockType = hexToBlockType(b.color)
        return new Block(
          b.x,
          b.y,
          b.z,
          blockType,
          true,
          b.color,
          false
        )
      })

      this.terrain.customBlocks = blocks
      this.terrain.renderCustomBlocks()

      // Restore camera
      if (level.camera) {
        this.terrain.camera.position.set(
          level.camera.position.x,
          level.camera.position.y,
          level.camera.position.z
        )
        this.terrain.camera.quaternion.set(
          level.camera.quaternion.x,
          level.camera.quaternion.y,
          level.camera.quaternion.z,
          level.camera.quaternion.w
        )
      }

      this.currentLevelId = levelId
      this.onPlay()
      !isMobile && this.control.control.lock()
    } catch (error) {
      console.error('Failed to load level:', error)
      this.showError('Failed to load level')
    }
  }

  showError(message: string) {
    if (!this.errorToast) return

    this.errorToast.textContent = message
    this.errorToast.classList.remove('hidden')

    setTimeout(() => {
      this.errorToast?.classList.add('hidden')
    }, 4000)
  }

  terrain: Terrain
  control: Control
  renderer: THREE.WebGLRenderer
  fps: FPS
  bag: Bag
  // Joystick removed - mobile controls not needed for MVP
  // joystick: Joystick

  menu = document.querySelector('.menu')
  crossHair = document.createElement('div')

  // buttons
  play = document.querySelector('#play')
  control = document.querySelector('#control')
  setting = document.querySelector('#setting')
  controls = document.querySelector('#controls')
  back = document.querySelector('#back')
  exit = document.querySelector('#exit')
  export = document.querySelector('#export')
  // Save/load button preserved for production (hidden in MVP)
  save = document.querySelector('#save')

  // modals
  // Save/load modals preserved for production (hidden in MVP)
  saveModal = document.querySelector('.save-modal')
  loadModal = document.querySelector('.load-modal')
  settings = document.querySelector('.settings')
  controlsModal = document.querySelector('.controls')
  
  // Export UI components
  loadingOverlay = document.querySelector('.loading-overlay')
  errorMessage = document.querySelector('.error-message')
  errorText = document.querySelector('.error-text')
  errorClose = document.querySelector('#error-close')
  
  // Block counter element (created dynamically after FPS)
  blockCounter: HTMLDivElement

  // Auto-save timer
  autoSaveTimer: ReturnType<typeof setInterval> | null = null

  // Level selection state
  currentLevelId: string | null = null
  levels: LevelSummary[] = []
  nextLevelNumber = 1
  isLoadingLevels = false

  // Level selection UI elements
  newLevelCard = document.getElementById('new-level')
  levelsRow = document.getElementById('levels-row')
  levelsLoading = document.getElementById('levels-loading')
  levelNameModal = document.getElementById('level-name-modal')
  levelNameInput = document.getElementById('level-name-input') as HTMLInputElement | null
  levelNameCancel = document.getElementById('level-name-cancel')
  levelNameConfirm = document.getElementById('level-name-confirm')
  errorToast = document.getElementById('error-toast')

  // settings
  distance = document.querySelector('#distance')
  distanceInput = document.querySelector('#distance-input')

  fov = document.querySelector('#fov')
  fovInput = document.querySelector('#fov-input')

  music = document.querySelector('#music')
  musicInput = document.querySelector('#music-input')

  settingBack = document.querySelector('#setting-back')

  onPlay = () => {
    // Joystick initialization removed
    // isMobile && this.joystick.init()
    this.menu?.classList.add('hidden')
    this.menu?.classList.remove('start')
    this.crossHair.classList.remove('hidden')
    // Show escape-menu-only buttons (Settings, Export) when entering game
    this.setting?.classList.remove('hidden')
    this.export?.classList.remove('hidden')
    this.exit?.classList.remove('hidden')
    // Hide level selection
    this.newLevelCard?.classList.add('hidden')
    this.levelsRow?.classList.add('hidden')
    this.levelsLoading?.classList.add('hidden')
    // Start auto-save timer (10 second interval)
    this.startAutoSave()
  }

  onPause = () => {
    this.menu?.classList.remove('hidden')
    this.crossHair.classList.add('hidden')
    // Show gameplay menu items
    this.setting?.classList.remove('hidden')
    this.export?.classList.remove('hidden')
    this.exit?.classList.remove('hidden')
    this.controls?.classList.remove('hidden')
    // Hide level selection
    this.newLevelCard?.classList.add('hidden')
    this.levelsRow?.classList.add('hidden')
    this.levelsLoading?.classList.add('hidden')
  }

  onExit = async () => {
    // Stop auto-save timer
    this.stopAutoSave()
    // Save current level before exiting
    await this.saveCurrentLevel()

    this.menu?.classList.remove('hidden')
    this.menu?.classList.add('start')
    this.crossHair.classList.add('hidden')
    this.setting?.classList.add('hidden')
    this.export?.classList.add('hidden')
    this.exit?.classList.add('hidden')

    // Show level selection
    this.newLevelCard?.classList.remove('hidden')
    this.levelsRow?.classList.remove('hidden')
    this.controls?.classList.remove('hidden')

    this.currentLevelId = null
    await this.refreshLevelsList()
  }

  // Save current level to Firestore
  async saveCurrentLevel() {
    if (!this.currentLevelId) {
      console.log('No current level to save')
      return
    }

    try {
      const thumbnail = captureThumbnail(this.renderer)

      await updateLevel(this.currentLevelId, {
        blocks: this.terrain.customBlocks.map(b => ({
          x: b.x,
          y: b.y,
          z: b.z,
          color: b.color,
        })),
        seed: this.terrain.noise.seed,
        camera: {
          position: {
            x: this.terrain.camera.position.x,
            y: this.terrain.camera.position.y,
            z: this.terrain.camera.position.z,
          },
          quaternion: {
            x: this.terrain.camera.quaternion.x,
            y: this.terrain.camera.quaternion.y,
            z: this.terrain.camera.quaternion.z,
            w: this.terrain.camera.quaternion.w,
          },
        },
        thumbnail,
      })

      // Update local thumbnail cache
      const levelIndex = this.levels.findIndex(l => l.id === this.currentLevelId)
      if (levelIndex >= 0) {
        this.levels[levelIndex].thumbnail = thumbnail
        this.levels[levelIndex].updatedAt = new Date()
      }

      console.log('Level saved')
    } catch (error) {
      console.error('Failed to save level:', error)
      // Don't show error toast for auto-save failures (too noisy)
    }
  }

  onLoad = () => {
    this.loadModal?.classList.remove('hidden')
    setTimeout(() => {
      this.loadModal?.classList.add('show')
    })
    setTimeout(() => {
      this.loadModal?.classList.remove('show')
    }, 1000)

    setTimeout(() => {
      this.loadModal?.classList.add('hidden')
    }, 1350)
  }

  // Update block counter display
  updateBlockCounter = () => {
    if (!this.blockCounter) return
    
    const count = this.terrain.getUserPlacedBlockCount()
    const maxCount = 10000
    this.blockCounter.textContent = `${count.toLocaleString()} / ${maxCount.toLocaleString()}`
    
    // Add warning class when approaching limit (> 8000)
    if (count > 8000) {
      this.blockCounter.classList.add('warning')
    } else {
      this.blockCounter.classList.remove('warning')
    }
  }


  // Start auto-save timer (10 second interval)
  startAutoSave = () => {
    // Clear any existing timer
    this.stopAutoSave()
    // Start new timer
    this.autoSaveTimer = window.setInterval(() => {
      this.saveCurrentLevel()
    }, 10000) // 10 seconds
  }

  // Stop auto-save timer
  stopAutoSave = () => {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer)
      this.autoSaveTimer = null
    }
  }

  update = () => {
    this.fps.update()
    // Update block counter every frame
    this.updateBlockCounter()
  }

  // Loading overlay methods
  showLoadingOverlay = () => {
    this.loadingOverlay?.classList.remove('hidden')
  }

  hideLoadingOverlay = () => {
    this.loadingOverlay?.classList.add('hidden')
  }

  // Error message methods
  showErrorMessage = (message: string) => {
    if (this.errorText) {
      this.errorText.textContent = message
    }
    this.errorMessage?.classList.remove('hidden')
  }

  hideErrorMessage = () => {
    this.errorMessage?.classList.add('hidden')
    if (this.errorText) {
      this.errorText.textContent = ''
    }
  }

  // Export handler
  handleExport = async () => {
    try {
      // Show loading overlay
      this.showLoadingOverlay()

      // Serialize blocks to Space JSON
      const spaceJSON = serializeToSpaceJSON(
        this.terrain.customBlocks,
        1, // schemaVersion 1 for MVP
        'Untitled Level'
      )

      // POST to backend
      const apiUrl = import.meta.env.VITE_API_URL || '/api/export'
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: spaceJSON,
      })

      // Check for errors
      if (!response.ok) {
        // Try to parse error message from response
        let errorMessage = `Export failed: ${response.statusText}`
        try {
          const errorData = await response.json()
          if (errorData.error || errorData.message) {
            errorMessage = errorData.error || errorData.message
          }
        } catch {
          // If JSON parsing fails, use status text
        }
        throw new Error(errorMessage)
      }

      // Handle successful response - trigger download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'level.rbxlx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      // Hide loading overlay on success
      this.hideLoadingOverlay()
    } catch (error) {
      // Hide loading overlay on error
      this.hideLoadingOverlay()

      // Show error message
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Export failed: Unknown error occurred'
      this.showErrorMessage(errorMessage)
    }
  }
}
