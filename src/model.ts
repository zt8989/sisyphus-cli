import { Context } from './index';
import { swaggerDefinition, swaggerJson } from './request';
import Project, { PropertyDeclarationStructure, ImportDeclarationStructure } from 'ts-simple-ast';
import fs from 'fs'
import ModelNameParser from './utils/modelNameParser'
import BaseTool from './baseTool'

const logger = require('debug')('model')

const scalarType = {
  'string': 'string',
  'boolean': 'boolean',
  'integer': 'number',
  'number': 'number'
}

export default class ModelTool extends BaseTool{
 
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
        project.createSourceFile(path, {
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
    if (definition.type === "object") {
      for (let propName in definition.properties) {
        const prop = definition.properties[propName]
        if (prop.$ref) {
          const type = this.checkAndReturnType(prop.$ref, imports, [modelName])
          properties.push({
            name: propName,
            type,
            docs: prop.description ? [prop.description] : []
          })
        }

        if (prop.type) {
          if (Reflect.has(scalarType, prop.type)) {
            properties.push({
              name: propName,
              type: Reflect.get(scalarType, prop.type),
              docs: prop.description ? [prop.description] : []
            })
          } else if (prop.type === 'array') {
            if (prop.items.$ref) {
              const type = this.checkAndReturnType(prop.items.$ref, imports, [modelName])
              properties.push({
                name: propName,
                type: `${type}[]`,
                docs: prop.description ? [prop.description] : []
              })
            } else if (prop.items.type && Reflect.has(scalarType, prop.items.type)) {
              properties.push({
                name: propName,
                type: `${Reflect.get(scalarType, prop.items.type)}[]`,
                docs: prop.description ? [prop.description] : []
              })
            } else if (prop.items.type === 'array') {
              if (prop.items.items.$ref) {
                const type = this.checkAndReturnType(prop.items.items.$ref, imports, [modelName])
                properties.push({
                  name: propName,
                  type: `${type}[]`,
                  docs: prop.description ? [prop.description] : []
                })
              }
            }
          } else if (prop.type === 'object') {
            properties.push({
              name: propName,
              type: 'object',
              docs: prop.description ? [prop.description] : []
            })
          }
        }
      }
    }
    logger(imports)
    return properties
  }

  handleArrayProperties() {

  }

  _getProperties() {

  }
}