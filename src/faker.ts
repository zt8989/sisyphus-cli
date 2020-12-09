import { SwaggerDefinition, SwaggerDefinitions, SwaggerProperty } from "./types";
import { scalarType } from "./utils/enum";
import {forEachValues} from './utils/obj'

export default class Faker {
  private obj: any
  private refStack: any[] = []
  private refs: any = {}

  constructor(private definitions: SwaggerDefinitions){
    this.obj = {}
    this.refStack.push(this.obj)
  }

  getObj(){
    return this.refStack[0]
  }

  fake(ref: string, definition: SwaggerDefinition){
    this.refs[ref] = (this.refs[ref] || 0) + 1
    forEachValues(definition.properties, (prop, name) => {
      this.fakeProp(name, prop)
    })
  }

  getCurrentRef(){
    return this.refStack[this.refStack.length - 1]
  }

  fakeProp(name: string | number, prop: SwaggerProperty){
    if (prop.$ref) {
      if(this.refs[prop.$ref] > 1) {
        return
      }
      let currentRef = this.getCurrentRef()
      currentRef[name] = {}
      currentRef = currentRef[name]
      this.refStack.push(currentRef)
      this.fake(prop.$ref, this.definitions[prop.$ref.slice('#/definitions/'.length)])
      this.refStack.pop()
    }

    if(prop.type) {
      if (Reflect.has(scalarType, prop.type)) {
        this.fakeScalar(name, prop)
      } else if(prop.type === 'array') {
        this.fakeArray(name, prop.items)
      }
    }
  }

  fakeArray(name: string | number, prop: SwaggerProperty){
    const listName = name + '|10'
    let currentRef = this.getCurrentRef()
    currentRef[listName] = []
    currentRef = currentRef[listName]
    this.refStack.push(currentRef)
    this.fakeProp(0, prop)
    this.refStack.pop()
  }

  fakeScalar(name: string | number, prop: SwaggerProperty){
    let currentRef = this.getCurrentRef()
    switch(prop.type) {
      case 'string':
        if(prop.format === 'date-time') {
          currentRef[name] = "@date-time"
        } else {
          currentRef[name] = "@string"
        }
        break
      case 'boolean':
        currentRef[name] = "@boolean"
        break
      case 'integer':
        currentRef[name] = "@integer"
        break
      case 'number':
        currentRef[name] = "@float"
        break
      default:
        throw new Error("unkonw type " + prop.type)
    }
    if(name.toString().toLowerCase().endsWith("id")) {
      currentRef[name] = "@id"
    }
  }
}