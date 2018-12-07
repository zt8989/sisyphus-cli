import { scalarTypeS, scalarType, containTypes } from './enum'
export type ModelStruct = {
  name: string
  children: ModelStruct[]
}

const TOKEN = {
  LEFT: "«",
  RIGHT: "»",
  COMMA: ","
}

export default class ModelNameParser {
  private name: string
  private position = 0
  private data: ModelStruct | null = null
  private generic: string[] = []

  constructor(name: string, generic: string[]) {
    this.name = name
    this.generic = generic
  }

  /**
   * 泛型解析
   */
  parseString() {
    this.parse()
    const data = this.getData()
    return this.asString()
  }

  /**
   * 将解析数据转换为普通对象 List<abc> => Listabc
   */
  asString() {
    const data = this.getData()
    const nameRef = { name: "" }
    this._parseString(data, nameRef)
    return nameRef.name
  }

  /**
   * 将解析数据转换为泛型对象 List<abc> => List<abc>
   */
  asGenericString() {
    const data = this.getData()
    const nameRef = { name: "" }
    this._parserGenericString(data, nameRef)
    return nameRef.name
  }

  private _parserGenericString(data: ModelStruct, nameRef: { name: string }) {
    if (Reflect.has(scalarType, data.name)) {
      nameRef.name += Reflect.get(scalarType, data.name)
    } else if (data.name === 'object') {
      nameRef.name += 'any'
    } else if (data.name === 'List') {
      data.children.forEach(i => {
        this._parserGenericString(i, nameRef)
      })
      nameRef.name += '[]'
      return
    } else if(['Map', 'LinkedHashMap', 'HashMap'].indexOf(data.name) !== -1){
      nameRef.name += `{ [key: string]: `
      this._parserGenericString(data.children[1], nameRef)
      nameRef.name += `}`
      return
    } else {
      nameRef.name += data.name
    }
    if (data.children.length > 0) {
      nameRef.name += '<'
      data.children.forEach(i => {
        this._parserGenericString(i, nameRef)
      })
      nameRef.name += '>'
    } else {
      if(this.isGeneric(data)){
        nameRef.name += '<any>'
      }
    }
  }

  /**
   * import的使用
   */
  public getImportList(){
    const data = this.getData()
    const imports = new Set<string>()
    if(this.isGeneric(data)){
      this._getImportList(data, imports)
    } else {
      imports.add(this.asString())
    }
    return imports
  }

  /**
   * 返回类型标注使用，全称
   */
  public getReturnName(){
    const data = this.getData()
    if(this.isGeneric(data)){
      return this.asGenericString()
    } else {
      return this.asString()
    }
  }

  private _getImportList(data: ModelStruct, imports: Set<string>){
    if(containTypes.indexOf(data.name) !== -1){
      imports.add(data.name)
    }
    data.children && data.children.forEach(i => {
      this._getImportList(i, imports)
    })
  }

  private isGeneric(data: ModelStruct){
    return this.generic.some(x => x === data.name)
  }

  private _parseString(data: ModelStruct, nameRef: { name: string }) {
    if (Reflect.has(scalarTypeS, data.name)) {
      nameRef.name += Reflect.get(scalarTypeS, data.name)
    } else {
      nameRef.name += data.name
    }
    data.children.forEach(i => {
      this._parseString(i, nameRef)
    })
  }

  /**
   * 解析成功的结构 List<abc> => 
   * {
   *  name: List,
   *  children: [
   *    {
   *      name: abc
   *    }
   *  ]
   * }
   */
  getData() {
    if (!this.data) {
      throw new Error('parse error')
    }
    return this.data
  }

  /**
   * 解析模块
   */
  parse() {
    const data: ModelStruct = { name: "", children: [] }
    let ref: ModelStruct = data
    let prevRef: ModelStruct | null = null
    while (!this.isEnd()) {
      const token = this.readToken()
      if (token === TOKEN.LEFT) {
        ref.children.push({
          name: "",
          children: []
        })
        prevRef = ref
        ref = ref.children[ref.children.length - 1]
      } else if (token === TOKEN.RIGHT) {
        // if(prevRef === null){
        //   throw new Error('解析错误')
        // }
        // ref = prevRef
        // prevRef = null
      } else if (token === TOKEN.COMMA) {
        if (prevRef === null) {
          throw new Error('解析错误')
        }
        prevRef.children.push({
          name: "",
          children: []
        })
        ref = prevRef.children[prevRef.children.length - 1]
      } else {
        if (token) {
          ref.name = token
          ref.children = []
        }
      }
    }
    this.data = data
  }

  private readToken() {
    let name = this.name.slice(this.position)
    const empty = name.match(/\s+/)
    if (empty) {
      name = name.slice(empty[0].length)
      this.position += empty[0].length
    }
    if (name.length == 0) {
      return ""
    }
    if (/[_0-9a-z\u4e00-\u9eff]/i.test(name[0])) {
      const match = name.match(/[_0-9a-z\u4e00-\u9eff]+/i)
      if (match) {
        this.position += match[0].length
      }
      return match ? match[0] : ""
    } else if (name[0] === TOKEN.LEFT) {
      this.position += 1
      return name[0]
    } else if (name[0] === TOKEN.RIGHT) {
      this.position += 1
      return name[0]
    } else if (name[0] === TOKEN.COMMA) {
      this.position += 1
      return name[0]
    } else {
      throw new Error(`未知的MODEL_TOKEN：${name[0]}`)
    }
  }

  isEnd() {
    return this.position === this.name.length
  }
}
