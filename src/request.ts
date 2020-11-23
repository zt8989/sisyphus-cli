import axios from 'axios'

export interface swaggerJson {
  basePath: string
  definitions: swaggerDefinitions
  tags: { name: string, description: string }[]
  paths: {
    [key: string]: swaggerPath
  }
}

export interface swaggerPath {
  [key: string]: swaggerRequest
}

export interface swaggerRequest {
    tags: string[]
    summary: string
    description: string
    operationId: string
    parameters: swaggerParameter[]
    responses: {
      "200": {
        schema: {
          $ref: string
          type: string
        }
      }
    }
}

export interface swaggerParameter {
  in: string
  name: string
  description: string
  required: boolean
  type: string
  enum?: string[]
  items: {
    type: string
  }
  schema: swaggerProperty
}

export interface swaggerRefDefinition {
  $ref: string
  originalRef: string
}

export interface swaggerDefinitions {
    [key: string]: swaggerDefinition
}

export interface swaggerProperty {
  type?: string
  description: string
  $ref?: string
  items: swaggerProperty
  enum?: string[] 
  properties?: swaggerProperty,
  additionalProperties?: swaggerProperty
}
export interface swaggerDefinition {
    type: string
    required: boolean
    properties: Record<string, swaggerProperty>
    title: string
    description: string
}

export default async function getSwaggerJson(url: string){
  const res = await axios.get(url)
  if(res.status === 200){
    return res.data as swaggerJson
  }
  return null
}