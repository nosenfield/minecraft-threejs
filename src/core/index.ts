import * as THREE from 'three'

export default class Core {
  constructor() {
    this.camera = new THREE.PerspectiveCamera()
    this.renderer = new THREE.WebGLRenderer()
    this.scene = new THREE.Scene()
    this.initScene()
    this.initRenderer()
    this.initCamera()
  }

  camera: THREE.PerspectiveCamera
  scene: THREE.Scene
  renderer: THREE.Renderer

  initCamera = () => {
    this.camera.fov = 50
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.near = 0.01
    this.camera.far = 500
    this.camera.updateProjectionMatrix()
    this.camera.position.set(40, 10, 40)

    // Look at center of ground plane (50, 0, 50) from above
    // This creates an isometric-style view looking down at an angle
    // Camera at (40, 10, 40) looking at (50, 0, 50) guarantees downward look
    // (direction vector: (10, -10, 10) normalized ≈ (0.577, -0.577, 0.577))
    this.camera.lookAt(50, 0, 50)

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
    })
  }

  initScene = () => {
    this.scene = new THREE.Scene()
    const backgroundColor = 0x87ceeb

    this.scene.fog = new THREE.Fog(backgroundColor, 1, 96)
    this.scene.background = new THREE.Color(backgroundColor)

    const sunLight = new THREE.PointLight(0xffffff, 0.5)
    sunLight.position.set(500, 500, 500)
    this.scene.add(sunLight)

    const sunLight2 = new THREE.PointLight(0xffffff, 0.2)
    sunLight2.position.set(-500, 500, -500)
    this.scene.add(sunLight2)

    const reflectionLight = new THREE.AmbientLight(0x404040)
    this.scene.add(reflectionLight)
  }

  initRenderer = () => {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(this.renderer.domElement)

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight)
    })
  }
}
