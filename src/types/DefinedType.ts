import Type from './Type'

export default class DefinedType implements Type {
  private name: string;
  private importList: Set<string>

  constructor(name: string, importList: Set<string>){
    this.name = name
    this.importList = importList
  }

  getImportType(){
    return this.name
  }

  getImportList(){
    return this.importList
  }

  toString(){
    return this.name
  }
}