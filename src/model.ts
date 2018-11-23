import { swaggerDefinitions, swaggerDefinition, swaggerJson } from './request';
import Project, { PropertyDeclarationStructure, ImportDeclarationStructure } from 'ts-simple-ast';
import fs from 'fs'
import ModelNameParser from './utils/modelNameParser'

const logger = require('debug')('model')

export default async function genModels(project: Project, data:swaggerJson) {
  const definitions = data.definitions
  for(let modelName in definitions){
    const definition = definitions[modelName]
    modelName = checkAndModifyModelName(modelName)
    const path = `src/model/${modelName}.ts`
    if(fs.existsSync(path)){
      fs.unlinkSync(path)
    }
    const imports: ImportDeclarationStructure[] = []
    const properties = getProperties(definition, imports)
    const file = project.createSourceFile(path, {
      imports: imports,
      interfaces: [
        { 
          name: modelName,
          properties: properties,
          isDefaultExport: true,
          docs: definition.description ? [ definition.description ] : []
        }
      ]
    })
  }
}

/**
 * 检查并移除泛型箭头
 * @param name 
 */
function checkAndModifyModelName(name: string){
  return new ModelNameParser(name).parseString()
}

const scalarType = {
  'string': 'string',
  'boolean': 'boolean',
  'integer': 'number',
}

function getProperties(definition: swaggerDefinition, imports: ImportDeclarationStructure[]){
  const properties: PropertyDeclarationStructure[] = []
  if(definition.type === "object"){
    for(let propName in definition.properties){
      const prop = definition.properties[propName]
      if(prop.$ref){
        const type = checkAndAddImport(prop.$ref, imports)
        properties.push({
          name: propName,
          type,
          docs: prop.description ? [ prop.description ] : []
        })
      }

      if(prop.type){
        if(Reflect.has(scalarType, prop.type)){
          properties.push({
            name: propName,
            type: Reflect.get(scalarType, prop.type),
            docs: prop.description ? [ prop.description ] : []
          })
        } else if(prop.type === 'array'){
          if(prop.items.$ref){
            const type = checkAndAddImport(prop.items.$ref, imports)
            properties.push({
              name: propName,
              type: `${type}[]`,
              docs: prop.description ? [ prop.description ] : []
            })
          } else if(prop.items.type && Reflect.has(scalarType, prop.items.type)){
            properties.push({
              name: propName,
              type: `${Reflect.get(scalarType, prop.items.type)}[]`,
              docs: prop.description ? [ prop.description ] : []
            })
          } else if(prop.items.type === 'array'){
            if(prop.items.items.$ref){
              const type = checkAndAddImport(prop.items.items.$ref, imports)
              properties.push({
                name: propName,
                type: `${type}[]`,
                docs: prop.description ? [ prop.description ] : []
              })
            }
          }
        } else if(prop.type === 'object'){
          properties.push({
            name: propName,
            type: 'object',
            docs: prop.description ? [ prop.description ] : []
          })
        }
      }
    }
  }
  logger(imports)
  return properties
}

function handleArrayProperties(){

}

function _getProperties(definition: swaggerDefinition, imports: ImportDeclarationStructure[]){

}

function checkAndAddImport(ref: string, imports: ImportDeclarationStructure[]){
  logger(ref)
  const importName = checkAndModifyModelName(ref.slice('#/definitions/'.length))
  const moduleSpecifier = `./${importName}`
  if(!imports.some(i => i.moduleSpecifier === moduleSpecifier)){
    imports.push({
      moduleSpecifier,
      defaultImport: importName
    })
  }
  return importName
}