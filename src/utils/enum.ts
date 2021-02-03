export const scalarType: Record<string, string> = {
  'string': 'string',
  'boolean': 'boolean',
  'integer': 'number',
  'int': 'number',
  'number': 'number',
  'long': 'number',
  'Void': 'null',
  'ref': 'any'
}

export const BaseType = [...Object.keys(scalarType), 'object', 'List', 'Map']

export const scalarTypeS = {
  'string': 'S',
  'boolean': 'B',
  'integer': 'I',
  'long': 'L'
}