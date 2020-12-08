import BaseTool from './baseTool'
import { SwaggerJson } from './types';
import ModelFile from './modelFile';
import { TOKEN } from './utils/modelNameParser';


export default class ModelTool extends BaseTool{

  async preMap(data: SwaggerJson) {
    const definitions = data.definitions
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

  async genModels(data: SwaggerJson) {
    const definitions = data.definitions

    // 记录已经创建的泛型类
    console.log(this.context.imports)
    for(let modelName of this.context.imports) {
      modelName = this.getModelNameFromRef(modelName)
      if(definitions[modelName]){
        const modelFile = new ModelFile(this.context, this.project, modelName, definitions[modelName])
        modelFile.create()
      }
    }
  }
}