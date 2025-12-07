import Core from './core'
import Control from './control'
import Player from './player'
import Terrain from './terrain'
import UI from './ui'
import Audio from './audio'
import { initAuth } from './firebase/auth'
import ToolsHotbar from './ui/tools'

import './style.css'

// Wrap existing init in async function
async function init() {
  // Initialize Firebase auth first
  try {
    const user = await initAuth()
    console.log('Authenticated as:', user?.uid)
  } catch (error) {
    console.error('Auth initialization failed:', error)
    // Continue anyway - offline mode will work
  }

  const core = new Core()
  const camera = core.camera
  const scene = core.scene
  const renderer = core.renderer

  const player = new Player()
  const audio = new Audio(camera)

  const terrain = new Terrain(scene, camera)
  const control = new Control(scene, camera, player, terrain, audio)

  // Create tools hotbar and wire to control
  const toolsHotbar = new ToolsHotbar((mode) => {
    control.setEditMode(mode)
  })

  const ui = new UI(terrain, control, renderer, toolsHotbar)

  // Initialize level selection after auth is ready
  await ui.initLevelSelection()

  // animation
  ;(function animate() {
    // let p1 = performance.now()
    requestAnimationFrame(animate)

    control.update()
    terrain.update({
      editMode: control.editMode,
      isDragging: control.isDragging,
      dragStart: control.dragStart,
      holdingBlock: control.holdingBlock,
      wallPhase: control.wallPhase,
      wallBaseLine: control.wallBaseLine
    })
    ui.update()

    renderer.render(scene, camera)
    // console.log(performance.now()-p1)
  })()
}

init()
