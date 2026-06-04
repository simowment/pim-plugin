import { describe, it, expect } from 'vitest'
import index from '../index'

describe('PIM Plugin Initialization', () => {
  it('should export an empty object by default', () => {
    expect(index).toEqual({})
  })
})
