import ModelNameParser from "../utils/modelNameParser"

const parser = new ModelNameParser("Map«string,object»", [])
parser.parse()

console.log(parser.asGenericString())