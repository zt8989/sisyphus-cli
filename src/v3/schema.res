external anyToDict: 'a => Js_dict.t<'a> = "%identity"

type dataType = [#integer | #number | #boolean | #string | #array |#object]
type dataFormat = [
  | #int32
  | #int64
  | #float
  | #double
  | #byte
  | #binary
  | #date
  | #"date-time"
  | #password
]

type rec schema = {
  \"type": option<dataType>,
  format: option<dataFormat>,
  enum: option<array<string>>,
  items: option<schema>,
  \"$ref": option<string>
}

type importType = Primary(string) | Object(string, string)

let getModelNameFromRef = ref => {
  ref->Js_string2.sliceToEnd(~from = "#/"->Js.String2.length)->Js_string2.split("/")
}

let getTypeNameFromRef = ref => {
 let paths = getModelNameFromRef(ref)
  paths[paths -> Js_array2.length - 1]
}

let getRefType = (ref, schema) => {
  let typeName = getTypeNameFromRef(ref)
  switch schema {
  | { \"type": Some(#object) } => Object(typeName, typeName)
  | v => Js_exn.raiseError("unknow type" ++ (v.\"type" |> Js_option.getExn |> Js_string.make))
  }
}

let rec getTsType = (schema, f) => {
  switch schema {
  | {\"type": Some(#integer), format: Some(#int32)} => Primary("number")
  | {\"type": Some(#integer), format: Some(#int64)} => Primary("string")
  | {\"type": Some(#number), format: Some(#float)} => Primary("number")
  | {\"type": Some(#number), format: Some(#double)} => Primary("string")
  | {\"type": Some(#string), format: Some(#date)} => Primary("string")
  | {\"type": Some(#string), format: Some(#"date-time")} => Primary("string")
  | {\"type": Some(#string) } => Primary("string")
  | {\"type": Some(#boolean)} => Primary("boolean")
  | {\"type": Some(#array), items: Some(items)} => { 
    switch items->getTsType(f){
      | Primary(arrayType) 
      | Object(arrayType, _) => Primary(arrayType ++ "[]")
      }
    }
  | {\"$ref": Some(ref)} => f(. ref) |> getRefType(ref) 
  | _ => Primary("any")
  }
}

let writeTypes = (parameters, writer, f) => {
  let list = parameters->Js_array2.map(p => {
    switch getTsType(p["schema"], f) {
      | Primary(dataType)
      | Object(dataType, _) => j`${p["name"]}${!p["required"] ? "?":""}: ${dataType}`
    }
  })
  writer["write"](. list->Js_array2.joinWith(","))->ignore
}

// data[components]["schema"]
// ref #/components/schema

let getSchemaFromRef = (. data, ref) => {
  getModelNameFromRef(ref)->Js_array2.reduce((data, key) => {
    data |> Js_option.map((. d) => d->Js_dict.unsafeGet(key)->anyToDict)
  }, Some(data))
}

