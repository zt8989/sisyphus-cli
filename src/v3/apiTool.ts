import { CodeBlockWriter } from "ts-morph";
import ApiTool from "../api";
import { SwaggerParameter } from "../types";
import { getSchemaFromRef, writeTypes } from "./schema.bs";

export default class ApiToolV3 extends ApiTool {
	writePathTypes(parameters: SwaggerParameter[], writer: CodeBlockWriter, optional: boolean = false){
		writeTypes(parameters, writer, getSchemaFromRef.bind(null, this.data))
	}

	writeTypes(parameters: SwaggerParameter[], writer: CodeBlockWriter, optional: boolean = false){
		writeTypes(parameters, writer, getSchemaFromRef.bind(null, this.data))
	}
}