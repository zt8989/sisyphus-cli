// getFullUrl(baseUrl: string, url: string) {
//   if (this.context.config.formatUrl) {
//     return this.context.config.formatUrl(baseUrl, url);
//   }
//   return posix.join(baseUrl, url);
// }
@module("path") external posix: {"join": (string, string) => string} = "posix"

type formatUrl = (string, string) => string

let getFullUrl = (formatUrl: option<formatUrl>, ~baseUrl="/", ~url) => {
  if Js_option.isSome(formatUrl) {
    formatUrl |> Js_option.map((. f) => f(baseUrl, url)) |> Js_option.getExn
  } else {
    posix["join"](baseUrl, url)
  }
}

let basePath = (~p="/") => p
