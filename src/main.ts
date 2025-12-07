import Core from './core'
import Control from './control'
import Player from './player'
import Terrain from './terrain'
import UI from './ui'
import Audio from './audio'
import { initAuth } from './firebase/auth'

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

  // ... existing initialization code ...
  const core = new Core()
  const camera = core.camera
  const scene = core.scene
  const renderer = core.renderer

  const player = new Player()
  const audio = new Audio(camera)

  const terrain = new Terrain(scene, camera)
  const control = new Control(scene, camera, player, terrain, audio)

  const ui = new UI(terrain, control)

  // Initialize level selection after auth is ready
  await ui.initLevelSelection()

  // animation
  ;(function animate() {
    // let p1 = performance.now()
    requestAnimationFrame(animate)

    control.update()
    terrain.update()
    ui.update()

    renderer.render(scene, camera)
    // console.log(performance.now()-p1)
  })()
}

init()
