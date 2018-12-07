import Type from './Type'

export default class MapType<T extends Type> implements Type {
  private valueType: T;
  constructor(valueType: T){
    this.valueType = valueType
  }

  toString(){
    return `{ [key: string]: ${this.valueType.toString()} }`
  }
}