// import ModelNameParser from "../utils/modelNameParser"

// const parser = new ModelNameParser("Map«string,object»", [])
// parser.parse()

// console.log(parser.asGenericString())

import beautify from 'json-beautify'
import ModelFile from '../modelFile'

// @ts-ignore
let modelFile = new ModelFile(null, null, "aa")

let result = modelFile.getProperties(require('./test.json'))

console.log(beautify(result, null as any, 2, 100))