import Type from './Type'

export default class EntityType implements Type {
  private name: string
  private type: Type
  constructor(name: string, type: Type){
    this.name = name
    this.type = type
  }

  getImportType(){
    return this.type.getImportType()
  }

  toString(){
    return `${this.name}: ${this.type}`
  }
}