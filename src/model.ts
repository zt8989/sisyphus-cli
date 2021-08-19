import BaseTool from './baseTool'
import { SwaggerJson } from './types';
import ModelFile from './modelFile';
import { TOKEN } from './utils/modelNameParser';
import { getSchemaFromRef, getTypeNameFromRef } from './v3/schema.bs';


export default class ModelTool<T extends SwaggerJson = SwaggerJson> extends BaseTool{

  getDefinitions(data: T){
    return data.definitions
  }

  async preMap(data: T) {
    const definitions = this.getDefinitions(data)
    const count: Record<string, number> = {}
    const map: Record<string, string> = {}

    // 统计是否重复 
    for (let defineName in definitions) {
      let generic = defineName.includes(TOKEN.LEFT)
      if (!generic) {
        if(count[defineName.toLocaleLowerCase()] === undefined) {
          count[defineName.toLocaleLowerCase()] = 0
          map[defineName] = defineName
        } else {
          count[defineName.toLocaleLowerCase()] += 1
          map[defineName] = defineName + count[defineName.toLocaleLowerCase()]
        }
      }
    }
    this.context.fileMap = map
  }

  async genModels(data: T) {
    // 记录已经创建的泛型类
    for(let modelName of this.context.imports) {
      const schema = getSchemaFromRef(data, modelName)
      if(schema){
        const modelFile = new ModelFile(this.context, this.project, getTypeNameFromRef(modelName), schema)
        modelFile.create()
      }
    }
  }
}