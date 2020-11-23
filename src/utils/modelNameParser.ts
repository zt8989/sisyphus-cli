import { scalarTypeS, scalarType } from './enum'
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

  parseString() {
    this.parse()
    return this.asString()
  }

  asString() {
    const data = this.getData()
    const nameRef = { name: "" }
    this._parseString(data, nameRef)
    return nameRef.name
  }

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
    } else if(data.name === 'Map'){
      nameRef.name += `Record<string, `
      this._parserGenericString(data.children[1], nameRef)
      nameRef.name += `>`
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
      if(this.generic.some(x => x === data.name)){
        nameRef.name += '<any>'
      }
    }
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

  getData() {
    if (!this.data) {
      throw new Error('parse error')
    }
    return this.data
  }

  unpack(){
    if(this.data && this.data.children.length === 1) {
      this.data = this.data.children[0]
      return true
    }
    if(this.data && this.data.children.length === 0) {
      this.data = { name: "object", children: [] }
      return true
    }
    throw new Error('unpack error')
  }

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

  readToken() {
    let name = this.name.slice(this.position)
    const empty = name.match(/\s+/)
    if (empty) {
      name = name.slice(empty[0].length)
      this.position += empty[0].length
    }
    if (name.length == 0) {
      return ""
    }
    if (/[_0-9a-z$\u4e00-\u9eff]/i.test(name[0])) {
      const match = name.match(/[_0-9a-z$\u4e00-\u9eff]+/i)
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
      throw new Error(`未知的MODEL_TOKEN：${name[0]}, ` + this.name)
    }
  }

  isEnd() {
    return this.position === this.name.length
  }
}
