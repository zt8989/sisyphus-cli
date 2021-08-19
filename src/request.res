@module("axios") external get: (~url: string) => Promise.t<'a> = "get"

type result<'a> = {
  status: int,
  data: option<'a>,
}

type swaggerJson

let getSwaggerJson = url => {
  open Promise
  get(~url)->then((res: result<swaggerJson>) => {
    if res.status === 200 {
      resolve(res.data)
    } else {
      resolve(None)
    }
  })
}

let default = getSwaggerJson
