import { swaggerDefinitions, swaggerDefinition, swaggerJson } from './request';
import Project, { PropertyDeclarationStructure, ImportDeclarationStructure, FunctionDeclarationStructure, MethodDeclarationStructure } from 'ts-simple-ast';
import fs from 'fs'

export default async function genApis(project: Project, data: swaggerJson) {
  const paths = data.paths
  const functions: MethodDeclarationStructure[] = []
  for (let url in paths) {
    const methods = paths[url]
    for (let method in methods) {
      functions.push({
        name: methods[method].operationId,
        bodyText: writer => {
          writer.writeLine('this.request({')
            .writeLine(`url: '${url}',`)
            .writeLine(`method: '${method}',`)
            .writeLine('})')
        }
      })
    }
  }
  const path = `src/api/index.ts`
  if (fs.existsSync(path)) {
    fs.unlinkSync(path)
  }
  const imports: ImportDeclarationStructure[] = []
  const file = project.createSourceFile(path, {
    imports,
    classes: [
      {
        name: 'Api',
        methods: functions,
        properties: [
          { name: 'request', type: 'any' }
        ],
        ctors: [
          {
            parameters: [
              { name: 'request', type: 'any' }
            ],
            bodyText: 'this.request = request'
          }
        ],
        isDefaultExport: true
      }
    ]
  })
}

/**
 * 检查并移除泛型箭头
 * @param name 
 */
function checkAndModifyModelName(name: string) {
  return name.replace(/[«»]/g, "")
}

const scalarType = {
  'string': 'string',
  'boolean': 'boolean',
  'integer': 'number',
}

function getProperties(definition: swaggerDefinition, imports: ImportDeclarationStructure[]) {
  const properties: PropertyDeclarationStructure[] = []
  if (definition.type === "object") {
    for (let propName in definition.properties) {
      const prop = definition.properties[propName]
      if (prop.$ref) {
        const type = checkAndAddImport(prop.$ref, imports)
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
            const type = checkAndAddImport(prop.items.$ref, imports)
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
              const type = checkAndAddImport(prop.items.items.$ref, imports)
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
  console.log(imports)
  return properties
}

function handleArrayProperties() {

}

function _getProperties(definition: swaggerDefinition, imports: ImportDeclarationStructure[]) {

}

function checkAndAddImport(ref: string, imports: ImportDeclarationStructure[]) {
  console.log(ref)
  const importName = checkAndModifyModelName(ref.slice('#/definitions/'.length))
  const moduleSpecifier = `./${importName}`
  if (!imports.some(i => i.moduleSpecifier === moduleSpecifier)) {
    imports.push({
      moduleSpecifier,
      defaultImport: importName
    })
  }
  return importName
}