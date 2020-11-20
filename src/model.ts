import { swaggerDefinition, swaggerJson } from './request';
import { PropertyDeclarationStructure, ImportDeclarationStructure, CodeBlockWriter } from 'ts-simple-ast';
import fs from 'fs'
import { ModelStruct } from './utils/modelNameParser'
import BaseTool from './baseTool'
import { join } from 'path';

const logger = require('debug')('model')

const scalarType = {
  'string': 'string',
  'boolean': 'boolean',
  'integer': 'number',
  'number': 'number'
}

export default class ModelTool extends BaseTool{
 
  async genModels(data: swaggerJson) {
    const project = this.project
    const definitions = data.definitions
    const count: Record<string, number> = {}
    const map: Record<string, string> = {}

    // 统计是否重复 
    for (let defineName in definitions) {
      let struct = this.checkAndModifyModelName(defineName)
      if (struct !== false) {
        const modelName = struct.name
        if(struct.children.length > 0){
          if(!this.context.generic.some(x => x === modelName)){
            count[modelName.toLocaleLowerCase()] = 0
            map[modelName] = modelName
            this.context.generic.push(modelName)
          }
        } else {
          if(count[modelName.toLocaleLowerCase()] === undefined) {
            count[modelName.toLocaleLowerCase()] = 0
            map[modelName] = modelName
          } else {
            count[modelName.toLocaleLowerCase()] += 1
            map[modelName] = modelName + count[modelName.toLocaleLowerCase()]
          }
        }
      }
    }
    this.context.fileMap = map

    // 记录已经创建的泛型类
    const generic: string[] = []

      for (let defineName in definitions) {
        const definition = definitions[defineName]
        let struct = this.checkAndModifyModelName(defineName)
        if (struct !== false) {
          const modelName = struct.name

          if(struct.children.length > 0 ) {
            if(this.context.generic.some(x => x === modelName) && !generic.some(x => x === modelName)) {
              generic.push(modelName)
              const path = join(this.context.outDir, `model/${map[modelName]}.ts`)
              if (fs.existsSync(path)) {
                fs.unlinkSync(path)
              }
              const imports: ImportDeclarationStructure[] = []
              const properties = this.getProperties(definition, imports, modelName, true)
              project.createSourceFile(path, {
                imports: imports,
                interfaces: [
                  {
                    name: `${modelName}<T>`,
                    properties: properties,
                    isDefaultExport: true,
                    docs: definition.description ? [definition.description] : []
                  }
                ]
              })
            }
          } else {
            if(!this.context.generic.some(x => x === (struct as ModelStruct).name)) {
              this.genFile(struct.name, definition);
          }
        }
      }
    }
  }

  genFile(modelName: string, definition: swaggerDefinition) {
    const map = this.context.fileMap
    if(!this.context.fileMap[modelName]){
      this.context.fileMap[modelName] = modelName
    }
    const path = join(this.context.outDir, `model/${map[modelName]}.ts`);
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
    const imports: ImportDeclarationStructure[] = [];
    const properties = this.getProperties(definition, imports, modelName);
    this.project.createSourceFile(path, {
      imports: imports,
      interfaces: [
        {
          name: modelName,
          properties: properties,
          isDefaultExport: true,
          docs: definition.description ? [definition.description] : []
        }
      ]
    });
  }

  getProperties(definition: swaggerDefinition, imports: ImportDeclarationStructure[], modelName: string, generic = false) {
    const properties: PropertyDeclarationStructure[] = []
    if (definition.type === "object") {
      for (let propName in definition.properties) {
        const prop = definition.properties[propName]
        if (prop.$ref) {
          if(!generic) {
            const type = this.checkAndReturnType(prop.$ref, imports, [modelName])
            properties.push({
              name: propName,
              type,
              docs: prop.description ? [prop.description] : []
            })
          } else {
            properties.push({
              name: propName,
              type: 'T',
              docs: prop.description ? [prop.description] : []
            })
          }
        }

        if (prop.type) {
          if (Reflect.has(scalarType, prop.type)) {
            let type 
            if(prop.type === scalarType.string && Array.isArray(prop.enum)) {
              type = prop.enum.map(x => `'${x}'`).join(' | ')
            } else {
              type = Reflect.get(scalarType, prop.type)
            }
            properties.push({
              name: propName,
              type: type,
              docs: prop.description ? [prop.description] : []
            })
          } else if (prop.type === 'array') {
            if (prop.items.$ref) {
              if(generic) {
                properties.push({
                  name: propName,
                  type: `T[]`,
                  docs: prop.description ? [prop.description] : []
                })
              } else {
                const type = this.checkAndReturnType(prop.items.$ref, imports, [modelName])
                properties.push({
                  name: propName,
                  type: `${type}[]`,
                  docs: prop.description ? [prop.description] : []
                })
              }
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
            } else if(prop.items.type === 'object') {
              if(prop.items.properties){
                const params = Object.keys(prop.items.properties).map(x => {
                  return {
                    // @ts-ignore
                    ...prop.items.properties[x],
                    name: x
                  }
                })
                properties.push({
                  name: propName,
                  type: (writer: CodeBlockWriter) => {
                    writer.write("{ ")
                    this.writeTypes(params, writer)
                    writer.write(" }[]")
                  }
                })
              }
            }
          } else if (prop.type === 'object') {
            if(prop.properties){
              // @ts-ignore
              const params = Object.keys(prop.properties).map(x => {
                return {
                  // @ts-ignore
                  ...prop.properties[x],
                  name: x
                }
              })
              properties.push({
                name: propName,
                type: (writer: CodeBlockWriter) => {
                  writer.write("{ ")
                  this.writeTypes(params, writer)
                  writer.write(" }")
                }
              })
            } else {
              properties.push({
                name: propName,
                type: 'object',
                docs: prop.description ? [prop.description] : []
              })
            }
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