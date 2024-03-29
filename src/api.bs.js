// Generated by ReScript, PLEASE EDIT WITH CARE
'use strict';

var Path = require("path");
var Curry = require("rescript/lib/js/curry.js");
var Js_dict = require("rescript/lib/js/js_dict.js");
var Js_option = require("rescript/lib/js/js_option.js");

function getFullUrl(formatUrl, baseUrlOpt, url) {
  var baseUrl = baseUrlOpt !== undefined ? baseUrlOpt : "/";
  if (Js_option.isSome(formatUrl)) {
    return Js_option.getExn(Js_option.map((function (f) {
                      return Curry._2(f, baseUrl, url);
                    }), formatUrl));
  } else {
    return Curry._2(Path.posix.join, baseUrl, url);
  }
}

function getDesc(param) {
  return Js_option.getWithDefault("", Js_dict.get(param, "description"));
}

exports.getFullUrl = getFullUrl;
exports.getDesc = getDesc;
/* path Not a pure module */
