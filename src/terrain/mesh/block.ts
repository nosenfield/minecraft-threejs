import { BlockType } from '../index'

/**
 * Custom block
 */
export default class Block {
  object: any
  constructor(
    x: number,
    y: number,
    z: number,
    type: BlockType,
    placed: boolean,
    isGround?: boolean
  ) {
    this.x = x
    this.y = y
    this.z = z
    this.type = type
    this.placed = placed
    this.isGround = isGround ?? false
  }
  x: number
  y: number
  z: number
  type: BlockType
  placed: boolean
  isGround?: boolean
}
