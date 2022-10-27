import { describe, test, expect } from '@jest/globals'
import { ParseError } from '../../exception/ParseError'
import ModelNameParser from '../modelNameParser'

describe('ModelNameParser module', () => {
  test('given valid name', () => {
    const name = 'HashMap«string,object»'
    const parser = new ModelNameParser(name, [])
    expect(() => parser.parse()).not.toThrow()
  }, 1000)

  test('given chinese name throw error', () => {
    const name = '通用的请求对象，适用于哪些只有id当作参数的'
    const parser = new ModelNameParser(name, [])
    expect(() => parser.parse()).toThrow(ParseError)
  }, 1000)
})
