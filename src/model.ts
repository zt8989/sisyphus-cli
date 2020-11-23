import { swaggerDefinition, swaggerJson } from './request';
import { PropertyDeclarationStructure, ImportDeclarationStructure } from 'ts-simple-ast';
import fs from 'fs'
import { ModelStruct } from './utils/modelNameParser'
import BaseTool from './baseTool'
import { join } from 'path';

const logger = require('debug')('model')

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
        const type: PropertyDeclarationStructure["type"] | null = this.handleProp(prop, generic, imports, modelName, (writer, callback) => {
          callback()
        });
        if(type) {
          properties.push({
            name: propName,
            type,
            docs: prop.description ? [prop.description] : []
          })
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