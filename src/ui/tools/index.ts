import { EditMode, EditModeLabels, EditModeShortcuts } from '../../control/editMode'

export default class ToolsHotbar {
  container: HTMLElement
  items: HTMLElement[] = []
  current: EditMode = EditMode.Single
  onChange: (mode: EditMode) => void
  private keydownHandler: (e: KeyboardEvent) => void

  constructor(onChange: (mode: EditMode) => void) {
    this.onChange = onChange
    this.container = document.createElement('div')
    this.container.className = 'tools-hotbar hidden'

    const modes = Object.values(EditMode)
    const shortcutSymbol = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'

    for (let i = 0; i < modes.length; i++) {
      const mode = modes[i]
      const item = document.createElement('div')
      item.className = 'tools-item'
      if (mode === this.current) {
        item.classList.add('selected')
      }

      // Show shortcut hint
      item.innerHTML = `
        <span class="tool-label">${EditModeLabels[mode]}</span>
        <span class="tool-shortcut">${shortcutSymbol}${i + 1}</span>
      `
      item.dataset.mode = mode

      item.addEventListener('click', () => {
        this.setMode(mode)
      })

      this.items.push(item)
      this.container.appendChild(item)
    }

    document.body.appendChild(this.container)

    // Keyboard shortcuts (Cmd/Ctrl + 1-4)
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        const mode = EditModeShortcuts[e.key]
        if (mode) {
          e.preventDefault()
          this.setMode(mode)
        }
      }
    }
    document.addEventListener('keydown', this.keydownHandler)
  }

  setMode(mode: EditMode) {
    this.current = mode

    for (const item of this.items) {
      item.classList.remove('selected')
      if (item.dataset.mode === mode) {
        item.classList.add('selected')
      }
    }

    this.onChange(mode)
  }

  getMode(): EditMode {
    return this.current
  }

  show() {
    this.container.classList.remove('hidden')
  }

  hide() {
    this.container.classList.add('hidden')
  }

  destroy() {
    document.removeEventListener('keydown', this.keydownHandler)
    this.container.remove()
  }
}

