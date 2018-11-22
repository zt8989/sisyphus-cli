import { swaggerDefinitions, swaggerDefinition, swaggerJson, swaggerParameter, swaggerRequest } from './request';
import Project, { PropertyDeclarationStructure, ImportDeclarationStructure, FunctionDeclarationStructure, MethodDeclarationStructure, ParameterDeclarationStructure, CodeBlockWriter } from 'ts-simple-ast';
import fs from 'fs'
import { scalarType } from './utils/enum';
import axios from 'axios'
const logger = require('debug')('api')

export default async function genApis(project: Project, data: swaggerJson) {
  const paths = data.paths
  const functions: MethodDeclarationStructure[] = []
  const imports: ImportDeclarationStructure[] = []
  for (let url in paths) {
    const methods = paths[url]
    for (let method in methods) {
      const parameters = getParameters(methods[method], imports)
      functions.push({
        name: methods[method].operationId,
        parameters,
        returnType: getReturn(methods[method], imports),
        bodyText: writer => {
          writer.writeLine('return this.request({')
            .writeLine(`url: '${url}',`)
            .writeLine(`method: '${method}',`)
            .conditionalWriteLine(method !== 'get', () => `data: params`)
            .conditionalWriteLine(parameters.some(p => p.name === 'query'), () => 'params: query')
            .writeLine('})')
        },
        docs: methods[method].description ? [
          methods[method].description
        ] : []
      })
    }
  }
  const path = `src/api/index.ts`
  if (fs.existsSync(path)) {
    fs.unlinkSync(path)
  }
  const file = project.createSourceFile(path, {
    imports,
    classes: [
      {
        name: 'Api',
        methods: functions,
        properties: [
          { name: 'request', type: 'AjaxRequest' }
        ],
        ctors: [
          {
            parameters: [
              { name: 'request', type: 'AjaxRequest' }
            ],
            bodyText: 'this.request = request'
          }
        ],
        isDefaultExport: true
      }
    ],
    interfaces: [
      {
        name: 'AjaxRequest',
        methods: [
          {
            name: '<T=any>',
            parameters: [{ name: 'options', type: 'AjaxOptions' }],
            returnType: 'Promise<T>'
          }
        ]
      },
      {
        name: 'AjaxOptions',
        properties: [
          { name: 'url', type: 'string' },
          { name: 'method', type: 'string', hasQuestionToken: true },
          { name: 'baseURL', type: 'string', hasQuestionToken: true },
          { name: 'headers', type: 'any', hasQuestionToken: true },
          { name: 'params', type: 'any', hasQuestionToken: true },
          { name: 'data', type: 'any', hasQuestionToken: true },
        ]
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

function getParameters(path: swaggerRequest, imports: ImportDeclarationStructure[]) {
  const result: ParameterDeclarationStructure[] = []
  const parameters = path.parameters || []
  for (let param of parameters) {
    if (param.in === 'body') {
      if (param.schema.$ref) {
        const type = checkAndAddImport(param.schema.$ref, imports)
        result.push({
          name: 'params',
          type,
        })
      }
    }
  }
  const queryParameters = parameters.filter(x => x.in === 'query')
  if (queryParameters.length > 0) {
    result.push({
      name: 'query',
      type: (writer: CodeBlockWriter) => {
        writer.write("{ ")
        writer.write(queryParameters.map(p => `${p.name}: ${Reflect.get(scalarType, p.type)}`).join(' ,'))
        writer.write(" }")
      }
    })
  }
  return result
}

function getReturn(path: swaggerRequest, imports: ImportDeclarationStructure[]) {
  if (path.responses[200]) {
    const schema = path.responses[200].schema
    if (schema.$ref) {
      const type = checkAndAddImport(schema.$ref, imports)
      return `Promise<${type}>`
    }
  }
  return "Promise<any>"
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
  const moduleSpecifier = `../model/${importName}`
  if (!imports.some(i => i.moduleSpecifier === moduleSpecifier)) {
    imports.push({
      moduleSpecifier,
      defaultImport: importName
    })
  }
  return importName
}