@new @module("./api") external api: ('a, 'b, 'c) => 't = "default"
@new @module("./v3/apiTool") external apiV3: ('a, 'b, 'c) => 't = "default"
@new @module("./model") external model: ('a, 'b) => 't = "default"
@new @module("./v3/modelTool") external modelV3: ('a, 'b) => 't = "default"

let getIsVersion3 = data => switch Js_option.some(data["openapi"]) {
		| Some(v) => v->Js_string2.startsWith("3")
		| None => false
	}

let makeApi = data => {
	let isVersion3 = getIsVersion3(data)
	isVersion3 ? apiV3 : api
}

let makeModel = data => {
	let isVersion3 = getIsVersion3(data)
	isVersion3 ? modelV3 : model
}