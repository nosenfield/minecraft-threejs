import { BlockType } from '../index'

/**
 * Custom block
 * M5.1: Enhanced with color, tags, and tagConfig for export and future game mechanics
 */
export default class Block {
  object: any
  constructor(
    x: number,
    y: number,
    z: number,
    type: BlockType,
    placed: boolean,
    color: string,
    isGround: boolean = false,
    tags?: string[],
    tagConfig?: Record<string, any>
  ) {
    this.x = x
    this.y = y
    this.z = z
    this.type = type
    this.placed = placed
    this.color = color
    this.isGround = isGround
    this.tags = tags ?? []
    this.tagConfig = tagConfig ?? {}
  }
  x: number
  y: number
  z: number
  type: BlockType
  placed: boolean
  color: string // M5.1: Hex color format (e.g., "#FF0000")
  isGround: boolean
  tags?: string[] // M5.1: Optional tags for game mechanics (e.g., ["healPlayer", "destructable"])
  tagConfig?: Record<string, any> // M5.1: Optional tag-specific configurations

  /**
   * Check if block has a specific tag
   * @param tag - Tag name to check
   * @returns true if block has the tag
   */
  hasTag(tag: string): boolean {
    return this.tags?.includes(tag) ?? false
  }

  /**
   * Add a tag to the block with optional configuration
   * @param tag - Tag name to add
   * @param config - Optional configuration for the tag
   */
  addTag(tag: string, config?: any): void {
    if (!this.tags) {
      this.tags = []
    }
    if (!this.tagConfig) {
      this.tagConfig = {}
    }
    if (!this.tags.includes(tag)) {
      this.tags.push(tag)
    }
    if (config !== undefined) {
      this.tagConfig[tag] = config
    }
  }

  /**
   * Remove a tag and its configuration from the block
   * @param tag - Tag name to remove
   */
  removeTag(tag: string): void {
    if (this.tags) {
      const index = this.tags.indexOf(tag)
      if (index > -1) {
        this.tags.splice(index, 1)
      }
    }
    if (this.tagConfig && this.tagConfig[tag]) {
      delete this.tagConfig[tag]
    }
  }

  /**
   * Get configuration for a specific tag
   * @param tag - Tag name
   * @returns Configuration object or undefined if tag doesn't exist or has no config
   */
  getTagConfig(tag: string): any | undefined {
    return this.tagConfig?.[tag]
  }

  /**
   * Set or update configuration for a specific tag
   * @param tag - Tag name
   * @param config - Configuration object
   */
  setTagConfig(tag: string, config: any): void {
    if (!this.tagConfig) {
      this.tagConfig = {}
    }
    this.tagConfig[tag] = config
  }
}
