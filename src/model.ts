import { swaggerDefinition, swaggerDefinitions, swaggerJson } from './request';
import { PropertyDeclarationStructure, ImportDeclarationStructure, StructureKind, InterfaceDeclarationStructure, PropertySignatureStructure } from 'ts-morph';
import fs from 'fs'
import { ModelStruct } from './utils/modelNameParser'
import BaseTool from './baseTool'
import { join } from 'path';

const logger = require('debug')('model')

export default class ModelTool extends BaseTool{

  async preMap(data: swaggerJson) {
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
  }

  async genModels(data: swaggerJson) {
    const definitions = data.definitions

    // 记录已经创建的泛型类
    const generic: string[] = []

    for (let defineName in definitions) {
      this.genDefintion(definitions, defineName, generic);
    }

    for(let modelName of this.context.imports) {
      if(definitions[modelName]){
        this.genFile(modelName, definitions[modelName])
      }
    }
  }

  genDefintion(definitions: swaggerDefinitions, defineName: string, generic: string[]) {
    const definition = definitions[defineName];
    let struct = this.checkAndModifyModelName(defineName);
    const map =  this.context.fileMap

    if (struct !== false) {
      const modelName = struct.name;

      // 这是个泛型类型
      if (struct.children.length > 0) {
        if (this.context.generic.some(x => x === modelName) && !generic.some(x => x === modelName)) {
          generic.push(modelName);
          const path = join(this.context.outDir, `model/${map[modelName]}.ts`);
          if (fs.existsSync(path)) {
            fs.unlinkSync(path);
          }
          const imports: ImportDeclarationStructure[] = [];
          const properties = this.getProperties(definition, imports, modelName, true);
          const interfaces: InterfaceDeclarationStructure[] = [{
            kind: StructureKind.Interface,
            name: `${modelName}<T>`,
            properties: properties,
            isDefaultExport: true,
            docs: definition.description ? [definition.description] : []
          }]

          this.project.createSourceFile(path, {
            statements: [
              ...imports,
              ...interfaces
            ]
          });
        }
      } else {
        // 如果不在泛型数组内且不是只生成指定tags 加入所有
        if (!this.context.generic.some(x => x === (struct as ModelStruct).name)) {
          if(!this.context.config.onlyTags || this.context.imports.has(struct.name)){
            this.context.imports.add(modelName)
            const imports: ImportDeclarationStructure[] = [];
            this.getProperties(definition, imports, modelName);
          }
        }
      }
    }

    // 清除泛型中的import
    this.context.generic.forEach(x => {
      this.context.imports.delete(x)
    })

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
    const interfaces: InterfaceDeclarationStructure[] = [
      {
        kind: StructureKind.Interface,
        name: modelName,
        properties: properties,
        isDefaultExport: true,
        docs: definition.description ? [definition.description] : []
      }
    ]
    this.project.createSourceFile(path, {
      statements: [...imports, ...interfaces]
    });
  }

  getProperties(definition: swaggerDefinition, imports: ImportDeclarationStructure[], modelName: string, generic = false) {
    const properties: PropertySignatureStructure[] = []
    if (definition.type === "object") {
      for (let propName in definition.properties) {
        const prop = definition.properties[propName]
        const type: PropertyDeclarationStructure["type"] | null = this.handleProp(prop, generic, imports, modelName, (writer, callback) => {
          callback()
        });
        if(type) {
          properties.push({
            kind: StructureKind.PropertySignature,
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