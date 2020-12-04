import { PropertyDeclarationStructure, ImportDeclarationStructure, FunctionDeclarationStructure, ParameterDeclarationStructure, CodeBlockWriter, EnumDeclarationStructure, StructureKind } from 'ts-morph';
import fs from 'fs'
import { scalarType } from './utils/enum';
import BaseTool from './baseTool'
import { BODY_PARAMS, QUERY_PARAMS, PATH_PARAMS } from './constants';
import { join, parse, posix } from 'path';
import * as changeCase from "change-case";
import { RenameOption, SwaggerDefinition, SwaggerDefinitions, SwaggerJson, SwaggerParameter, SwaggerRequest } from './types';
import ModelFile from './modelFile';
import { getRequestConfigByOperationId } from 'swagger-faker'
import beautify from "json-beautify"
const logger = require('debug')('api')

const retainWord = ['delete']

export default class ApiTool extends BaseTool {

  private mockObject: Record<string, any> = {}

  handleOperationId(option: RenameOption){
    const { swaggerRequest, tagName } = option
    if(this.context.config.nameStrategy) {
      return this.context.config.nameStrategy(option, changeCase)
    }
    let id = swaggerRequest.operationId
    let newId = swaggerRequest.operationId
    const preg = /Using\w+(_\d+)?$/
    if(preg.test(id)){
      const match = id.match(preg)
      if(match){
        newId = id.slice(0, match.index)
      }
    }
    // 如果是保留字，则加上组名
    if(retainWord.indexOf(newId) !== -1){
      newId = newId + tagName
    }
    return newId
  }

  /**
   * 预先加载泛型类
   */
  importGenerics(imports: ImportDeclarationStructure[]) {
    (this.context.generic || []).forEach(g => {
      this._checkAndAddImport(g, imports)
    })
  }

  getTag(tag: string){
    const configTags = this.context.config.tags
    if(configTags){
      return configTags[tag] || tag
    }
    return tag
  }

  async genApis(data: SwaggerJson) {
    const project = this.project
    // this.createRequestFile(project)
    if(this.context.config.createTags) {
      this.createTags(data)
    }

    const defaultImports : ImportDeclarationStructure[] = [{
      moduleSpecifier: this.context.config.requestPath || "",
      kind: StructureKind.ImportDeclaration,
      namedImports: ['bindUrl', 'request']
    }]

    let tags = data.tags
    if(this.context.config.onlyTags) {
      tags = tags.filter(x => !!(this.context.config.tags || {})[x.name])
    }
    for (let tag of tags) {
      const tagName = this.getTag(tag.name)

      const URLS_ENUM_NAME = tagName + "_URLS"
      const urlsEnum: EnumDeclarationStructure = {
        name: URLS_ENUM_NAME,
        isExported: true,
        members: [],
        kind: StructureKind.Enum
      }

      const paths = data.paths
      const functions: FunctionDeclarationStructure[] = []
      const imports: ImportDeclarationStructure[] = [...defaultImports]
   
      for (let url in paths) {
        const methods = paths[url]
        for (let method in methods) {
          if(methods[method].tags.indexOf(tag.name) === -1){
            break
          }
          const docs = []
          const headers : {[key: string]: string} = {}
          if (methods[method].summary) {
            docs.push(methods[method].summary)
          }
          if (methods[method].description) {
            docs.push(methods[method].description)
          }
          docs.push(`${method.toUpperCase()} ${posix.join(data.basePath ,url)}`)

          if(methods[method]?.deprecated === true) {
            docs.push(`@deprecated`)
          }
       
          const methodName = this.handleOperationId({
            swaggerRequest: methods[method],
            tagName,
            url,
            method,
            parsedPath: parse(url)
          });
          const parameters = this.getParameters(methods[method], imports, docs, headers, methodName)
          const isDownload = this.isDownloadApi(methods[method])
          const fullUrl = posix.join(data.basePath ,url)
          // @ts-ignore
          urlsEnum.members.push({
            name: methodName,
            value: fullUrl
          })
          logger('docs', docs)
          functions.push({
            kind: StructureKind.Function,
            name: methodName,
            parameters: this.handleFunctionParameters(parameters),
            returnType: this.getReturn(methods[method], imports, data.definitions),
            statements: writer => {
              writer.writeLine(`return request({`)
                .writeLine(`url: bindUrl(${URLS_ENUM_NAME}.${methodName}, ${parameters.hasOwnProperty(PATH_PARAMS) ? PATH_PARAMS : '{}'}),`)
                .writeLine(`method: '${method.toUpperCase()}',`)
                .conditionalWriteLine(parameters.hasOwnProperty(BODY_PARAMS), () => `data: ${BODY_PARAMS},`)
                .conditionalWriteLine(parameters.hasOwnProperty(QUERY_PARAMS), () => `params: ${QUERY_PARAMS},`)
                .conditionalWriteLine(Object.keys(headers).length > 0 , () => `headers: ${JSON.stringify(headers)},`)
                .conditionalWriteLine(isDownload, () => `responseType: 'blob',`)
                .conditionalWriteLine(this.context.config.appendOptions, () => '...options')
                .writeLine('})')
            },
            docs: docs.length > 0 ? [docs.join('\n')] : [],
            isExported: true,
          })

          if(this.context.config.mock) {
            const mockData = this.getMockData(data, methods[method].operationId)
            this.mockObject[`${method.toUpperCase()} ${fullUrl}`] = mockData
          }
        }
      }

      const path = join(this.context.outDir, `${tagName}.ts`) 
      if (fs.existsSync(path)) {
        fs.unlinkSync(path)
      }
      project.createSourceFile(path, {
        statements: [...imports, urlsEnum, ...functions]
      })
      if(this.context.config.mock) {
        const mockPath = join(process.cwd(), 'mock', `${tagName}.ts`)
        if (fs.existsSync(mockPath)) {
          fs.unlinkSync(mockPath)
        }
        project.createSourceFile(mockPath,(writer: CodeBlockWriter) => {
          writer.write("export default " + beautify(this.mockObject, null as any, 2, 100))
        })
      }
    }
  }

  /**
   * 处理方法参数
   */
  handleFunctionParameters(parameters: { [key: string]: ParameterDeclarationStructure }) {
    return Object.keys(parameters).map(x => parameters[x])
  }

  getMockData(swagger: SwaggerJson, operationId: string){
    const request = getRequestConfigByOperationId(swagger as any, operationId);
    const response = request?.response || {}
    if(this.context.config.mockOverwrite && typeof this.context.config.mockOverwrite === 'function'){
      return this.context.config.mockOverwrite(response)
    }
    return response
  }

  /**
   * 生成request.ts
   * @param project 
   */
  // createRequestFile(project: Project){
  //   const path = join(this.context.outDir, `request.ts`)
  //   if (fs.existsSync(path)) {
  //     // fs.unlinkSync(path)
  //     return
  //   }
    
  //   project.createSourceFile(path, {
  //     interfaces: [
  //       {
  //         name: 'AjaxRequest',
  //         methods: [
  //           {
  //             name: '<T=any>',
  //             parameters: [{ name: 'options', type: 'AjaxOptions' }],
  //             returnType: 'Promise<T>'
  //           }
  //         ],
  //         isExported: true
  //       },
  //       {
  //         name: 'AjaxOptions',
  //         properties: [
  //           { name: 'url', type: 'string' },
  //           { name: 'method', type: 'string', hasQuestionToken: true },
  //           { name: 'baseURL', type: 'string', hasQuestionToken: true },
  //           { name: 'headers', type: 'any', hasQuestionToken: true },
  //           { name: 'params', type: 'any', hasQuestionToken: true },
  //           { name: 'data', type: 'any', hasQuestionToken: true },
  //           { name: 'responseType', type: 'string', hasQuestionToken: true },
  //         ],
  //         isExported: true
  //       }
  //     ],
  //     functions: [
  //       {
  //         name: 'bindUrl',
  //         parameters: [
  //           { name: 'path', type: 'string' },
  //           { name: PATH_PARAMS, type: 'any' }
  //         ],
  //         bodyText: `if (!path.match(/^\\//)) {
  //   path = '/' + path;
  // }
  // var url = path;
  // url = url.replace(/\\{([\\w-]+)\\}/g, function(fullMatch, key) {
  //   var value;
  //   if (pathParams.hasOwnProperty(key)) {
  //     value = pathParams[key];
  //   } else {
  //     value = fullMatch;
  //   }
  //   return encodeURIComponent(value);
  // });
  // return url;`,
  //         isExported: true
  //       },
  //       {
  //       name: 'request',
  //       parameters: [
  //         { name: 'params', type: 'AjaxOptions' },
  //       ],
  //       bodyText: `return new Promise(() => {})`,
  //       returnType: 'Promise<any>',
  //       isExported: true
  //     },
  //     ],
  //   })
  // }

  getParameters(path: SwaggerRequest, imports: ImportDeclarationStructure[], docs: string[], headers: {[key: string]: string }, methodName: string) {
    const result: { [key: string]: ParameterDeclarationStructure } = {}
    const parameters = path.parameters || []

    const pathParameters = parameters.filter(x => x.in === 'path')
    if (pathParameters.length > 0) {
      const name = PATH_PARAMS
      docs.push(`@param {Object} ${name}`)
      this.getParameterDocs(name, pathParameters, docs)
      result[name] = {
        kind: StructureKind.Parameter,
        name,
        type: (writer: CodeBlockWriter) => {
          writer.write("{ ")
          this.writeTypes(pathParameters, writer)
          writer.write(" }")
        }
      }
    }

    const queryParameters = parameters.filter(x => x.in === 'query')
    if (queryParameters.length > 0) {
      const name = 'queryParams'

      if(queryParameters.length > 2) {
        const fileName = methodName + "Query"
        const typeName = fileName[0].toUpperCase() + fileName.slice(1)
        const define: SwaggerDefinition = {
          type: 'object',
          required: true,
          properties: {},
          title: typeName,
          description: typeName
        }
        docs.push(`@param {${typeName}} ${name}`)
        queryParameters.forEach(x => {
          if(x.name.indexOf("[0].") !== -1) {
            const splitNames = x.name.split("[0].")
            const name = splitNames[0]
            const childName = splitNames[1]
            if(define.properties[name]) {
              // @ts-ignore
              define.properties[name]["items"]["properties"][childName] = x
            } else {
              define.properties[name] = {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    [childName]: x
                  }
                }
              } as any
            } 
          } else if(x.name.indexOf(".") !== -1){
            const splitNames = x.name.split(".")
            const name = splitNames[0]
            const childName = splitNames[1]
            if(define.properties[name]) {
              // @ts-ignore
              define.properties[name]["properties"][childName] = define
            } else {
              define.properties[name] = {
                type: "object",
                properties: {
                  [childName]: define
                }
              } as any
            } 
          } else {
            define.properties[x.name] = x as any
          }
        })
        new ModelFile(this.context, this.project, typeName, define).create()
        result[name] = {
          kind: StructureKind.Parameter,
          name: name,
          type: typeName
        }
        imports.push({
          kind: StructureKind.ImportDeclaration,
          moduleSpecifier: this.getRelativePath(typeName),
          defaultImport: typeName
        })
      } else {
        docs.push(`@param {Object} ${name}`)
        this.getParameterDocs(name, queryParameters, docs)
        result[name] = {
          kind: StructureKind.Parameter,
          name,
          type: (writer: CodeBlockWriter) => {
            writer.write("{ ")
            this.writeTypes(queryParameters, writer, this.context.config.optionalQuery)
            writer.write(" }")
          }
        }
      }
    }

    for (let param of parameters) {
      if (param.in === 'body') {
        if (param?.schema?.$ref) {
          const type = this.checkAndAddImport(param.schema.$ref, imports)
          result[BODY_PARAMS] = {
            kind: StructureKind.Parameter,
            name: BODY_PARAMS,
            type,
          }
          docs.push(`@param {${type}} ${BODY_PARAMS} - ${param.description}`)
        } else if(param?.schema?.type && Reflect.has(scalarType, param?.schema?.type ?? "")){
          result[BODY_PARAMS] = {
            kind: StructureKind.Parameter,
            name: BODY_PARAMS,
            type: scalarType[param.schema.type ?? ""],
          }
          docs.push(`@param {${scalarType[param.schema.type ?? ""]}} ${BODY_PARAMS} - ${param.description}`)
        } else if (param?.schema?.type === 'array') {
          if(param?.schema?.items?.$ref){
            // 其他类型参数-array
            const type = this.checkAndAddImport(param.schema.items.$ref, imports)
            result[BODY_PARAMS] = {
              kind: StructureKind.Parameter,
              name: BODY_PARAMS,
              type: type + '[]',
            }
            docs.push(`@param {${type}[]} ${BODY_PARAMS} - ${param.description}`)
          }else if(param?.schema?.items?.type && scalarType[param.schema.items.type ?? ""]){
            result[BODY_PARAMS] = {
              kind: StructureKind.Parameter,
              name: BODY_PARAMS,
              type: scalarType[param.schema.items.type ?? ""] + '[]',
            }
            docs.push(`@param {${scalarType[param.schema.items.type ?? ""]}[]} ${BODY_PARAMS} - ${param.description}`)
          } else {
            result[BODY_PARAMS] = {
              kind: StructureKind.Parameter,
              name: BODY_PARAMS,
              type: 'any[]',
            }
            docs.push(`@param {any[]} ${BODY_PARAMS} - ${param.description}`)
          }
        } else if(param?.schema?.type === 'object'){
          result[BODY_PARAMS] = {
            kind: StructureKind.Parameter,
            name: BODY_PARAMS,
            type: 'any',
          }
          docs.push(`@param any ${BODY_PARAMS} - ${param.description}`)
        } else {
          // 其他类型参数-object
          result[BODY_PARAMS] = {
            kind: StructureKind.Parameter,
            name: BODY_PARAMS,
            type: 'any',
          }
          docs.push(`@param any ${BODY_PARAMS} - ${param.description}`)
        }
      } else if (param.in === 'formData') {
        // api包含formData：如文件
        if (param.type === 'file') {
          result['bodyParams'] = {
            kind: StructureKind.Parameter,
            name: 'bodyParams', 
            type: 'FormData',
          }
          docs.push(`@param FormData bodyParams - ${param.description}`)
          headers['Content-Type'] = 'application/x-www-form-urlencoded'
        }
      } else {
        // other
      }
    }

    if(this.context.config.appendOptions) {
      result['options'] = {
        kind: StructureKind.Parameter,
        name: 'options?',
        type: 'any',
      }
    }
    return result
  }

  isDownloadApi(path: SwaggerRequest) {
    // 下载相关接口
    if (path.responses[200]) {
      const schema = path.responses[200].schema
      if (schema && schema.type === 'file') {
        return true
      } else {
        // other
      }
    }
    return false
  }

  getParameterDocs(name: string, parameters: SwaggerParameter[], docs: string[], isArray: boolean = false) {
    const hasQueryArray = (p: SwaggerParameter) => p.in === "query" && p.name.includes('[0].')

    const normalParameters = parameters.filter(p => !hasQueryArray(p))

    const addDocs = (type: string, name: string, desc: string = '') => {
      docs.push(`@param {${type}} ${name} - ${desc}`)
    }

    normalParameters.forEach((p) => {
      if (Reflect.has(scalarType, p.type ?? "")) {
        addDocs(Reflect.get(scalarType, p.type ?? ""), `${name}${isArray ? '[]' : ''}.${p.name}`, p.description)
      } else if (p.type === 'array') {
        if (p.items) {
          if (Reflect.has(scalarType, p?.items?.type ?? "")) {
            addDocs(`${Reflect.get(scalarType, p?.items?.type ?? "")}[]`, `${name}${isArray ? '[]' : ''}.${p.name}`, p.description)
          }
        }
      } else {
        addDocs('*', `${name}${isArray ? '[]' : ''}.${p.name}`, p.description)
      }
    })

    const list: { [key: string]: SwaggerParameter[] } = {}
    const seprator = '[0].'
    const queryArray: SwaggerParameter[] = parameters.filter(hasQueryArray)
    queryArray.forEach(q => {
      const [name, filed] = q.name.split(seprator)
      if (!list[name]) {
        list[name] = []
      }
      list[name].push({ ...q, name: filed })
    })
    logger(list)
    for (let i in list) {
      this.getParameterDocs(name, list[i], docs, true)
    }
  }

  createTags(data: SwaggerJson){
    const path = `./tags.json`
    if (fs.existsSync(path)) {
      fs.unlinkSync(path)
    }
    const map: { [key: string]: string } = {}
    data.tags.forEach(x => {
      map[x.name] = x.name
    })

    fs.writeFileSync(path, JSON.stringify(map, null, '\n'))
  }

  getReturn(path: SwaggerRequest, imports: ImportDeclarationStructure[], definitions: SwaggerDefinitions) {
    logger('getReturn', path)
    if (path.responses[200]) {
      let schema = path.responses[200].schema
      if (schema && schema.$ref) {
        let ref = schema.$ref
        if(this.context.config.dataKey) {
          const define = definitions[ref.slice('#/definitions/'.length)]
          let schema = define.properties[this.context.config.dataKey]
          if(schema && schema.$ref) {
            const type = this.checkAndAddImport(schema.$ref, imports, [])
            return `Promise<${type}>`
          }
        } else {
          const type = this.checkAndAddImport(schema.$ref, imports, [])
          return `Promise<${type}>`
        }
      } else {
        // other
      }
    }
    return "Promise<any>"
  }

  getProperties(definition: SwaggerDefinition, imports: ImportDeclarationStructure[]) {
    const properties: PropertyDeclarationStructure[] = []
    if (definition.type === "object") {
      for (let propName in definition.properties) {
        const prop = definition.properties[propName]
        if (prop.$ref) {
          const type = this.checkAndAddImport(prop.$ref, imports)
          properties.push({
            kind: StructureKind.Property,
            name: propName,
            type,
            docs: prop.description ? [prop.description] : []
          })
        }

        if (prop.type) {
          if (Reflect.has(scalarType, prop.type)) {
            properties.push({
              kind: StructureKind.Property,
              name: propName,
              type: Reflect.get(scalarType, prop.type),
              docs: prop.description ? [prop.description] : []
            })
          } else if (prop.type === 'array') {
            if (prop?.items?.$ref) {
              const type = this.checkAndAddImport(prop.items.$ref, imports)
              properties.push({
                kind: StructureKind.Property,
                name: propName,
                type: `${type}[]`,
                docs: prop.description ? [prop.description] : []
              })
            } else if (prop?.items?.type && Reflect.has(scalarType, prop.items.type ?? "")) {
              properties.push({
                kind: StructureKind.Property,
                name: propName,
                type: `${Reflect.get(scalarType, prop.items.type ?? "")}[]`,
                docs: prop.description ? [prop.description] : []
              })
            } else if (prop?.items?.type === 'array') {
              if (prop?.items?.items?.$ref) {
                const type = this.checkAndAddImport(prop.items.items.$ref, imports)
                properties.push({
                  kind: StructureKind.Property,
                  name: propName,
                  type: `${type}[]`,
                  docs: prop.description ? [prop.description] : []
                })
              }
            }
          } else if (prop.type === 'object') {
            properties.push({
              kind: StructureKind.Property,
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

  getRelativePath(model: string) {
    return `./model/${this.context.fileMap[model] || model}`
  }
}