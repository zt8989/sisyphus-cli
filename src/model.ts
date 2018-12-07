import { Context } from './index';
import { swaggerDefinitions, swaggerDefinition, swaggerJson, swaggerProperty } from './request';
import Project, { PropertyDeclarationStructure, ImportDeclarationStructure } from 'ts-simple-ast';
import fs from 'fs'
import ModelNameParser from './utils/modelNameParser'
import BaseTool from './baseTool'
import TypeParser from './parser';

const logger = require('debug')('model')

const scalarType = {
  'string': 'string',
  'boolean': 'boolean',
  'integer': 'number',
}

type WrapperFunc = (type: string) => string
const EmptyWrapper: WrapperFunc = type => type
const ListWrapper: WrapperFunc = type => `${type}[]`
const MapWrapper: WrapperFunc = type => `{ [key: string]: ${type} }`

export default class ModelTool extends BaseTool {

  async genModels(project: Project, data: swaggerJson, context: Context) {
    const definitions = data.definitions
    let genericList: string[] = []
    if (context.config.generic) {
      genericList = context.config.generic.filter(x => fs.existsSync(`src/model/${x}.ts`))
      this.context.config.generic = genericList
    }
    for (let defineName in definitions) {
      const definition = definitions[defineName]
      let modelName = this.checkAndModifyModelName(defineName)
      if (modelName !== false) {
        const path = `src/model/${modelName}.ts`
        if (fs.existsSync(path)) {
          fs.unlinkSync(path)
        }
        const imports: ImportDeclarationStructure[] = []
        const properties = this.getProperties(definition, imports, modelName)
        const file = project.createSourceFile(path, {
          imports: imports,
          interfaces: [
            {
              name: modelName,
              properties: properties,
              isDefaultExport: true,
              docs: definition.description ? [definition.description] : []
            }
          ]
        })
      }
    }

  }

  /**
   * 检查并移除泛型箭头
   * @param name 
   */
  checkAndModifyModelName(name: string) {
    const parser = new ModelNameParser(name, this.context.config.generic || [])
    parser.parse()
    const struct = parser.getData()
    if (struct && this.context.config.generic && this.context.config.generic.some(g => g === struct.name)) {
      return false
    } else {
      return parser.asString()
    }
  }

  getProperties(definition: swaggerDefinition, imports: ImportDeclarationStructure[], modelName: string) {
    const properties: PropertyDeclarationStructure[] = []
    // console.log(new TypeParser().parseDefinition(definition))
    if (definition.type === "object") {
      for (let propName in definition.properties) {
        const prop = definition.properties[propName]
        const type = this.parserSchema(prop, imports, modelName);
        properties.push({
          name: propName,
          type,
          docs: prop.description ? [prop.description] : []
        });
      }
    }
    logger(imports)
    return properties
  }

  private parserSchema(prop: swaggerProperty, imports: ImportDeclarationStructure[], modelName: string, wrapper: WrapperFunc = EmptyWrapper): string {
    if (prop.$ref) {
      const type = this.checkAndReturnType(prop.$ref, imports, [modelName]);
      return wrapper(type)
    }
    if (prop.type) {
      if (prop.type === 'object' && prop.additionalProperties) {
        return wrapper(this.parserSchema(prop.additionalProperties, imports, modelName, MapWrapper))
      } else if (Reflect.has(scalarType, prop.type)) {
        return wrapper(Reflect.get(scalarType, prop.type))
      } else if (prop.type === 'array') {
        return wrapper(this.parserSchema(prop.items, imports, modelName, ListWrapper))
      }
    }
    return wrapper('any')
  }

  handleArrayProperties() {

  }

  _getProperties(definition: swaggerDefinition, imports: ImportDeclarationStructure[]) {

  }
}