import Type from './Type'
import EntityType from './Type'

export default class ObjectType implements Type {
  private entities: EntityType[];
  constructor(...entities: EntityType[]){
    this.entities = entities
  }

  public addEntity(entity: EntityType){
    this.entities.push(entity)
  }

  getImportType(){
    return null
  }

  toString(){
    let str = '{ '
    this.entities.forEach((entity, i) => {
      if(i! == 0) str += ', '
      str+= `${entity}`
    })
    str += ' }'
    return str
  }
}