import { scalarType } from './../utils/enum';
import Type from './Type'

export default class ScalarType implements Type {
  private type: string

  constructor(type: string){
    this.type = type
  }

  toString(){
    return Reflect.get(scalarType, this.type)
  }
}