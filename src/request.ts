import axios from 'axios'
import { SwaggerJson } from './types'

export default async function getSwaggerJson(url: string){
  const res = await axios.get(url)
  if(res.status === 200){
    return res.data as SwaggerJson
  }
  return null
}