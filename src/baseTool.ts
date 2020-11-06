import { Context } from "./index";
import ModelNameParser, { ModelStruct } from "./utils/modelNameParser";
import { ImportDeclarationStructure } from "ts-simple-ast";

const filterList = ['object', 'long', 'boolean', 'integer', 'List', 'Map', 'string', 'Void', 'int']

export default class BaseTool {
  protected context: Context

  constructor(context: Context) {
    this.context = context
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

  getModelType(name: string): [boolean, ModelNameParser] {
    const parser = new ModelNameParser(name, this.context.config.generic || [])
    parser.parse()
    const struct = parser.getData()
    if (struct && this.context.config.generic && this.context.config.generic.some(g => g === struct.name)) {
      return [true, parser]
    } else {
      return [false, parser]
    }
  }

  getRelativePath(model: string) {
    return `./${model}`
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