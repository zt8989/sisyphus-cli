import { swaggerDefinition, swaggerProperty, swaggerSchema } from './../request';
import Type from '../types/Type';
import AnyType from '../types/AnyType'
import ObjectType from '../types/ObjectType';
import { scalarType } from '../utils/enum';
import ScalarType from '../types/ScalarType';
import EntityType from '../types/EntityType';
import DefinedType from '../types/DefinedType';
import ListType from '../types/ListType';
import MapType from '../types/MapType';
import ModelNameParser from '../utils/modelNameParser';

type TypeWrapFunc = (type: Type) => Type

const EmptyWrapper: TypeWrapFunc = type => type
const ListWrapper: TypeWrapFunc = type => new ListType(type)
const MapWrapper: TypeWrapFunc = type => new MapType(type)

export default class TypeParser {

  importTypes: DefinedType[]
  generic: string[]

  constructor(generic: string[], importTypes: DefinedType[] = []){
    this.importTypes = importTypes
    this.generic = generic
  }

  getRefType(ref: string) {
    const parser = new ModelNameParser(ref, this.generic)
    parser.parse()
    const typeName = parser.getReturnName()
    const refType = new DefinedType(typeName, parser.getImportList())
    if(this.importTypes.every(i => i.getImportType() !== typeName)){
      this.importTypes.push(refType)
    }
    return refType
  }

  parseDefinition(definition: swaggerDefinition): Type {
    let result: Type
    if (definition.type === "object") {
      result = new ObjectType()
      for (let propName in definition.properties) {
        const prop = definition.properties[propName]
        this.parseObjectEntity(prop, propName, result as ObjectType)
      }
      return result
    } else {
      return new AnyType()
    }
  }

  parseObjectEntity(property: swaggerProperty, name: string, result: ObjectType) {
    result.addEntity(new EntityType(
      name,
      this.parseSchema(property)
    ))
  }

  parseSchema(schema: swaggerSchema, wrapper: TypeWrapFunc = EmptyWrapper): Type {
    if (schema.$ref) {
      return wrapper(this.getRefType(schema.$ref))
    }

    if (schema.type) {
      if(schema.type === 'object' && schema.additionalProperties){
        return wrapper(this.parseSchema(schema.additionalProperties, MapWrapper))
      } else if (Reflect.has(scalarType, schema.type)) {
        return wrapper(new ScalarType(Reflect.get(scalarType, schema.type)))
      } else if (schema.type === 'array') {
        return wrapper(this.parseSchema(schema.items, ListWrapper))
      }
    }
    return wrapper(new AnyType())
  }
}