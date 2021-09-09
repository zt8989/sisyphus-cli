@module("path") external posix: {"join": (string, string) => string} = "posix"

type formatUrl = (string, string) => string

let getFullUrl = (formatUrl: option<formatUrl>, ~baseUrl="/", ~url) => {
  if Js_option.isSome(formatUrl) {
    formatUrl |> Js_option.map((. f) => f(baseUrl, url)) |> Js_option.getExn
  } else {
    posix["join"](baseUrl, url)
  }
}

let getDesc = param => param->Js_dict.get("description") |> Js_option.getWithDefault("")
