import { Context } from './index';
import { swaggerDefinitions, swaggerDefinition, swaggerJson, swaggerProperty } from './request';
import Project, { PropertyDeclarationStructure, ImportDeclarationStructure, ExportDeclaration, ExportDeclarationStructure } from 'ts-simple-ast';
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

export default class ModelTool extends BaseTool {

  async genModels(project: Project, data: swaggerJson, context: Context) {
    const definitions = data.definitions
    let genericList: string[] = []
    if (context.config.generic) {
      genericList = context.config.generic.filter(x => fs.existsSync(`src/model/${x}.ts`))
      this.context.config.generic = genericList
    }
    const modelNameList = []
    for (let defineName in definitions) {
      const definition = definitions[defineName]
      let modelName = this.checkAndModifyModelName(defineName)
      if (modelName !== false) {
        const path = `src/model/${modelName}.ts`
        modelNameList.push(modelName)
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
    const path = `src/model/index.ts`
    if (fs.existsSync(path)) {
      fs.unlinkSync(path)
    }
    const file = project.createSourceFile(path, {
      exports: modelNameList.map((modelName: string): ExportDeclarationStructure => { 
        return { namedExports: writer  => writer.writeLine(`default as ${modelName}`), moduleSpecifier: `./${modelName}` } })
    })
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
        const type = this.parserSchema(prop, imports, [ modelName ]);
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
}