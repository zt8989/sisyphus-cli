import { SwaggerDefinitions, SwaggerJson } from "../types";

export interface SwaggerJsonV3 extends SwaggerJson {
  components: {
		schemas: SwaggerDefinitions
	}
}