import axios from 'axios'

export interface swaggerJson {
  definitions: swaggerDefinitions
}

export interface swaggerDefinitions {
    [key: string]: swaggerDefinition
}

export interface swaggerDefinition {
    type: string
    required: string[]
    properties: {
      [key: string]: {
        type?: string
        description: string
        $ref?: string
        items: swaggerProperty
      }
    }
    title: string
    description: string
}

export interface swaggerProperty {
  type?: string
  description: string
  $ref?: string
  items: swaggerProperty
}

export default async function getSwaggerJson(url: string){
  const res = await axios.get(url)
  if(res.status === 200){
    return res.data as swaggerJson
  }
  return null
}