import {
  CodeBlockWriter,
  ImportDeclarationStructure,
  ParameterDeclarationStructure,
} from "ts-morph";
import ApiTool from "../api";
import {
  SwaggerJson,
  SwaggerParameter,
  SwaggerRequestV3,
  SwaggerTypes,
} from "../types";
import { getSchemaFromRef, writeTypes } from "./schema.bs";

export default class ApiToolV3 extends ApiTool<SwaggerTypes<SwaggerRequestV3>> {
  writePathTypes(
    parameters: SwaggerParameter[],
    writer: CodeBlockWriter,
    optional: boolean = false
  ) {
    writeTypes(parameters, writer, getSchemaFromRef.bind(null, this.data));
  }

  writeTypes(
    parameters: SwaggerParameter[],
    writer: CodeBlockWriter,
    optional: boolean = false
  ) {
    writeTypes(parameters, writer, getSchemaFromRef.bind(null, this.data));
  }

  getBodyParams(
    path: SwaggerRequestV3,
    imports: ImportDeclarationStructure[],
    docs: string[],
    headers: { [key: string]: string },
    result: Record<string, ParameterDeclarationStructure>
  ) {
    path?.requestBody?.content?.["application/json"] &&
      this.handleRequestBody(
        path?.requestBody?.content?.["application/json"] as any,
        imports,
        docs,
        result
      );
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

  getReturnType(
    path: SwaggerRequestV3,
    imports: ImportDeclarationStructure[],
    data: SwaggerJson
  ) {
    const dataKey = this.context.config.dataKey;
    if (path.responses[200]) {
      let schema = path.responses[200].content["*/*"].schema;
      if (schema && schema.$ref) {
        let ref = schema.$ref;
        if (dataKey) {
          const define = getSchemaFromRef(data, ref);
          let schema = define.properties[dataKey];
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
}
