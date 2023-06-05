import {
  PropertyDeclarationStructure,
  ImportDeclarationStructure,
  FunctionDeclarationStructure,
  ParameterDeclarationStructure,
  CodeBlockWriter,
  EnumDeclarationStructure,
  StructureKind,
  Project,
  WriterFunction,
  VariableStatementStructure,
  ExportAssignmentStructure,
  VariableDeclarationKind,
  OptionalKind,
  VariableDeclarationStructure,
} from "ts-morph";
import fs from "fs";
import { scalarType } from "./utils/enum";
import BaseTool from "./baseTool";
import { BODY_PARAMS, QUERY_PARAMS, PATH_PARAMS } from "./constants";
import { join, parse, posix } from "path";
import * as changeCase from "change-case";
import {
  Context,
  RenameOption,
  SwaggerDefinition,
  SwaggerParameter,
  SwaggerRequest,
  SwaggerRequestV2,
  SwaggerTypes,
} from "./types";
import ModelFile from "./modelFile";
import Faker from "./faker";
import beautify from "json-beautify";
import { getSchemaFromRef } from "./v3/schema.bs";
import { getDesc } from "./api.bs";

const retainWord = ["delete"];

export default class ApiTool<
  T extends SwaggerTypes<any> = SwaggerTypes<SwaggerRequestV2>
> extends BaseTool {
  protected data: T["swaggerJson"];

  constructor(context: Context, project: Project, data: T["swaggerJson"]) {
    super(context, project);
    this.data = data;
  }

  private mockObject: Record<string, any> = {};

  handleOperationId(option: RenameOption) {
    const { swaggerRequest, tagName } = option;
    if (this.context.config.nameStrategy) {
      return this.context.config.nameStrategy(option, changeCase);
    }
    let id = swaggerRequest.operationId;
    let newId = swaggerRequest.operationId;
    const preg = /Using\w+(_\d+)?$/;
    if (preg.test(id)) {
      const match = id.match(preg);
      if (match) {
        newId = id.slice(0, match.index);
      }
    }
    // 如果是保留字，则加上组名
    if (retainWord.indexOf(newId) !== -1) {
      newId = newId + tagName;
    }
    return newId;
  }

  /**
   * 预先加载泛型类
   */
  importGenerics(imports: ImportDeclarationStructure[]) {
    (this.context.generic || []).forEach((g) => {
      this._checkAndAddImport(g, imports);
    });
  }

  getTag(tag: string) {
    const configTags = this.context.config.tags;
    if (configTags) {
      return configTags[tag] || tag;
    }
    return tag;
  }

  genUrls(tags: { name: string; value: string }[]) {
    const data = this.data;

    return tags.map((x) => {
      const paths = data.paths;
      let urls: string[] = [];
      for (let url in paths) {
        const methods = paths[url];
        for (let method in methods) {
          const request = methods[method];
          if (request.tags.includes(x.value)) {
            const fullUrl = this.getFullUrl(data.basePath, url);
            urls.push(fullUrl);
          }
        }
      }
      return { ...x, urls };
    });
  }

  async genApis(tags: string[]) {
    const data = this.data;
    const project = this.project;
    // this.createRequestFile(project)
    if (this.context.config.createTags) {
      this.createTags(data);
    }

    const defaultImports: ImportDeclarationStructure[] = [
      {
        moduleSpecifier: this.context.config.requestPath || "",
        kind: StructureKind.ImportDeclaration,
        namedImports: ["bindUrl", "request"],
      },
    ];

    for (let tag of tags) {
      const tagName = this.getTag(tag);

      const URLS_ENUM_NAME = tagName + "_URLS";
      const members: EnumDeclarationStructure["members"] = []
      // const urlsEnum: EnumDeclarationStructure = {
      //   name: URLS_ENUM_NAME,
      //   isExported: true,
      //   members: members,
      //   kind: StructureKind.Enum,
      // };

      const urlsRecord: VariableStatementStructure = {
        declarationKind: VariableDeclarationKind.Const,
        declarations: [{
          name: URLS_ENUM_NAME,
          initializer: writer => {
            writer.writeLine("{")
            members.forEach(m => {
              m.docs?.forEach(d => {
                writer.writeLine(`/** ${d} */`)
              })
              writer.writeLine(`${m.name}: '${m.value}',`)
            })
            writer.writeLine("}")
          }
        }],
        isExported: true,
        // leadingTrivia: "abc",
        // trailingTrivia: "efg",
        kind: StructureKind.VariableStatement
      }

      const paths = data.paths;
      const functions: (FunctionDeclarationStructure | WriterFunction)[] = [];

      const imports: ImportDeclarationStructure[] = [...defaultImports];

      for (let url in paths) {
        const methods = paths[url];
        for (let method in methods) {
          if (methods[method].tags.indexOf(tag) === -1) {
            break;
          }
          const docs: string[] = [];
          const headers: { [key: string]: string } = {};
          if (methods[method].summary) {
            docs.push(methods[method].summary);
          }
          if (methods[method].description) {
            docs.push(methods[method].description);
          }

          const methodName = this.handleOperationId({
            swaggerRequest: methods[method],
            tagName,
            url,
            method,
            parsedPath: parse(url),
          });

          const fullUrl = this.getFullUrl(data.basePath, url);
          // @ts-ignore
          members.push({
            name: methodName,
            value: fullUrl,
            docs: [...docs],
          });

          docs.push(
            `${method.toUpperCase()} ${this.getFullUrl(data.basePath, url)}`
          );

          if (methods[method]?.deprecated === true) {
            docs.push(`@deprecated`);
          }

          const parameters = this.getParameters(
            methods[method],
            imports,
            docs,
            headers,
            methodName
          );
          const isDownload = this.isDownloadApi(methods[method]);

          const returnType = this.getReturnType(methods[method], imports, data);
          functions.push({
            kind: StructureKind.Function,
            name:
              methodName +
              "<T = " +
              returnType +
              (returnType !== "any" && this.context.config.responseNullable
                ? " | null"
                : "") +
              ">",
            parameters: this.handleFunctionParameters(parameters),
            returnType: this.getReturn(methods[method], imports, data),
            statements: (writer) => {
              writer
                .writeLine(`return request({`)
                .setIndentationLevel(2)
                .writeLine(
                  `url: bindUrl(${URLS_ENUM_NAME}.${methodName}, ${
                    parameters.hasOwnProperty(PATH_PARAMS) ? PATH_PARAMS : "{}"
                  }),`
                )
                .writeLine(`method: '${method.toUpperCase()}',`)
                .conditionalWriteLine(
                  parameters.hasOwnProperty(BODY_PARAMS),
                  () => `data: ${BODY_PARAMS},`
                )
                .conditionalWriteLine(
                  parameters.hasOwnProperty(QUERY_PARAMS),
                  () => `params: ${QUERY_PARAMS},`
                )
                .conditionalWriteLine(
                  Object.keys(headers).length > 0,
                  () => `headers: ${JSON.stringify(headers)},`
                )
                .conditionalWriteLine(isDownload, () => `responseType: 'blob',`)
                .conditionalWriteLine(
                  this.context.config.appendOptions,
                  () => "...options"
                )
                .setIndentationLevel(1)
                .writeLine("})");
            },
            docs: docs.length > 0 ? [docs.join("\n")] : [],
            isExported: true,
          });

          // functions.push(writer => writer.writeLine(`${methodName}.args = ${Object.keys(parameters).length}`))
        }
      }

      const path = this.getApiPath(tagName)
      project.createSourceFile(path, {
        statements: [...imports, urlsRecord, ...functions],
      });
    }
  }

  getFullUrl(baseUrl: string = "/", url: string = "") {
    if (this.context.config.formatUrl) {
      return this.context.config.formatUrl(baseUrl, url);
    }
    return posix.join(baseUrl, url);
  }

  async genMocks(tags: string[]) {
    const data = this.data;
    const project = this.project;

    for (let tag of tags) {
      const tagName = this.getTag(tag);
      const paths = data.paths;

      for (let url in paths) {
        const methods = paths[url];
        for (let method in methods) {
          if (methods[method].tags.indexOf(tag) === -1) {
            break;
          }
          const fullUrl = this.getFullUrl(data.basePath, url);

          const mockData = this.getMockData(methods[method], data);
          this.mockObject[`${method.toUpperCase()} ${fullUrl}`] = mockData;
        }
      }

      const mockPath = join(process.cwd(), "mock", `${tagName}.js`);
      if (fs.existsSync(mockPath)) {
        fs.unlinkSync(mockPath);
      }
      project.createSourceFile(mockPath, (writer: CodeBlockWriter) => {
        writer.writeLine(`const mockjs = require("mockjs")`);
        writer.write(
          `const mockData = ${beautify(this.mockObject, null as any, 2, 100)}`
        );
        writer.writeLine("");
        writer.writeLine("module.exports = {");
        Object.keys(this.mockObject).forEach((url) => {
          writer.writeLine(`  "${url}": (req, res) => {`);
          writer.write(`    res.json(mockjs.mock(mockData['${url}']))`);
          writer.writeLine(`  },`);
        });
        writer.writeLine("}");
      });
    }
  }

  /**
   * 处理方法参数
   */
  handleFunctionParameters(parameters: {
    [key: string]: ParameterDeclarationStructure;
  }) {
    return Object.keys(parameters).map((x) => parameters[x]);
  }

  getMockData(path: T["request"], data: T["swaggerJson"]) {
    const faker = new Faker(data);
    if (path.responses[200]) {
      let schema = path.responses[200].schema;
      if (schema && schema.$ref) {
        let ref = schema.$ref;
        const define = getSchemaFromRef(data, ref);
        faker.fake(ref, define);
      } else {
        // other
      }
    }
    if (
      this.context.config.mockOverwrite &&
      typeof this.context.config.mockOverwrite === "function"
    ) {
      return this.context.config.mockOverwrite({
        response: faker.getObj(),
      });
    }
    return faker.getObj();
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
  writePathTypes(
    parameters: SwaggerParameter[],
    writer: CodeBlockWriter,
    optional: boolean = false
  ) {
    this.writeTypes(parameters, writer);
  }

  getParameters(
    path: SwaggerRequest,
    imports: ImportDeclarationStructure[],
    docs: string[],
    headers: { [key: string]: string },
    methodName: string
  ) {
    const result: Record<string, ParameterDeclarationStructure> = {};
    const parameters = path.parameters || [];

    const pathParameters = parameters.filter((x) => x.in === "path");
    if (pathParameters.length > 0) {
      const name = PATH_PARAMS;
      docs.push(`@param {Object} ${name}`);
      this.getParameterDocs(name, pathParameters, docs);
      result[name] = {
        kind: StructureKind.Parameter,
        name,
        type: (writer: CodeBlockWriter) => {
          writer.write("{ ");
          this.writePathTypes(pathParameters, writer);
          writer.write(" }");
        },
      };
    }

    const allQueryParameters = parameters.filter((x) => x.in === "query");
    {
      const queryParameters = allQueryParameters.filter((x) => x?.schema?.$ref);
      queryParameters.forEach((x) => {
        let type: string = "any";
        if (getSchemaFromRef(this.data, x?.schema?.$ref)) {
          type = this.checkAndAddImport(x?.schema?.$ref!, imports);
        }
        result[QUERY_PARAMS] = {
          kind: StructureKind.Parameter,
          name: QUERY_PARAMS,
          type,
        };
        docs.push(`@param {${type}} ${QUERY_PARAMS} - ${x.description}`);
      });
    }
    {
      const queryParameters = allQueryParameters.filter(
        (x) => !x?.schema?.$ref
      );
      if (queryParameters.length > 0) {
        const name = "queryParams";

        if (
          queryParameters.length > 2 ||
          queryParameters.some((x) => x.name.includes("."))
        ) {
          const fileName = methodName + "Query";
          const typeName = fileName[0].toUpperCase() + fileName.slice(1);
          const define: SwaggerDefinition = {
            type: "object",
            required: true,
            properties: {},
            title: typeName,
            description: typeName,
          };
          docs.push(`@param {${typeName}} ${name}`);
          queryParameters.forEach((x) => {
            if (x.name.indexOf(".") !== -1) {
              const splitNames = x.name.split(".");
              let ref: any = define.properties;
              splitNames.forEach((oriName, index, array) => {
                let name = oriName;
                if (array.length - 1 === index) {
                  ref[name] = {
                    ...x,
                    name,
                  };
                  return;
                }
                if (oriName.endsWith("[0]")) {
                  name = oriName.slice(0, oriName.length - 3);
                  if (!ref[name]) {
                    ref[name] = {
                      type: "array",
                      name: index > 0 && name,
                      items: {
                        type: "object",
                        properties: {},
                      },
                    } as any;
                  }
                  ref = ref[name]["items"]["properties"];
                } else {
                  if (!ref[name]) {
                    ref[name] = {
                      name: index > 0 && name,
                      type: "object",
                      properties: {},
                    };
                  }
                  ref = ref[name]["properties"];
                }
              });
              // const name = splitNames[0]
              // const childName = splitNames[1]
              // if(define.properties[name]) {
              //   // @ts-ignore
              //   define.properties[name]["items"]["properties"][childName] = {
              //     ...x,
              //     name: childName
              //   }
              // } else {
              //   define.properties[name] = {
              //     type: "array",
              //     items: {
              //       type: "object",
              //       properties: {
              //         [childName]: {
              //           ...x,
              //           name: childName
              //         }
              //       }
              //     }
              //   } as any
              // }
            } else {
              define.properties[x.name] = x as any;
            }
          });
          new ModelFile(
            { ...this.context, imports: [] },
            this.project,
            typeName,
            define
          ).create();
          result[name] = {
            kind: StructureKind.Parameter,
            name: name,
            type: typeName,
          };
          imports.push({
            kind: StructureKind.ImportDeclaration,
            moduleSpecifier: this.getRelativePath(typeName),
            defaultImport: typeName,
          });
        } else {
          docs.push(`@param {Object} ${name}`);
          this.getParameterDocs(name, queryParameters, docs);
          result[name] = {
            kind: StructureKind.Parameter,
            name,
            type: (writer: CodeBlockWriter) => {
              writer.write("{ ");
              this.writeTypes(
                queryParameters,
                writer,
                this.context.config.optionalQuery
              );
              writer.write(" }");
            },
          };
        }
      }

      this.getBodyParams(path, imports, docs, headers, result);
    }

    if (this.context.config.appendOptions) {
      result["options"] = {
        kind: StructureKind.Parameter,
        name: "options?",
        type: "any",
      };
    }
    return result;
  }

  getBodyParams(
    path: SwaggerRequest,
    imports: ImportDeclarationStructure[],
    docs: string[],
    headers: { [key: string]: string },
    result: Record<string, ParameterDeclarationStructure>
  ) {
    for (let param of path.parameters || []) {
      if (param.in === "body") {
        this.handleRequestBody(param, imports, docs, result);
      } else if (param.in === "formData") {
        this.handleFormData(param, headers, docs, result);
      } else {
        // other
      }
    }
  }

  handleFormData(
    param: SwaggerParameter,
    headers: { [key: string]: string },
    docs: string[],
    result: Record<string, ParameterDeclarationStructure>
  ) {
    // api包含formData：如文件
    if (param.type === "file") {
      result["bodyParams"] = {
        kind: StructureKind.Parameter,
        name: "bodyParams",
        type: "FormData",
      };
      docs.push(`@param FormData bodyParams - ${param.description}`);
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }
  }

  handleRequestBody(
    param: SwaggerParameter,
    imports: ImportDeclarationStructure[],
    docs: string[],
    result: Record<string, ParameterDeclarationStructure>
  ) {
    if (param?.schema?.$ref) {
      let type: string = "any";
      if (getSchemaFromRef(this.data, param.schema.$ref)) {
        type = this.checkAndAddImport(param.schema.$ref, imports);
      }
      result[BODY_PARAMS] = {
        kind: StructureKind.Parameter,
        name: BODY_PARAMS,
        type,
      };
      docs.push(`@param {${type}} ${BODY_PARAMS} - ${getDesc(param)}`);
    } else if (
      param?.schema?.type &&
      Reflect.has(scalarType, param?.schema?.type ?? "")
    ) {
      result[BODY_PARAMS] = {
        kind: StructureKind.Parameter,
        name: BODY_PARAMS,
        type: scalarType[param.schema.type ?? ""],
      };
      docs.push(
        `@param {${scalarType[param.schema.type ?? ""]}} ${BODY_PARAMS} - ${
          param.description
        }`
      );
    } else if (param?.schema?.type === "array") {
      if (param?.schema?.items?.$ref) {
        // 其他类型参数-array
        const type = this.checkAndAddImport(param.schema.items.$ref, imports);
        result[BODY_PARAMS] = {
          kind: StructureKind.Parameter,
          name: BODY_PARAMS,
          type: type + "[]",
        };
        docs.push(`@param {${type}[]} ${BODY_PARAMS} - ${param.description}`);
      } else if (
        param?.schema?.items?.type &&
        scalarType[param.schema.items.type ?? ""]
      ) {
        result[BODY_PARAMS] = {
          kind: StructureKind.Parameter,
          name: BODY_PARAMS,
          type: scalarType[param.schema.items.type ?? ""] + "[]",
        };
        docs.push(
          `@param {${
            scalarType[param.schema.items.type ?? ""]
          }[]} ${BODY_PARAMS} - ${param.description}`
        );
      } else {
        result[BODY_PARAMS] = {
          kind: StructureKind.Parameter,
          name: BODY_PARAMS,
          type: "any[]",
        };
        docs.push(`@param {any[]} ${BODY_PARAMS} - ${param.description}`);
      }
    } else if (param?.schema?.type === "object") {
      result[BODY_PARAMS] = {
        kind: StructureKind.Parameter,
        name: BODY_PARAMS,
        type: "any",
      };
      docs.push(`@param any ${BODY_PARAMS} - ${param.description}`);
    } else {
      // 其他类型参数-object
      result[BODY_PARAMS] = {
        kind: StructureKind.Parameter,
        name: BODY_PARAMS,
        type: "any",
      };
      docs.push(`@param any ${BODY_PARAMS} - ${param.description}`);
    }
  }

  isDownloadApi(path: T["request"]) {
    // 下载相关接口
    if (path.responses[200]) {
      const schema = path.responses[200].schema;
      if (schema && schema.type === "file") {
        return true;
      } else {
        // other
      }
    }
    return false;
  }

  getParameterDocs(
    name: string,
    parameters: SwaggerParameter[],
    docs: string[]
  ) {
    const addDocs = (type: string, name: string, desc: string = "") => {
      docs.push(`@param {${type}} ${name} - ${desc}`);
    };

    parameters.forEach((p) => {
      if (Reflect.has(scalarType, p.type ?? "")) {
        addDocs(
          Reflect.get(scalarType, p.type ?? ""),
          `${name}.${p.name}`,
          p.description
        );
      } else if (p.type === "array") {
        if (p.items) {
          if (Reflect.has(scalarType, p?.items?.type ?? "")) {
            addDocs(
              `${Reflect.get(scalarType, p?.items?.type ?? "")}[]`,
              `${name}.${p.name}`,
              p.description
            );
          }
        }
      } else {
        addDocs("*", `${name}.${p.name}`, p.description);
      }
    });
  }

  createTags(data: T["swaggerJson"]) {
    const path = `./tags.json`;
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
    const map: { [key: string]: string } = {};
    data.tags.forEach((x) => {
      map[x.name] = x.name;
    });

    fs.writeFileSync(path, JSON.stringify(map, null, "\n"));
  }

  getReturn(
    path: SwaggerRequest,
    imports: ImportDeclarationStructure[],
    data: T["swaggerJson"]
  ) {
    return "Promise<T>";
  }

  getReturnType(
    path: T["request"],
    imports: ImportDeclarationStructure[],
    data: T["swaggerJson"]
  ) {
    if (path.responses[200]) {
      let schema = path.responses[200].schema;
      if (schema && schema.$ref) {
        let ref = schema.$ref;
        if (this.context.config.dataKey) {
          const define = getSchemaFromRef(data, ref);
          let schema = define.properties[this.context.config.dataKey];
          if (schema && schema.$ref) {
            const type = this.checkAndAddImport(schema.$ref, imports, []);
            return type;
          }
          if (schema && schema.type === "array" && schema.items.$ref) {
            const type = this.checkAndAddImport(schema.items.$ref, imports, []);
            return type + "[]";
          }
        } else {
          const type = this.checkAndAddImport(schema.$ref, imports, []);
          return type;
        }
      } else {
        // other
      }
    }
    return "any";
  }

  getProperties(
    definition: SwaggerDefinition,
    imports: ImportDeclarationStructure[]
  ) {
    const properties: PropertyDeclarationStructure[] = [];
    if (definition.type === "object") {
      for (let propName in definition.properties) {
        const prop = definition.properties[propName];
        if (prop.$ref) {
          const type = this.checkAndAddImport(prop.$ref, imports);
          properties.push({
            kind: StructureKind.Property,
            name: propName,
            type,
            docs: prop.description ? [prop.description] : [],
          });
        }

        if (prop.type) {
          if (Reflect.has(scalarType, prop.type)) {
            properties.push({
              kind: StructureKind.Property,
              name: propName,
              type: Reflect.get(scalarType, prop.type),
              docs: prop.description ? [prop.description] : [],
            });
          } else if (prop.type === "array") {
            if (prop?.items?.$ref) {
              const type = this.checkAndAddImport(prop.items.$ref, imports);
              properties.push({
                kind: StructureKind.Property,
                name: propName,
                type: `${type}[]`,
                docs: prop.description ? [prop.description] : [],
              });
            } else if (
              prop?.items?.type &&
              Reflect.has(scalarType, prop.items.type ?? "")
            ) {
              properties.push({
                kind: StructureKind.Property,
                name: propName,
                type: `${Reflect.get(scalarType, prop.items.type ?? "")}[]`,
                docs: prop.description ? [prop.description] : [],
              });
            } else if (prop?.items?.type === "array") {
              if (prop?.items?.items?.$ref) {
                const type = this.checkAndAddImport(
                  prop.items.items.$ref,
                  imports
                );
                properties.push({
                  kind: StructureKind.Property,
                  name: propName,
                  type: `${type}[]`,
                  docs: prop.description ? [prop.description] : [],
                });
              }
            }
          } else if (prop.type === "object") {
            properties.push({
              kind: StructureKind.Property,
              name: propName,
              type: "object",
              docs: prop.description ? [prop.description] : [],
            });
          }
        }
      }
    }
    return properties;
  }

  handleArrayProperties() {}

  _getProperties() {}

  getRelativePath(model: string) {
    return `./model/${this.context.fileMap[model] || model}`;
  }
}
