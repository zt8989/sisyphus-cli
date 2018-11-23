import { scalarTypeS } from './enum'
type ModelStruct = {
  name: string
  children: ModelStruct[]
}

const TOKEN = {
  LEFT : "«",
  RIGHT :  "»",
  COMMA :  ","
}

export default class ModelNameParser {
  private name: string
  private position = 0

  constructor(name: string){
    this.name = name
  }

  parseString(){
    const data = this.parse()
    const nameRef = { name: "" }
    this._parseString(data, nameRef)
    return nameRef.name
  }

  _parseString(data: ModelStruct, nameRef: { name: string }){
    if(Reflect.has(scalarTypeS, data.name)){
      nameRef.name += Reflect.get(scalarTypeS, data.name)
    } else {
      nameRef.name += data.name
    }
    data.children.forEach(i => {
      this._parseString(i, nameRef)
    })
  }

  parse(){
    const data: ModelStruct = { name: "", children: [] }
    let ref: ModelStruct= data
    let prevRef: ModelStruct | null = null
    while(!this.isEnd()){
      const token = this.readToken()
      if(token === TOKEN.LEFT){
        ref.children.push({
          name: "",
          children: []
        })
        prevRef = ref
        ref = ref.children[ref.children.length - 1]
      } else if(token === TOKEN.RIGHT){
        // if(prevRef === null){
        //   throw new Error('解析错误')
        // }
        // ref = prevRef
        // prevRef = null
      } else if(token === TOKEN.COMMA){
        if(prevRef === null){
          throw new Error('解析错误')
        }
        prevRef.children.push({
          name: "",
          children: []
        })
        ref = prevRef.children[prevRef.children.length - 1]
      } else {
        if(token){
          ref.name = token
          ref.children = []
        }
      }
    }
    return data
  }

  readToken(){
    let name = this.name.slice(this.position)
    const empty = name.match(/\s+/)
    if(empty){
      name = name.slice(empty[0].length)
      this.position += empty[0].length
    }
    if(name.length == 0){
      return ""
    }
    if(/\w/.test(name[0])){
      const match = name.match(/\w+/)
      if(match){
        this.position += match[0].length
      }
      return match ? match[0] : ""
    } else if(name[0] === TOKEN.LEFT){
      this.position += 1
      return name[0]
    } else if(name[0] === TOKEN.RIGHT){
      this.position += 1
      return name[0]
    } else if(name[0] === TOKEN.COMMA){
      this.position += 1
      return name[0]
    } else {
      throw new Error(`未知的MODEL_TOKEN：${name[0]}`)
    }
  }

  isEnd(){
    return this.position === this.name.length
  }
}
