import { Context } from "./index";
import ModelNameParser, { ModelStruct } from "./utils/modelNameParser";
import Project, { CodeBlockWriter, ImportDeclarationStructure } from "ts-simple-ast";
import { swaggerParameter } from "./request";
import { scalarType } from "./utils/enum";
const logger = require('debug')('api')

const filterList = ['object', 'long', 'boolean', 'integer', 'List', 'Map', 'string', 'Void', 'int']

export default class BaseTool {
  protected context: Context
  protected project: Project

  constructor(context: Context, project: Project) {
    this.context = context
    this.project = project
  }

  writeTypes(parameters: swaggerParameter[], writer: CodeBlockWriter, optional: boolean = false) {
    const hasQueryArray = (p: swaggerParameter) => p.in === "query" && p.name.includes('[0].')
    const hasQueryObject = (p: swaggerParameter) => p.in === "query" && p.name.includes('.') && !p.name.includes('[0].')

    const normalParameters = parameters.filter(p => !hasQueryArray(p) && !hasQueryObject(p))
    normalParameters.forEach((p, i) => {
      writer.write(i === 0 ? '' : ', ')
      if (Reflect.has(scalarType, p.type)) {
        let type 
        if(p.type === scalarType.string && Array.isArray(p.enum)) {
          type = p.enum.map(x => `'${x}'`).join(' | ')
        } else {
          type = Reflect.get(scalarType, p.type)
        }
        writer.write(`${p.name}${!p.required || optional ? '?':''}: ${type}`)
      } else if (p.type === 'array') {
        let name = p.name
        if(name.endsWith('[]')) {
          name = `'${name}'`
        }
        if (p.items) {
          if (Reflect.has(scalarType, p.items.type)) {
            writer.write(`${name}${!p.required || optional ? '?':''}: ${Reflect.get(scalarType, p.items.type)}[]`)
          } else {
            writer.write(`${name}${!p.required || optional ? '?':''}: any[]`)
          }
        } else {
          writer.write(`${name}${!p.required || optional ? '?':''}: any[]`)
        }
      } else {
        writer.write(`${p.name}${!p.required || optional ? '?':''}: any`)
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

   /**
   * 检查并移除泛型箭头
   * @param name 
   */
  checkAndModifyModelName(name: string): false | ModelStruct {
    const parser = new ModelNameParser(name, this.context.generic || [])
    parser.parse()
    const struct = parser.getData()
    const generic = ["List", "Map"]
    if (generic.some(g => g === struct.name)) {
      return false
    }
    return struct
  }

  getModelType(name: string): [boolean, ModelNameParser] {
    const parser = new ModelNameParser(name, this.context.generic || [])
    parser.parse()
    const struct = parser.getData()
    // console.log(this.context.generic)
    if (struct && this.context.generic.some(g => g === struct.name)) {
      return [true, parser]
    } else {
      return [false, parser]
    }
  }

  getRelativePath(model: string) {
    return `./${this.context.fileMap[model]}`
  }

  importGeneric(data: ModelStruct, imports: ImportDeclarationStructure[]) {
    data.children
      .forEach(i => {
        if (filterList.indexOf(i.name) === -1) {
          const importName = i.name
          const moduleSpecifier = this.getRelativePath(i.name)
          if (!imports.some(i => i.moduleSpecifier === moduleSpecifier)) {
            imports.push({
              moduleSpecifier,
              defaultImport: importName
            })
          }
        }
        this.importGeneric(i, imports)
      })
  }

  _checkAndAddImport(ref: string, imports: ImportDeclarationStructure[], exclude: string[] = []) {
    const [isGeneric, parser] = this.getModelType(ref)
    if (isGeneric) {
      const data = parser.getData()
      const moduleSpecifier = this.getRelativePath(data.name)
      const importName = data.name
      if (!exclude.some(name => name === ref ) && !imports.some(i => i.moduleSpecifier === moduleSpecifier)) {
        imports.push({
          moduleSpecifier,
          defaultImport: importName
        })
      }
      this.importGeneric(data, imports)
      return importName
    } else {
      const importName = parser.asString()
      const moduleSpecifier = this.getRelativePath(importName)

      if (!exclude.some(name => name === ref ) && !imports.some(i => i.moduleSpecifier === moduleSpecifier)) {
        imports.push({
          moduleSpecifier,
          defaultImport: importName
        })
      }
      return importName
    }
  }

  _checkAndReturnType(ref: string, imports: ImportDeclarationStructure[], exclude: string[] = [], unpack: boolean = false) {
    const [isGeneric, parser] = this.getModelType(ref)
    if (isGeneric) {
      if(unpack) {
        parser.unpack()
      }
      const data = parser.getData()
      const moduleSpecifier = this.getRelativePath(data.name)
      const importName = parser.asGenericString()
      if (!exclude.some(name => name === ref ) 
          && !imports.some(i => i.moduleSpecifier === moduleSpecifier) 
            && filterList.indexOf(data.name) === -1) {
        imports.push({
          moduleSpecifier,
          defaultImport: data.name
        })
      }
      this.importGeneric(data, imports)
      return importName
    } else {
      const importName = parser.asString()
      const moduleSpecifier = this.getRelativePath(importName)

      if (!exclude.some(name => name === ref ) && !imports.some(i => i.moduleSpecifier === moduleSpecifier)) {
        imports.push({
          moduleSpecifier,
          defaultImport: importName
        })
      }
      return importName
    }
  }

  checkAndAddImport(ref: string, imports: ImportDeclarationStructure[], exclude: string[] = []) {
    return this._checkAndAddImport(ref.slice('#/definitions/'.length), imports, exclude)
  }

  checkAndReturnType(ref: string, imports: ImportDeclarationStructure[], exclude: string[] = [], unpack: boolean = false) {
    return this._checkAndReturnType(ref.slice('#/definitions/'.length), imports, exclude, unpack)
  }
}