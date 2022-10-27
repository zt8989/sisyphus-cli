type struct = {name: string}

type t = {
  parse: unit => unit,
  getData: unit => struct,
}

type result = Success(struct) | Fail

@new @module("./utils/modelNameParser")
external modelNameParser: (string, array<string>) => t = "default"

let checkAndModifyModelName = (generic, name) => {
  let parser = modelNameParser(name, generic)
  parser.parse()
  let struct = parser.getData()
  let g = ["List", "Map", "HashMap"]
  if g->Js_array2.includes(struct.name) {
    Fail
  } else {
    Success(struct)
  }
}
