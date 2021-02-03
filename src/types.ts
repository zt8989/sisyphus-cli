import { ParsedPath } from "path";

export type RenameOption = {
  swaggerRequest: SwaggerRequest, tagName: string, url:string, method:string,
  parsedPath: ParsedPath
}

export interface Context {
  config: ConfigDefinition
  fileMap: Record<string, string>
  outDir: string
  generic: string[],
  imports: string[]
}

export interface ConfigDefinition {
  file: string | { [key: string]: string },
  outDir: string,
  tags?: {
    [key: string]: string
  },
  unpackResponse?: boolean,
  nameStrategy?: (option: RenameOption, changeCase: any) => string,
  optionalQuery?: boolean,
  appendOptions?: boolean
  onlyModel?: boolean
  createTags?: boolean
  requestPath?: string
  onlyTags?: boolean
  dataKey?: string
  mockOverwrite?: (response: any) => any
  formatUrl?: (baseUrl: string, url: string) => string
  responseNullable?: boolean
}

export interface SwaggerJson {
  swagger: string
  info: {
    version: string
    title: string
  }
  basePath: string
  host: string
  definitions: SwaggerDefinitions
  tags: SwaggerTag[]
  paths: Record<string, SwaggerPath>
}

export type SwaggerTag = { name: string, description: string }

export type SwaggerMethod = "get" | "post" | "put" | "delete" | "option"

export type SwaggerPath = Record<string, SwaggerRequest>

export interface SwaggerRequest {
    tags: string[]
    summary: string
    description: string
    operationId: string
    parameters: SwaggerParameter[]
    deprecated?: boolean
    responses: {
      "200": {
        schema: {
          $ref: string
          type: string
        }
      }
    }
}

export type SwaggerParameter = SwaggerQueryParameter | SwaggerBodyParameter | SwaggerPathParameter | SwaggerFormDataParameter

export interface SwaggerBaseInfo {
  name: string
  description: string
  required: boolean
}

export type SwaggerQueryParameter = {
  in: "query"
} & (SwaggerStringType | SwaggerArrayType | SwaggerObjectType | SwaggerFileType | SwaggerEnumType)

export type SwaggerBodyParameter = {
  in: "body"
} & (SwaggerStringType | SwaggerRefType | SwaggerArrayType | SwaggerObjectType | SwaggerFileType | SwaggerEnumType)

export type SwaggerPathParameter = {
  in: "path"
} & (SwaggerStringType | SwaggerRefType | SwaggerArrayType | SwaggerObjectType | SwaggerFileType | SwaggerEnumType)

export type SwaggerFormDataParameter = {
  in: "formData"
} & (SwaggerStringType | SwaggerRefType | SwaggerArrayType | SwaggerObjectType | SwaggerFileType | SwaggerEnumType)

export interface SwaggerBaseType {
  type?: undefined
  schema?: SwaggerRefType["schema"]
  enum?: string[]
  $ref?: string
  items?: SwaggerArrayType["items"]
}

export type TypeCompose<T, U> = T & Omit<U, keyof T>

export type SwaggerStringType = TypeCompose<{ type: "string", format?: "date-time" }, SwaggerBaseType> & SwaggerBaseInfo

export type SwaggerIntegerType = TypeCompose<{ type: "integer", format: "int32" | "int64" }, SwaggerBaseType> & SwaggerBaseInfo

export type SwaggerBooleanType = TypeCompose<{ type: "boolean" }, SwaggerBaseType> & SwaggerBaseInfo

export type SwaggerNumberType = TypeCompose<{ type: "number" }, SwaggerBaseType> & SwaggerBaseInfo

export type SwaggerQueryRefType = TypeCompose<{ type: "ref" }, SwaggerBaseType> & SwaggerBaseInfo

export type SwaggerBaseRefType = TypeCompose<{ 
  originalRef: string
  $ref: string
} , SwaggerBaseType> & SwaggerBaseInfo

export type SwaggerRefType = TypeCompose<{ 
  type: undefined
  schema: SwaggerType & SwaggerBaseRefType
} , SwaggerBaseType> & SwaggerBaseInfo

export type SwaggerArrayType = TypeCompose<{ 
  type: "array"
  items: SwaggerType & Partial<SwaggerBaseRefType>
}, SwaggerBaseType> & SwaggerBaseInfo

export type SwaggerObjectType = TypeCompose<{ 
  type: "object"
  additionalProperties?: SwaggerType
  properties?: Record<string, SwaggerProperty>
}, SwaggerBaseType> & SwaggerBaseInfo

export type SwaggerFileType = TypeCompose<{ 
  type: "file"
}, SwaggerBaseType> & SwaggerBaseInfo

export type SwaggerEnumType = TypeCompose<{ 
  enum: string[]
}, SwaggerBaseType> & SwaggerBaseInfo

export type SwaggerType = SwaggerBaseType & (SwaggerStringType | SwaggerRefType | SwaggerArrayType | SwaggerObjectType | SwaggerFileType | SwaggerEnumType | SwaggerBooleanType | SwaggerIntegerType | SwaggerNumberType)

export interface SwaggerRefDefinition {
  $ref: string
  originalRef: string
}

export type SwaggerDefinitions = Record<string, SwaggerDefinition>

export type SwaggerProperty = SwaggerQueryRefType | SwaggerBooleanType | SwaggerIntegerType | SwaggerNumberType | SwaggerStringType | Partial<SwaggerBaseRefType> | SwaggerArrayType | SwaggerObjectType | SwaggerFileType | SwaggerEnumType

export type SwaggerResponse = {
  schema: SwaggerBaseRefType
}

export interface SwaggerDefinition {
    type: string
    required: boolean | string[]
    properties: Record<string, SwaggerProperty>
    title: string
    description: string
}