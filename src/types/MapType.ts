import Type from './Type'

export default class MapType<T extends Type> implements Type {
  private valueType: T;
  constructor(valueType: T){
    this.valueType = valueType
  }

  getImportType(){
    return this.valueType.getImportType()
  }

  toString(){
    return `{ [key: string]: ${this.valueType} }`
  }
}