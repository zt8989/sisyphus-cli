import { swaggerDefinition, swaggerJson, swaggerParameter, swaggerRequest } from './request';
import Project, { PropertyDeclarationStructure, ImportDeclarationStructure, FunctionDeclarationStructure, ParameterDeclarationStructure, CodeBlockWriter } from 'ts-simple-ast';
import fs from 'fs'
import { scalarType } from './utils/enum';
import BaseTool from './baseTool'
import { BODY_PARAMS, QUERY_PARAMS, PATH_PARAMS } from './constants';
const logger = require('debug')('api')

const retainWord = ['delete']
function handleOperationId(id: string, tag: string){
  let newId = id
  const preg = /Using\w+(_\d+)?$/
  if(preg.test(id)){
    const match = id.match(preg)
    if(match){
      newId = id.slice(0, match.index)
    }
  }
  // 如果是保留字，则加上组名
  if(retainWord.indexOf(newId) !== -1){
    newId = newId + tag
  }
  return newId
}

export default class ApiTool extends BaseTool {

  /**
   * 预先加载泛型类
   */
  importGenerics(imports: ImportDeclarationStructure[]) {
    (this.context.config.generic || []).forEach(g => {
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

  async genApis(project: Project, data: swaggerJson) {
    this.createRequestFile(project)
    this.createTags(data)

    const defaultImports :ImportDeclarationStructure[] = [{
      moduleSpecifier: `../request`,
      namedImports: ['bindUrl', 'request']
    }]

    const indexImports :ImportDeclarationStructure[] = []

    for (let tag of data.tags) {
      const tagName = this.getTag(tag.name)
      const paths = data.paths
      const functions: FunctionDeclarationStructure[] = []
      const imports: ImportDeclarationStructure[] = [...defaultImports]

      this.importGenerics(imports)
      indexImports.push({
        moduleSpecifier: `./${tagName}`,
        defaultImport: `* as ${tagName}`
      })
   
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
          docs.push(`${method.toUpperCase()} ${url}`)
          const parameters = this.getParameters(methods[method], imports, docs, headers)
          const isDownload = this.isDownloadApi(methods[method])
          logger('docs', docs)
          functions.push({
            name: handleOperationId(methods[method].operationId, tagName),
            parameters: this.handleFunctionParameters(parameters),
            returnType: this.getReturn(methods[method], imports),
            bodyText: writer => {
              writer.writeLine(`return request({`)
                .writeLine(`url: bindUrl('${url}', ${parameters.hasOwnProperty(PATH_PARAMS) ? PATH_PARAMS : '{}'}),`)
                .writeLine(`method: '${method.toUpperCase()}',`)
                .conditionalWriteLine(parameters.hasOwnProperty(BODY_PARAMS), () => `data: ${BODY_PARAMS},`)
                .conditionalWriteLine(parameters.hasOwnProperty(QUERY_PARAMS), () => `params: ${QUERY_PARAMS},`)
                .conditionalWriteLine(Object.keys(headers).length > 0 , () => `headers: ${JSON.stringify(headers)},`)
                .conditionalWriteLine(isDownload, () => `responseType: 'blob',`)
                .writeLine('})')
            },
            docs: docs.length > 0 ? [docs.join('\n')] : [],
            isExported: true
          })
        }
      }

      const path = `src/api/${tagName}.ts`
      if (fs.existsSync(path)) {
        fs.unlinkSync(path)
      }
      project.createSourceFile(path, {
        imports,
        functions
      })
    }
  
    const path = `src/api/index.ts`
    if (fs.existsSync(path)) {
      fs.unlinkSync(path)
    }

    let bodyText = 'export default {\r\n'
    data.tags.forEach(tag => {
      const tagName = this.getTag(tag.name)
      bodyText += `\t${tagName},\r\n`
    })
    bodyText += '}'
    project.createSourceFile(path, {
      imports: indexImports,
      bodyText: bodyText
    })
  }

  /**
   * 处理方法参数
   */
  handleFunctionParameters(parameters: { [key: string]: ParameterDeclarationStructure }) {
    return Object.keys(parameters).map(x => parameters[x])
  }

  /**
   * 生成request.ts
   * @param project 
   */
  createRequestFile(project: Project){
    const path = `src/request.ts`
    if (fs.existsSync(path)) {
      // fs.unlinkSync(path)
      return
    }
    
    project.createSourceFile(path, {
      interfaces: [
        {
          name: 'AjaxRequest',
          methods: [
            {
              name: '<T=any>',
              parameters: [{ name: 'options', type: 'AjaxOptions' }],
              returnType: 'Promise<T>'
            }
          ],
          isExported: true
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
            { name: 'responseType', type: 'string', hasQuestionToken: true },
          ],
          isExported: true
        }
      ],
      functions: [
        {
          name: 'bindUrl',
          parameters: [
            { name: 'path', type: 'string' },
            { name: PATH_PARAMS, type: 'any' }
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
  return url;`,
          isExported: true
        },
        {
        name: 'request',
        parameters: [
          { name: 'params', type: 'AjaxOptions' },
        ],
        bodyText: `return new Promise(() => {})`,
        returnType: 'Promise<any>',
        isExported: true
      },
      ],
    })
  }

  getParameters(path: swaggerRequest, imports: ImportDeclarationStructure[], docs: string[], headers: {[key: string]: string}) {
    const result: { [key: string]: ParameterDeclarationStructure } = {}
    const parameters = path.parameters || []

    const pathParameters = parameters.filter(x => x.in === 'path')
    if (pathParameters.length > 0) {
      const name = PATH_PARAMS
      docs.push(`@param {Object} ${name}`)
      this.getParameterDocs(name, pathParameters, docs)
      result[name] = {
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
      docs.push(`@param {Object} ${name}`)
      this.getParameterDocs(name, queryParameters, docs)
      result[name] = {
        name,
        type: (writer: CodeBlockWriter) => {
          writer.write("{ ")
          this.writeTypes(queryParameters, writer)
          writer.write(" }")
        }
      }
    }

    for (let param of parameters) {
      if (param.in === 'body') {
        if (param.schema.$ref) {
          const type = this.checkAndAddImport(param.schema.$ref, imports)
          result[BODY_PARAMS] = {
            name: BODY_PARAMS,
            type,
          }
          docs.push(`@param {${type}} ${BODY_PARAMS} - ${param.description}`)
        } else if (param.schema.type === 'array' && param.schema.items && param.schema.items.$ref) {
          // 其他类型参数-array
          const type = this.checkAndAddImport(param.schema.$ref, imports)
          result[BODY_PARAMS] = {
            name: BODY_PARAMS,
            type: type + '[]',
          }
          docs.push(`@param {${type}[]} ${BODY_PARAMS} - ${param.description}`)
        } else {
          // 其他类型参数-object
          result[BODY_PARAMS] = {
            name: BODY_PARAMS,
            type: 'any',
          }
          docs.push(`@param any ${BODY_PARAMS} - ${param.description}`)
        }
      } else if (param.in === 'formData') {
        // api包含formData：如文件
        if (param.type === 'file') {
          result['bodyParams'] = {
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
    return result
  }

  isDownloadApi(path: swaggerRequest) {
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

  getParameterDocs(name: string, parameters: swaggerParameter[], docs: string[], isArray: boolean = false) {
    const hasQueryArray = (p: swaggerParameter) => p.in === "query" && p.name.includes('[0].')

    const normalParameters = parameters.filter(p => !hasQueryArray(p))

    const addDocs = (type: string, name: string, desc: string = '') => {
      docs.push(`@param {${type}} ${name} - ${desc}`)
    }

    normalParameters.forEach((p) => {
      if (Reflect.has(scalarType, p.type)) {
        addDocs(Reflect.get(scalarType, p.type), `${name}${isArray ? '[]' : ''}.${p.name}`, p.description)
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

  writeTypes(parameters: swaggerParameter[], writer: CodeBlockWriter) {
    const hasQueryArray = (p: swaggerParameter) => p.in === "query" && p.name.includes('[0].')
    const hasQueryObject = (p: swaggerParameter) => p.in === "query" && p.name.includes('.') && !p.name.includes('[0].')

    const normalParameters = parameters.filter(p => !hasQueryArray(p) && !hasQueryObject(p))
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

    {
      const list: { [key: string]: swaggerParameter[] } = {}
      const seprator = '[0].'
      const queryArray: swaggerParameter[] = parameters.filter(hasQueryArray)
      queryArray.forEach(q => {
        const [name, filed] = q.name.split(seprator)
        if (!list[name]) {
          list[name] = []
        }
        list[name].push({ ...q, name: filed })
      })
      logger(list)
      for (let i in list) {
        writer.write(normalParameters.length === 0 ? '' : ', ')
        writer.write(`${i}: {`)
        this.writeTypes(list[i], writer)
        writer.write(` }[]`)
      }
    }
    {
      const list: { [key: string]: swaggerParameter[] } = {}
      const seprator = '.'
      const queryObject: swaggerParameter[] = parameters.filter(hasQueryObject)
      queryObject.forEach(q => {
        const [name, filed] = q.name.split(seprator)
        if (!list[name]) {
          list[name] = []
        }
        list[name].push({ ...q, name: filed })
      })
      logger(list)
      for (let i in list) {
        writer.write(normalParameters.length === 0 ? '' : ', ')
        writer.write(`${i}: {`)
        this.writeTypes(list[i], writer)
        writer.write(` }`)
      }
    }
  }

  createTags(data: swaggerJson){
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

  getReturn(path: swaggerRequest, imports: ImportDeclarationStructure[]) {
    logger('getReturn', path)
    if (path.responses[200]) {
      const schema = path.responses[200].schema
      if (schema && schema.$ref) {
        const type = this.checkAndReturnType(schema.$ref, imports)
        return `Promise<${type}>`
      } else {
        // other
      }
    }
    return "Promise<any>"
  }

  getProperties(definition: swaggerDefinition, imports: ImportDeclarationStructure[]) {
    const properties: PropertyDeclarationStructure[] = []
    if (definition.type === "object") {
      for (let propName in definition.properties) {
        const prop = definition.properties[propName]
        if (prop.$ref) {
          const type = this.checkAndAddImport(prop.$ref, imports)
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
              const type = this.checkAndAddImport(prop.items.$ref, imports)
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
                const type = this.checkAndAddImport(prop.items.items.$ref, imports)
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

  getRelativePath(model: string) {
    return `../model/${model}`
  }
}