import { join } from 'path'
import {
  CodeBlockWriter,
  ImportDeclarationStructure,
  InterfaceDeclarationStructure,
  Project,
  PropertyDeclarationStructure,
  PropertySignatureStructure,
  StructureKind,
} from 'ts-morph'
import BaseTool from './baseTool'
import { Context, SwaggerDefinition } from './types'
import { scalarType } from './utils/enum'
import fs from 'fs'
import Generator from './generator'
import { ParseError } from './exception/ParseError'
import { createDebugLogger } from './utils/log'
import { ModelStruct } from './utils/modelNameParser'

const logger = createDebugLogger("ModelFile")

export default class ModelFile extends BaseTool {
  private imports: ImportDeclarationStructure[] = []
  private modelName: string
  private definition: SwaggerDefinition

  constructor(
    context: Context,
    project: Project,
    modelName: string,
    definition: SwaggerDefinition
  ) {
    super(context, project)
    this.modelName = modelName
    this.definition = definition
  }

  changeCaseName(name: string) {
    return name.replace('-', '_')
  }

  create() {
    const definition = this.definition
    const map = this.context.fileMap

    let struct: ModelStruct | false = false
    let modelNamesMap = this.context.config.modelNames || {}
    const modelName = modelNamesMap[this.modelName] || this.modelName
    try {
      struct = this.checkAndModifyModelName(modelName)
    } catch(e: unknown){
      if(e instanceof ParseError){
        logger.warning("【%s】生成模型文件失败！请联系后端修改模型名称, 或者在配置文件中modelNames选项中添加映射", e.message)
      } else {
        throw e
      }
      return
    }

    if (struct !== false) {
      const name = this.changeCaseName(struct.name)
      if (struct.children.length > 0) {
        const path = join(this.context.outDir, `model/${name}.ts`)
        if (fs.existsSync(path)) {
          fs.unlinkSync(path)
        }
        const properties = this.getProperties(definition, true)

        if (this.context.generic.includes(name)) {
          return
        }
        this.context.generic.push(name)

        const interfaces: InterfaceDeclarationStructure[] = [
          {
            kind: StructureKind.Interface,
            name: `${name}<T>`,
            properties: properties,
            isDefaultExport: true,
            docs: definition.description ? [definition.description] : [],
          },
        ]

        this.project.createSourceFile(path, {
          statements: [...this.imports, ...interfaces],
        })
      } else {
        if (this.context.generic.includes(modelName)) {
          return
        }
        const name = this.changeCaseName(modelName)
        const path = join(
          this.context.outDir,
          `model/${this.changeCaseName(map[modelName] || modelName)}.ts`
        )
        if (fs.existsSync(path)) {
          fs.unlinkSync(path)
        }
        const properties = this.getProperties(definition)
        const interfaces: InterfaceDeclarationStructure[] = [
          {
            kind: StructureKind.Interface,
            name: name,
            properties: properties,
            isDefaultExport: true,
            docs: definition.description ? [definition.description] : [],
          },
        ]
        this.project.createSourceFile(path, {
          statements: [...this.imports, ...interfaces],
        })
      }
    }
  }

  getProperties(definition: SwaggerDefinition, generic = false) {
    const modelName = this.modelName
    const that = this

    const properties: PropertySignatureStructure[] = []
    if (definition.type === 'object') {
      let requiredList = Array.isArray(definition.required)
        ? definition.required
        : []
      for (let propName in definition.properties) {
        const prop = definition.properties[propName]
        // const type: PropertyDeclarationStructure["type"] | null = this.handleProp(prop, generic, (writer, callback) => {
        //   callback()
        // });

        const thunk = () => {
          const funcs: Function[] = []
          const generator = new Generator()
          generator.addEventListener('*:start', (prop, deep) => {
            if (deep > 1 && prop.name) {
              funcs.push((writer: CodeBlockWriter) =>
                writer.write(prop.name + ': ')
              )
            }
          })
          generator.addEventListener('*:end', (prop, deep) => {
            if (deep > 2 && prop.name) {
              funcs.push((writer: CodeBlockWriter) => writer.write(', '))
            }
          })
          generator.addEventListener('object:start', (prop) => {
            if (prop.properties) {
              funcs.push((writer: CodeBlockWriter) => writer.write('{ '))
            } else if (prop.additionalProperties) {
              funcs.push((writer: CodeBlockWriter) =>
                writer.write('Record<string, ')
              )
            } else {
              funcs.push((writer: CodeBlockWriter) => writer.write('any'))
            }
          })
          generator.addEventListener('object:end', (prop) => {
            if (prop.properties) {
              funcs.push((writer: CodeBlockWriter) => writer.write(' }'))
            }
            if (prop.additionalProperties) {
              funcs.push((writer: CodeBlockWriter) => writer.write('>'))
            }
          })
          generator.addEventListener('array:start', () => {})
          generator.addEventListener('array:end', () => {
            funcs.push((writer: CodeBlockWriter) => writer.write('[]'))
          })
          generator.addEventListener('scalar', (prop) => {
            if (prop.type) {
              let type: string
              if (prop.type === scalarType.string && Array.isArray(prop.enum)) {
                type = prop.enum.map((x) => `'${x}'`).join(' | ')
              } else {
                type = Reflect.get(scalarType, prop.type)
              }
              funcs.push((writer: CodeBlockWriter) => writer.write(type))
            }
          })
          generator.addEventListener('ref', (prop) => {
            if (!this.context.imports.includes(prop.$ref)) {
              this.context.imports.push(prop.$ref)
            }
            if (!generic) {
              const type = this.checkAndAddImport(
                prop.$ref,
                that.imports,
                modelName ? [modelName] : []
              )
              logger.debug("modelName: %s, type: %s, imports: %O", modelName, type, that.imports)
              funcs.push((writer: CodeBlockWriter) => writer.write(type))
            } else {
              funcs.push((writer: CodeBlockWriter) => writer.write('T'))
            }
          })

          generator.handleProp2(prop)

          return (writer: CodeBlockWriter) => {
            funcs.forEach((func) => func.call(null, writer))
          }
        }

        const type: PropertyDeclarationStructure['type'] = thunk()

        properties.push({
          kind: StructureKind.PropertySignature,
          name:
            propName +
            (requiredList.includes(propName) || prop.required ? '' : '?'),
          type,
          docs: prop.description ? [prop.description] : [],
        })
      }
    }
    logger.debug("modelName: %s, imports: %O", modelName, that.imports)
    return properties
  }
}
