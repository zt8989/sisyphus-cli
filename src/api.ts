import { swaggerDefinitions, swaggerDefinition, swaggerJson, swaggerParameter, swaggerRequest } from './request';
import Project, { PropertyDeclarationStructure, ImportDeclarationStructure, FunctionDeclarationStructure, MethodDeclarationStructure, ParameterDeclarationStructure, CodeBlockWriter } from 'ts-simple-ast';
import fs from 'fs'
import { scalarType } from './utils/enum';
import axios from 'axios'
import ModelNameParser from './utils/modelNameParser';
const logger = require('debug')('api')

export default async function genApis(project: Project, data: swaggerJson) {
  const paths = data.paths
  const functions: MethodDeclarationStructure[] = []
  const imports: ImportDeclarationStructure[] = []
  for (let url in paths) {
    const methods = paths[url]
    for (let method in methods) {
      const docs = methods[method].description ? [
        methods[method].description
      ] : []
      const parameters = getParameters(methods[method], imports, docs)
      logger('docs', docs)
      functions.push({
        name: methods[method].operationId,
        parameters: Object.keys(parameters).map(x => parameters[x]),
        returnType: getReturn(methods[method], imports),
        bodyText: writer => {
          writer.writeLine('return this.request({')
            .writeLine(`url: bindUrl('${url}', ${parameters.hasOwnProperty('pathParams') ? 'pathParams' : '{}'}),`)
            .writeLine(`method: '${method.toUpperCase()}',`)
            .conditionalWriteLine(parameters.hasOwnProperty('bodyParams'), () => `data: bodyParams`)
            .conditionalWriteLine(parameters.hasOwnProperty('queryParams'), () => 'params: queryParams')
            .writeLine('})')
        },
        docs: docs.length > 0 ? [ docs.join('\n') ] : []
      })
    }
  }
  const path = `src/api/index.ts`
  if (fs.existsSync(path)) {
    fs.unlinkSync(path)
  }
  const file = project.createSourceFile(path, {
    imports,
    functions: [
      {
        name: 'bindUrl',
        parameters: [
          { name: 'path', type: 'string' },
          { name: 'pathParams', type: 'any' }
        ],
        bodyText: `if (!path.match(/^\\//)) {
    path = '/' + path;
  }
  var url = path;
  url = url.replace(/\\{([\\w-]+)\\}/g, function(fullMatch, key) {
    var value;
    if (pathParams.hasOwnProperty(key)) {
      value = pathParams[key];
    } else {
      value = fullMatch;
    }
    return encodeURIComponent(value);
  });
  return url;`
      }
    ],
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
  return new ModelNameParser(name).parseString()
}

function getParameters(path: swaggerRequest, imports: ImportDeclarationStructure[], docs: string[]) {
  const result: { [key: string]: ParameterDeclarationStructure } = {}
  const parameters = path.parameters || []

  const pathParameters = parameters.filter(x => x.in === 'path')
  if (pathParameters.length > 0) {
    const name = 'pathParams'
    docs.push(`@param {Object} ${name}`)
    getParameterDocs(name, pathParameters, docs)
    result[name] = {
      name,
      type: (writer: CodeBlockWriter) => {
        writer.write("{ ")
        writeTypes(pathParameters, writer)
        writer.write(" }")
      }
    }
  }

  console.log(docs)

  const queryParameters = parameters.filter(x => x.in === 'query')
  if (queryParameters.length > 0) {
    const name = 'queryParams'
    docs.push(`@param {Object} ${name}`)
    getParameterDocs(name, queryParameters, docs)
    result[name] = {
      name,
      type: (writer: CodeBlockWriter) => {
        writer.write("{ ")
        writeTypes(queryParameters, writer)
        writer.write(" }")
      }
    }
  }

  for (let param of parameters) {
    if (param.in === 'body') {
      if (param.schema.$ref) {
        const type = checkAndAddImport(param.schema.$ref, imports)
        result['bodyParams'] = {
          name: 'bodyParams',
          type,
        }
        docs.push(`@param {${type}} bodyParams - ${param.description}`)
      }
    }
  }
  return result
}

function getParameterDocs(name: string, parameters: swaggerParameter[], docs: string[], isArray: boolean = false){
  const hasQueryArray = (p: swaggerParameter) => p.in === "query" && p.name.includes('[0].')

  const normalParameters =  parameters.filter(p => !hasQueryArray(p))

  const addDocs = (type: string, name: string, desc: string = '') => {
    docs.push(`@param {${type}} ${name} - ${desc}`)
  }

  normalParameters.forEach((p, i) => {
    if (Reflect.has(scalarType, p.type)) {
      addDocs(Reflect.get(scalarType, p.type), `${name}${isArray ?'[]' : ''}.${p.name}`, p.description)
    } else if (p.type === 'array') {
      if (p.items) {
        if (Reflect.has(scalarType, p.items.type)) {
          addDocs(`${Reflect.get(scalarType, p.items.type)}[]`, `${name}${isArray ? '[]' : ''}.${p.name}`, p.description)
        }
      }
    } else {
      addDocs('*', `${name}${isArray ? '[]' : ''}.${p.name}`, p.description)
    }
  })

  const list: { [key: string]: swaggerParameter[] } = {}
  const seprator = '[0].'
  const queryArray: swaggerParameter[] = parameters.filter(hasQueryArray)
  queryArray.forEach(q => {
    const [name, filed] = q.name.split(seprator) 
    if(!list[name]){
      list[name] = []
    }
    list[name].push({ ...q, name: filed })
  })
  logger(list)
  for(let i in list){
    getParameterDocs(name, list[i], docs, true)
  }
}

function writeTypes(parameters: swaggerParameter[], writer: CodeBlockWriter) {
  const hasQueryArray = (p: swaggerParameter) => p.in === "query" && p.name.includes('[0].')

  const normalParameters =  parameters.filter(p => !hasQueryArray(p))
  normalParameters.forEach((p, i) => {
    writer.write(i === 0 ? '' : ', ')
    if (Reflect.has(scalarType, p.type)) {
      writer.write(`${p.name}: ${Reflect.get(scalarType, p.type)}`)
    } else if (p.type === 'array') {
      if (p.items) {
        if (Reflect.has(scalarType, p.items.type)) {
          writer.write(`${p.name}: ${Reflect.get(scalarType, p.items.type)}[]`)
        }
      }
    } else {
      writer.write(`${p.name}: any`)
    }
  })

  const list: { [key: string]: swaggerParameter[] } = {}
  const seprator = '[0].'
  const queryArray: swaggerParameter[] = parameters.filter(hasQueryArray)
  queryArray.forEach(q => {
    const [name, filed] = q.name.split(seprator) 
    if(!list[name]){
      list[name] = []
    }
    list[name].push({ ...q, name: filed })
  })
  logger(list)
  for(let i in list){
    writer.write(normalParameters.length === 0 ? '' : ', ')
    writer.write(`${i}: {`)
    writeTypes(list[i], writer)
    writer.write(` }[]`)
  }
}

function getReturn(path: swaggerRequest, imports: ImportDeclarationStructure[]) {
  logger('getReturn', path)
  if (path.responses[200]) {
    const schema = path.responses[200].schema
    if (schema && schema.$ref) {
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
  logger(imports)
  return properties
}

function handleArrayProperties() {

}

function _getProperties(definition: swaggerDefinition, imports: ImportDeclarationStructure[]) {

}

function checkAndAddImport(ref: string, imports: ImportDeclarationStructure[]) {
  logger(ref)
  const importName = checkAndModifyModelName(ref.slice('#/definitions/'.length))
  logger('importName', importName)
  const moduleSpecifier = `../model/${importName}`
  if (!imports.some(i => i.moduleSpecifier === moduleSpecifier)) {
    imports.push({
      moduleSpecifier,
      defaultImport: importName
    })
  }
  return importName
}