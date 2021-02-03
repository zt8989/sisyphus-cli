import beautify from "json-beautify"
import { SwaggerArrayType, SwaggerBaseRefType, SwaggerObjectType, SwaggerProperty } from "./types"
import { forEachValues } from "./utils/obj"

type EventType = "*:start" | "*:end" | "object" | "object:start" | "object:end" 
  | 'array' | "array:start" | "array:end" | 'scalar' | 'scalar:start' | 'scalar:end'
  | 'ref' | 'ref:start' | 'ref:end'

type EventListener = (prop: SwaggerProperty, deep?: number) => void

type GeneratorStack = {
  continuation: number
  node: SwaggerProperty
}

export default class Generator {

  private $stack: GeneratorStack[] = []

  private $call = (prop: SwaggerProperty) => this.$stack.push({
    continuation: 0,
    node: prop,
  })

  private $current = () => this.$stack[this.$stack.length - 1]

  private $return = () => this.$stack.pop()

  // @ts-ignore
  private events: Record<EventType, EventListener[]> = {}

  addEventListener(type: "*:start" | "*:end" , listener: (prop: SwaggerObjectType, deep: number) => void): void
  addEventListener(type: "object" | "object:start" | "object:end" , listener: (prop: SwaggerObjectType) => void): void
  addEventListener(type: 'array' | "array:start" | "array:end" , listener: (prop: SwaggerArrayType) => void): void
  addEventListener(type: 'scalar' | 'scalar:start' | 'scalar:end' , listener: (prop: SwaggerProperty) => void): void
  addEventListener(type: 'ref' | 'ref:start' | 'ref:end' , listener: (prop: SwaggerBaseRefType) => void): void

  addEventListener(type: EventType, listener: any) {
    this.events[type] = this.events[type] || []
    this.events[type].push(listener)
  }

  emit = (type: EventType, prop: SwaggerProperty, deep?: number) => {
    (this.events[type] || []).forEach(x => {
      x.call(null, prop, deep)
    })
  }

  handleObjectProp = (prop: SwaggerProperty, continuation: number) => {
    if(prop.type === 'object') {
      switch(continuation) {
        case 0: {
          this.emit("*:start", prop, this.$stack.length)
          this.emit("object:start", prop);
          break;
        }
        case 1: {
          this.emit("object", prop)
          if(prop.additionalProperties){
            this.$call(prop.additionalProperties)
          }
          if(prop.properties){
            forEachValues(prop.properties, (value) => this.$call(value))
          }
          break
        }
        case 2: {
          this.emit("object:end", prop)
          this.emit("*:end", prop, this.$stack.length)
          break
        }
        case 3: {
          break
        }
      }
    }
  }


  handleArrayProp = (prop: SwaggerProperty, continuation: number) => {
    if(prop.type === 'array') {
      const current = this.$current();
      switch(current.continuation) {
        case 0: {
          this.emit("*:start", prop, this.$stack.length)
          this.emit("array:start", prop)
          break;
        }
        case 1: {
          this.emit("array", prop)
          this.$call(prop.items)
          break
        }
        case 2: {
          this.emit("array:end", prop)
          this.emit("*:end", prop, this.$stack.length)
          break
        }
      }
    }
  }

  handleProp2 = (prop: SwaggerProperty) => {
    this.$call(prop)
    while(this.$stack.length > 0) {
      const current = this.$current();
      const { continuation, node } = current;

      switch (continuation) {
        case 0: {
          this.handleProp(node, continuation)
          current.continuation = 1
          break
        }
        case 1: {
          this.handleProp(node, continuation)
          current.continuation = 2
          break
        }
        case 2: {
          this.handleProp(node, continuation)
          current.continuation = 3
          break
        }
        case 3: {
          this.$return()
          break
        }
      }
    }
  }

  handleProp = (prop: SwaggerProperty, continuation: number) => {
    switch(prop.type) {
      case "array":
        this.handleArrayProp(prop, continuation)
        break
      case "object":
        this.handleObjectProp(prop, continuation)
        break
      case 'string':
      case 'boolean':
      case 'integer':
      case 'number':
      case 'ref':
        this.handleScalar(prop, continuation)
        break
      case undefined:
        this.handleRef(prop, continuation)
        break
      default:
        throw new Error("unknow type" + beautify(prop, null as any, 2, 100))
    }
  }

  handleRef = (prop: SwaggerProperty, continuation: number) => {
    switch(continuation) {
      case 0: {
        this.emit("*:start", prop, this.$stack.length)
        this.emit("ref:start", prop)
        break;
      }
      case 1: {
        this.emit("ref", prop)
        break
      }
      case 2: {
        this.emit("ref:end", prop)
        this.emit("*:end", prop, this.$stack.length)
        break
      }
    }
  }

  handleScalar = (prop: SwaggerProperty, continuation: number) => {
    switch(continuation) {
      case 0: {
        this.emit("*:start", prop, this.$stack.length)
        this.emit("scalar:start", prop)
        break;
      }
      case 1: {
        this.emit("scalar", prop, this.$stack.length)
        break
      }
      case 2: {
        this.emit("scalar:end", prop)
        this.emit("*:end", prop, this.$stack.length)
        break
      }
    }
  }
}