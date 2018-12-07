export const scalarType = {
  'string': 'string',
  'boolean': 'boolean',
  'integer': 'number',
  'int': 'number',
  'long': 'number',
  'Void': 'null',
  'object': 'any',
}

export const scalarTypeS = {
  'string': 'S',
  'boolean': 'B',
  'integer': 'I',
  'long': 'L'
}

/**
 * 内置类型，不需要import
 */
export const containTypes = ['object', 'long', 'boolean', 'integer', 'List', 'Map', 'LinkedHashMap', 'HashMap', 'string', 'Void', 'int']