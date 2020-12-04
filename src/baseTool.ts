import ModelNameParser, { ModelStruct } from "./utils/modelNameParser";
import { CodeBlockWriter, ImportDeclarationStructure, Project, PropertyDeclarationStructure, StructureKind } from "ts-morph";
import { scalarType } from "./utils/enum";
import { Context, SwaggerParameter, SwaggerProperty } from "./types";
const logger = require('debug')('api')

const filterList = ['object', 'long', 'boolean', 'integer', 'List', 'Map', 'string', 'Void', 'int']

export default class BaseTool {
  protected context: Context
  protected project: Project

  constructor(context: Context, project: Project) {
    this.context = context
    this.project = project
  }

  writeTypes(parameters: SwaggerParameter[], writer: CodeBlockWriter, optional: boolean = false) {
    const hasQueryArray = (p: SwaggerParameter) => p.in === "query" && p.name.includes('[0].')
    const hasQueryObject = (p: SwaggerParameter) => p.in === "query" && p.name.includes('.') && !p.name.includes('[0].')

    const normalParameters = parameters.filter(p => !hasQueryArray(p) && !hasQueryObject(p))
    normalParameters.forEach((p, i) => {
      writer.write(i === 0 ? '' : ', ')
      if (Reflect.has(scalarType, p.type ?? "")) {
        let type 
        if(p.type === scalarType.string && Array.isArray(p.enum)) {
          type = p.enum.map(x => `'${x}'`).join(' | ')
        } else {
          type = Reflect.get(scalarType, p.type ?? "")
        }
        writer.write(`${p.name}${!p.required || optional ? '?':''}: ${type}`)
      } else if (p.type === 'array') {
        let name = p.name
        if(name.endsWith('[]')) {
          name = `'${name}'`
        }
        if (p.items) {
          if (Reflect.has(scalarType, p?.items?.type ?? "")) {
            writer.write(`${name}${!p.required || optional ? '?':''}: ${Reflect.get(scalarType, p?.items?.type ?? "")}[]`)
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
        writer.write(normalParameters.length === 0 ? '' : ', ')
        writer.write(`${i}: {`)
        this.writeTypes(list[i], writer)
        writer.write(` }[]`)
      }
    }
    {
      const list: { [key: string]: SwaggerParameter[] } = {}
      const seprator = '.'
      const queryObject: SwaggerParameter[] = parameters.filter(hasQueryObject)
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
    if (struct && struct.children.length > 0) {
      return [true, parser]
    } else {
      return [false, parser]
    }
  }

  getRelativePath(model: string) {
    return `./${this.context.fileMap[model] || model}`
  }

  importGeneric(data: ModelStruct, imports: ImportDeclarationStructure[]) {
    data.children
      .forEach(i => {
        if (filterList.indexOf(i.name) === -1) {
          const importName = i.name
          const moduleSpecifier = this.getRelativePath(i.name)
          if (!imports.some(i => i.moduleSpecifier === moduleSpecifier)) {
            imports.push({
              kind: StructureKind.ImportDeclaration,
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
          kind: StructureKind.ImportDeclaration,
          moduleSpecifier,
          defaultImport: importName
        })
      }
      this.importGeneric(data, imports)
      return parser.asGenericString()
    } else {
      const importName = parser.asString()
      const moduleSpecifier = this.getRelativePath(importName)

      if (!exclude.some(name => name === ref ) && !imports.some(i => i.moduleSpecifier === moduleSpecifier)) {
        imports.push({
          kind: StructureKind.ImportDeclaration,
          moduleSpecifier,
          defaultImport: importName
        })
      }
      return importName
    }
  }

  handleObjectProp = (prop: SwaggerProperty) => {
    if(prop.type === 'object') {

    }
  }

  handleArryaProp = (prop: SwaggerProperty) => {
    if(prop.type === 'array') {
      this.handleProps(prop.items)
    }
  }

  handleProps = (prop: SwaggerProperty) => {
    const list = [this.handleArryaProp, this.handleObjectProp]
    list.forEach(handler => handler(prop))
  }

  handleRef = (prop: SwaggerParameter) => {
    
  }

  _handleProp(prop: SwaggerProperty, generic: boolean, imports: ImportDeclarationStructure[], modelName: string, typeMapper: (writer: CodeBlockWriter, callback: () => void) => void): PropertyDeclarationStructure["type"] | null {
    if (prop.$ref) {
      if (!generic) {
        const type = this.checkAndAddImport(prop.$ref, imports, modelName ? [modelName]: []);
        return (writer: CodeBlockWriter) => typeMapper(writer, () => writer.write(type))
      } else {
        return (writer: CodeBlockWriter) => typeMapper(writer, () => writer.write('T'))
      }
    }

    if (prop.type) {
      if (Reflect.has(scalarType, prop.type)) {
        let type: string;
        if (prop.type === scalarType.string && Array.isArray(prop.enum)) {
          type = prop.enum.map(x => `'${x}'`).join(' | ');
        } else {
          type = Reflect.get(scalarType, prop.type);
        }
        return (writer: CodeBlockWriter) => typeMapper(writer, () => writer.write(type))
      } else if (prop.type === 'array') {
        return this._handleProp(prop.items, generic, imports, modelName, (writer, callback) => {
          callback()
          writer.write("[]")
        })
      } else if (prop.type === 'object') {
        if (prop.properties) {
          // @ts-ignore
          const params = Object.keys(prop.properties).map(x => {
            return {
              // @ts-ignore
              ...prop.properties[x],
              name: x
            };
          });
          return (writer: CodeBlockWriter) => typeMapper(writer, () => {
              writer.write("{ ");
              this.writeTypes(params, writer);
              writer.write(" }");
            })
        } else if(prop.additionalProperties) {
          return this._handleProp(prop.additionalProperties, generic, imports, modelName, (writer, callback) => {
            writer.write("Record<string, ")
            callback()
            writer.write(">")
          })
        } else {
          return (writer: CodeBlockWriter) => typeMapper(writer, () => writer.write('any'))
        }
      }
    }
    return null
  }

  _checkAndReturnType(ref: string, imports: ImportDeclarationStructure[], exclude: string[] = []) {
    const [isGeneric, parser] = this.getModelType(ref)
    if (isGeneric) {
      const data = parser.getData()
      const moduleSpecifier = this.getRelativePath(data.name)
      const importName = parser.asGenericString()
      if (!exclude.some(name => name === ref ) 
          && !imports.some(i => i.moduleSpecifier === moduleSpecifier) 
            && filterList.indexOf(data.name) === -1) {
        imports.push({
          kind: StructureKind.ImportDeclaration,
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
          kind: StructureKind.ImportDeclaration,
          moduleSpecifier,
          defaultImport: importName
        })
      }
      return importName
    }
  }

  checkAndAddImport(ref: string, imports: ImportDeclarationStructure[], exclude: string[] = []) {
    const name = this.getModelNameFromRef(ref)
    if(!this.context.imports.includes(ref)){
      this.context.imports.push(ref)
    }
    return this._checkAndAddImport(name, imports, exclude)
  }

  getModelNameFromRef(ref: string){
    return ref.slice('#/definitions/'.length)
  }
}