import ModelTool from "../model";
import { SwaggerJsonV3 } from "./types";

export default class ModelToolV3 extends ModelTool<SwaggerJsonV3> {
	getDefinitions(data: SwaggerJsonV3){
    return data.components.schemas
  }
}