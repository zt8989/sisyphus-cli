import Type from './Type'

export default class ListType<T extends Type> implements Type {
  private itemType: T;
  constructor(itemType: T){
    this.itemType = itemType
  }

  getImportType(){
    return this.itemType.getImportType()
  }

  toString(){
    return `${this.itemType}[]`
  }
}