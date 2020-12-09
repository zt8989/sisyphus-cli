import beautify from "json-beautify"
import { SwaggerArrayType, SwaggerBaseRefType, SwaggerObjectType, SwaggerProperty } from "./types"
import { forEachValues } from "./utils/obj"

type EventType = "object" | "object:start" | "object:end" 
  | 'array' | "array:start" | "array:end" | 'scalar' | 'scalar:start' | 'scalar:end'
  | 'ref' | 'ref:start' | 'ref:end'

type EventListener = (prop: SwaggerProperty) => void

export default class Generator {

  // @ts-ignore
  private events: Record<EventType, EventListener[]> = {}

  addEventListener(type: "object" | "object:start" | "object:end" , listener: (prop: SwaggerObjectType) => void): void
  addEventListener(type: 'array' | "array:start" | "array:end" , listener: (prop: SwaggerArrayType) => void): void
  addEventListener(type: 'scalar' | 'scalar:start' | 'scalar:end' , listener: (prop: SwaggerProperty) => void): void
  addEventListener(type: 'ref' | 'ref:start' | 'ref:end' , listener: (prop: SwaggerBaseRefType) => void): void

  addEventListener(type: EventType, listener: any) {
    this.events[type] = this.events[type] || []
    this.events[type].push(listener)
  }

  emit = (type: EventType, prop: SwaggerProperty) => {
    (this.events[type] || []).forEach(x => {
      x.call(null, prop)
    })
  }

  handleObjectProp = (prop: SwaggerProperty) => {
    if(prop.type === 'object') {
      this.emit("object:start", prop)
      this.emit("object", prop)

      if(prop.additionalProperties){
        this.handleProp(prop.additionalProperties)
      }
      if(prop.properties){
        forEachValues(prop.properties, (value) => this.handleProp(value))
      }
      this.emit("object:end", prop)
    }
  }


  handleArrayProp = (prop: SwaggerProperty) => {
    if(prop.type === 'array') {
      this.emit("array:start", prop)
      this.emit("array", prop)
      this.handleProp(prop.items)
      this.emit("array:end", prop)
    }
  }

  handleProp = (prop: SwaggerProperty) => {
    switch(prop.type) {
      case "array":
        this.handleArrayProp(prop)
        break
      case "object":
        this.handleObjectProp(prop)
        break
      case 'string':
      case 'boolean':
      case 'integer':
      case 'number':
        this.handleScalar(prop)
        break
      case undefined:
        this.handleRef(prop)
        break
      default:
        throw new Error("unknow type" + beautify(prop, null as any, 2, 100))
    }
  }

  handleRef = (prop: SwaggerProperty) => {
    this.emit("ref:start", prop)
    this.emit("ref", prop)
    this.emit("ref:end", prop)
  }

  handleScalar = (prop: SwaggerProperty) => {
    this.emit("scalar:start", prop)
    this.emit("scalar", prop)
    this.emit("scalar:end", prop)
  }
}