import FPS from './fps'
import Bag from './bag'
import Terrain from '../terrain'
import Block from '../terrain/mesh/block'
import Control from '../control'
import { Mode } from '../player'
// M4.4: Joystick import removed - mobile controls not needed for MVP
// import Joystick from './joystick'
import { isMobile, blockTypeToHex } from '../utils'
import * as THREE from 'three'
import { serializeToSpaceJSON } from '../export'

export default class UI {
  constructor(terrain: Terrain, control: Control) {
    this.terrain = terrain
    this.fps = new FPS()
    this.bag = new Bag()
    // M4.4: Joystick removed - mobile controls not needed for MVP
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
        
        // M5.1: Backward compatibility - ensure all loaded blocks have color property
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

    // Initialize Load Game button state on startup
    this.updateLoadGameButtonState()

    // Phase 4: Export button handler
    this.export?.addEventListener('click', async () => {
      await this.handleExport()
    })

    // Phase 4: Error message close button
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
      this.saveToLocalStorage()
    })
  }

  terrain: Terrain
  fps: FPS
  bag: Bag
  // M4.4: Joystick removed - mobile controls not needed for MVP
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
  // M4.4: Save/load button preserved for production (hidden in MVP)
  save = document.querySelector('#save')

  // modals
  // M4.4: Save/load modals preserved for production (hidden in MVP)
  saveModal = document.querySelector('.save-modal')
  loadModal = document.querySelector('.load-modal')
  settings = document.querySelector('.settings')
  controlsModal = document.querySelector('.controls')
  
  // Phase 4: Export UI components
  loadingOverlay = document.querySelector('.loading-overlay')
  errorMessage = document.querySelector('.error-message')
  errorText = document.querySelector('.error-text')
  errorClose = document.querySelector('#error-close')
  
  // M4.2: Block counter element (created dynamically after FPS)
  blockCounter: HTMLDivElement

  // Auto-save timer
  autoSaveTimer: ReturnType<typeof setInterval> | null = null

  // settings
  distance = document.querySelector('#distance')
  distanceInput = document.querySelector('#distance-input')

  fov = document.querySelector('#fov')
  fovInput = document.querySelector('#fov-input')

  music = document.querySelector('#music')
  musicInput = document.querySelector('#music-input')

  settingBack = document.querySelector('#setting-back')

  onPlay = () => {
    // M4.4: Joystick initialization removed
    // isMobile && this.joystick.init()
    this.menu?.classList.add('hidden')
    this.menu?.classList.remove('start')
    this.play && (this.play.innerHTML = 'Resume')
    this.crossHair.classList.remove('hidden')
    // Controls button now visible in escape menu (not hidden during gameplay)
    // Show escape-menu-only buttons (Settings, Export) when entering game
    this.setting?.classList.remove('hidden')
    this.export?.classList.remove('hidden')
    // Start auto-save timer (10 second interval)
    this.startAutoSave()
  }

  onPause = () => {
    this.menu?.classList.remove('hidden')
    this.crossHair.classList.add('hidden')
    // Hide Load Game button in escape menu (only visible in start menu)
    this.save?.classList.add('hidden')
    // Controls button visible in escape menu
    this.controls?.classList.remove('hidden')
    // Show escape-menu-only buttons (Settings, Export) in escape menu
    this.setting?.classList.remove('hidden')
    this.export?.classList.remove('hidden')
  }

  onExit = () => {
    // Stop auto-save timer
    this.stopAutoSave()
    // Auto-save on exit
    this.saveToLocalStorage()
    this.menu?.classList.add('start')
    this.play && (this.play.innerHTML = 'Play')
    // Show Load Game button in start menu
    this.save && (this.save.innerHTML = 'Load Game')
    this.save?.classList.remove('hidden')
    this.controls?.classList.remove('hidden')
    // Hide escape-menu-only buttons (Settings, Export) in start menu
    this.setting?.classList.add('hidden')
    this.export?.classList.add('hidden')
    // Update Load Game button state (enable/disable based on saved data)
    this.updateLoadGameButtonState()
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

  // M4.2: Update block counter display
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

  // Check if saved game data exists in localStorage
  hasSavedGame = (): boolean => {
    const savedBlocks = window.localStorage.getItem('block')
    return savedBlocks !== null && savedBlocks !== 'null' && savedBlocks !== ''
  }

  // Update Load Game button state (enable/disable based on saved data)
  updateLoadGameButtonState = () => {
    if (!this.save) return
    
    // Only update state when button shows "Load Game" (start menu)
    if (this.save.innerHTML === 'Load Game') {
      const hasSaved = this.hasSavedGame()
      this.save.disabled = !hasSaved
    }
  }

  // Auto-save functionality
  saveToLocalStorage = () => {
    try {
      window.localStorage.setItem(
        'block',
        JSON.stringify(this.terrain.customBlocks)
      )
      window.localStorage.setItem('seed', JSON.stringify(this.terrain.noise.seed))

      // Save camera position and rotation (quaternion) for complete view restoration
      window.localStorage.setItem(
        'camera',
        JSON.stringify({
          position: {
            x: this.terrain.camera.position.x,
            y: this.terrain.camera.position.y,
            z: this.terrain.camera.position.z
          },
          quaternion: {
            x: this.terrain.camera.quaternion.x,
            y: this.terrain.camera.quaternion.y,
            z: this.terrain.camera.quaternion.z,
            w: this.terrain.camera.quaternion.w
          }
        })
      )
      // Keep 'position' for backward compatibility (legacy saves)
      window.localStorage.setItem(
        'position',
        JSON.stringify({
          x: this.terrain.camera.position.x,
          y: this.terrain.camera.position.y,
          z: this.terrain.camera.position.z
        })
      )
      // Update Load Game button state after saving
      this.updateLoadGameButtonState()
    } catch (e) {
      console.error('Auto-save failed:', e)
      // Handle quota exceeded or other errors gracefully
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded - auto-save disabled')
        this.stopAutoSave()
      }
    }
  }

  // Start auto-save timer (10 second interval)
  startAutoSave = () => {
    // Clear any existing timer
    this.stopAutoSave()
    // Start new timer
    this.autoSaveTimer = setInterval(() => {
      this.saveToLocalStorage()
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
    // M4.2: Update block counter every frame
    this.updateBlockCounter()
  }

  // Phase 4: Loading overlay methods
  showLoadingOverlay = () => {
    this.loadingOverlay?.classList.remove('hidden')
  }

  hideLoadingOverlay = () => {
    this.loadingOverlay?.classList.add('hidden')
  }

  // Phase 4: Error message methods
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

  // Phase 4: Export handler
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
