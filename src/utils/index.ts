export const htmlToDom = (html: string) => {
  const templateDom = document.createElement('template')
  templateDom.innerHTML = html
  window.document.body.appendChild(templateDom.content)
}

export const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(
  navigator.userAgent
)

// M5.1: Utility function to convert BlockType enum to hex color string
import { BlockType } from '../terrain/index'
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

/**
 * Converts a BlockType enum value to its corresponding hex color string.
 * Returns COLOR_GRAY as fallback for non-color BlockTypes.
 * 
 * @param type - The BlockType enum value
 * @returns Hex color string (e.g., "#FF0000")
 */
export function blockTypeToHex(type: BlockType): string {
  const colorMap: Partial<Record<BlockType, string>> = {
    [BlockType.red]: COLOR_RED,
    [BlockType.orange]: COLOR_ORANGE,
    [BlockType.yellow]: COLOR_YELLOW,
    [BlockType.green]: COLOR_GREEN,
    [BlockType.blue]: COLOR_BLUE,
    [BlockType.violet]: COLOR_VIOLET,
    [BlockType.brown]: COLOR_BROWN,
    [BlockType.white]: COLOR_WHITE,
    [BlockType.gray]: COLOR_GRAY,
    [BlockType.black]: COLOR_BLACK,
  }
  return colorMap[type] ?? COLOR_GRAY // Default fallback for non-color BlockTypes
}
