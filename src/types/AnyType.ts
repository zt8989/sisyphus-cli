import Type from './Type'

export default class AnyType implements Type {

  getImportType(){
    return null
  }

  toString(){
    return 'any'
  }
}