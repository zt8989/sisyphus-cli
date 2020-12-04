import { join } from "path";
import { CodeBlockWriter, ImportDeclarationStructure, InterfaceDeclarationStructure, Project, PropertyDeclarationStructure, PropertySignatureStructure, StructureKind } from "ts-morph";
import BaseTool from "./baseTool";
import { Context, SwaggerDefinition, SwaggerProperty } from "./types";
import { scalarType } from "./utils/enum";
import fs from 'fs'

const logger = require('debug')('model')

export default class ModelFile extends BaseTool {
  private imports: ImportDeclarationStructure[] = []
  private modelName: string
  private definition: SwaggerDefinition

  constructor(context: Context, project: Project, modelName: string, definition: SwaggerDefinition){
    super(context, project)
    this.modelName = modelName
    this.definition = definition
  }

  create(){
    const modelName = this.modelName
    const definition = this.definition
    const map = this.context.fileMap

    let struct = this.checkAndModifyModelName(modelName);

    if (struct !== false) {
      const name = struct.name;
      if (struct.children.length > 0) {
        const path = join(this.context.outDir, `model/${name}.ts`);
        if (fs.existsSync(path)) {
          fs.unlinkSync(path);
        }
        const imports: ImportDeclarationStructure[] = [];
        const properties = this.getProperties(definition, true);

        if(this.context.generic.includes(name)) {
          return
        }
        this.context.generic.push(name)

        const interfaces: InterfaceDeclarationStructure[] = [{
          kind: StructureKind.Interface,
          name: `${name}<T>`,
          properties: properties,
          isDefaultExport: true,
          docs: definition.description ? [definition.description] : []
        }]

        this.project.createSourceFile(path, {
          statements: [
            ...imports,
            ...interfaces
          ]
        });
      } else {
        if(this.context.generic.includes(modelName)){
          return
        }
        const path = join(this.context.outDir, `model/${map[modelName] || modelName}.ts`);
        if (fs.existsSync(path)) {
          fs.unlinkSync(path);
        }
        const properties = this.getProperties(definition);
        const interfaces: InterfaceDeclarationStructure[] = [
          {
            kind: StructureKind.Interface,
            name: modelName,
            properties: properties,
            isDefaultExport: true,
            docs: definition.description ? [definition.description] : []
          }
        ]
        this.project.createSourceFile(path, {
          statements: [...this.imports, ...interfaces]
        });
      }
    }
  }

  handleProp(prop: SwaggerProperty, generic: boolean, typeMapper: (writer: CodeBlockWriter, callback: () => void) => void): PropertyDeclarationStructure["type"] | null {
    const modelName = this.modelName
    const imports = this.imports
    if (prop.$ref) {
      if(!this.context.imports.includes(prop.$ref)){
        this.context.imports.push(prop.$ref)
      }
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
        return this.handleProp(prop.items, generic, (writer, callback) => {
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
          return this.handleProp(prop.additionalProperties, generic, (writer, callback) => {
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

  getProperties(definition: SwaggerDefinition, generic = false) {
    const properties: PropertySignatureStructure[] = []
    if (definition.type === "object") {
      for (let propName in definition.properties) {
        const prop = definition.properties[propName]
        const type: PropertyDeclarationStructure["type"] | null = this.handleProp(prop, generic, (writer, callback) => {
          callback()
        });
        if(type) {
          properties.push({
            kind: StructureKind.PropertySignature,
            name: propName,
            type,
            docs: prop.description ? [prop.description] : []
          })
        }
      }
    }
    logger(this.imports)
    return properties
  }
}