import grass from '../../static/block-icon/grass.png'
import stone from '../../static/block-icon/stone.png'
import tree from '../../static/block-icon/tree.png'
import wood from '../../static/block-icon/wood.png'
import diamond from '../../static/block-icon/diamond.png'
import quartz from '../../static/block-icon/quartz.png'
import glass from '../../static/block-icon/glass.png'
import { isMobile } from '../../utils'
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
  COLOR_BLACK
} from '../../constants'

export default class Bag {
  constructor() {
    if (isMobile) return

    this.bag.className = 'bag'
    this.items[0].classList.add('selected')

    for (let i = 0; i < this.items.length; i++) {
      this.bag.appendChild(this.items[i])
    }
    document.body.appendChild(this.bag)

    document.body.addEventListener('keydown', (e: KeyboardEvent) => {
      // M3.4: Handle buttons 1-9 and 0 (button 0 maps to index 9)
      let selectedIndex: number | null = null
      if (e.key === '0') {
        selectedIndex = 9 // Button 0 maps to last item (black)
      } else if (!isNaN(parseInt(e.key)) && parseInt(e.key) >= 1 && parseInt(e.key) <= 9) {
        selectedIndex = parseInt(e.key) - 1 // Buttons 1-9 map to indices 0-8
      }

      if (selectedIndex === null) {
        return
      }

      for (let i = 0; i < this.items.length; i++) {
        this.items[i].classList.remove('selected')
      }

      this.current = selectedIndex
      this.items[this.current].classList.add('selected')
    })

    document.body.addEventListener('wheel', (e: WheelEvent) => {
      if (!this.wheelGap) {
        this.wheelGap = true
        setTimeout(() => {
          this.wheelGap = false
        }, 100)
        if (e.deltaY > 0) {
          this.current++
          this.current > 9 && (this.current = 0)
        } else if (e.deltaY < 0) {
          this.current--
          this.current < 0 && (this.current = 9)
        }
        for (let i = 0; i < this.items.length; i++) {
          this.items[i].classList.remove('selected')
        }
        this.items[this.current].classList.add('selected')
      }
    })
  }
  wheelGap = false
  current = 0
  icon = [grass, stone, tree, wood, diamond, quartz, glass]
  iconIndex = 0
  y = 0

  bag = document.createElement('div')

  // M3.4: Color mapping for buttons 1-0 (removed indigo, moved violet to 6, added brown to 7)
  colorPalette = [
    COLOR_RED,    // Button 1
    COLOR_ORANGE, // Button 2
    COLOR_YELLOW, // Button 3
    COLOR_GREEN,  // Button 4
    COLOR_BLUE,   // Button 5
    COLOR_VIOLET, // Button 6 (moved from 7)
    COLOR_BROWN,  // Button 7 (new)
    COLOR_WHITE,  // Button 8
    COLOR_GRAY,   // Button 9
    COLOR_BLACK   // Button 0
  ]

  items = new Array(10).fill(null).map((_, index) => {
    let item = document.createElement('div')
    item.className = 'item'

    // M3.4: Use color squares for buttons 1-0 (indices 0-9)
    if (index < this.colorPalette.length) {
      let colorSquare = document.createElement('div')
      colorSquare.className = 'color-square'
      colorSquare.style.backgroundColor = this.colorPalette[index]
      
      // Special styling classes for white, gray, and black to ensure visibility
      const isWhite = index === 7 // Button 8 (index 7)
      const isGray = index === 8  // Button 9 (index 8)
      const isBlack = index === 9  // Button 0 (index 9)
      
      if (isWhite) {
        colorSquare.classList.add('color-white')
      } else if (isGray) {
        colorSquare.classList.add('color-gray')
      } else if (isBlack) {
        colorSquare.classList.add('color-black')
      }
      
      // Add button number label for clarity (1-9, 0)
      let label = document.createElement('div')
      label.className = 'color-label'
      label.textContent = index === 9 ? '0' : String(index + 1)
      
      // Label color class based on background
      if (isWhite || isGray) {
        label.classList.add('label-light')
      } else if (isBlack) {
        label.classList.add('label-dark')
      } else {
        label.classList.add('label-colored')
      }
      
      colorSquare.appendChild(label)
      item.appendChild(colorSquare)
    } else {
      // Fallback: Use icon images for any slots beyond 0 (shouldn't happen with 10 items)
      let img = document.createElement('img')
      if (this.icon[this.iconIndex]) {
        img.className = 'icon'
        img.alt = 'block'
        img.src = this.icon[this.iconIndex++]
        item.appendChild(img)
      }
    }

    return item
  })
}
