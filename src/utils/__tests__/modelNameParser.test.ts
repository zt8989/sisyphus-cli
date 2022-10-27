import { describe, test, expect } from '@jest/globals'
import { ParseError } from '../../exception/ParseError'
import ModelNameParser from '../modelNameParser'

describe('ModelNameParser module', () => {
  test('given valid name', () => {
    const name = 'HashMap«string,object»'
    const parser = new ModelNameParser(name, [])
    expect(() => parser.parse()).not.toThrow()
    expect(parser.getData()).toMatchObject({
      name: 'HashMap',
      children: [
        {
          children: [],
          name: 'string',
        },
        {
          children: [],
          name: 'object',
        },
      ],
    })
  }, 1000)

  test('given chinese name throw error', () => {
    const name = '通用的请求对象，适用于哪些只有id当作参数的'
    const parser = new ModelNameParser(name, [])
    expect(() => parser.parse()).toThrow(ParseError)
  }, 1000)
})
