// Generated by ReScript, PLEASE EDIT WITH CARE
'use strict';

var Js_exn = require("rescript/lib/js/js_exn.js");
var Js_dict = require("rescript/lib/js/js_dict.js");
var Js_option = require("rescript/lib/js/js_option.js");
var Caml_array = require("rescript/lib/js/caml_array.js");
var Caml_option = require("rescript/lib/js/caml_option.js");

function requestBody(request) {
  return Js_dict.get(request, "requestBody");
}

var SchemaResolve = {
  requestBody: requestBody
};

function getModelNameFromRef(ref) {
  var def = "#/definitions/";
  if (ref.startsWith(def)) {
    return [
            "definitions",
            ref.slice(def.length)
          ];
  } else {
    return ref.slice("#/".length).split("/");
  }
}

function getTypeNameFromRef(ref) {
  var paths = getModelNameFromRef(ref);
  return Caml_array.get(paths, paths.length - 1 | 0);
}

function getRefType(ref, schema) {
  var typeName = getTypeNameFromRef(ref);
  var match = schema.type;
  if (match === "object") {
    return {
            TAG: /* Object */1,
            _0: typeName,
            _1: typeName
          };
  }
  return Js_exn.raiseError("unknow type" + String(Js_option.getExn(schema.type)));
}

function getTsType(schema, f) {
  var match = schema.type;
  if (match !== undefined) {
    if (match === "boolean") {
      return {
              TAG: /* Primary */0,
              _0: "boolean"
            };
    }
    if (match === "string") {
      return {
              TAG: /* Primary */0,
              _0: "string"
            };
    }
    if (match === "integer") {
      var match$1 = schema.format;
      if (match$1 !== undefined) {
        if (match$1 === "int32") {
          return {
                  TAG: /* Primary */0,
                  _0: "number"
                };
        }
        if (match$1 === "int64") {
          return {
                  TAG: /* Primary */0,
                  _0: "string"
                };
        }
        
      }
      
    } else if (match === "number") {
      var match$2 = schema.format;
      if (match$2 !== undefined) {
        if (match$2 === "float") {
          return {
                  TAG: /* Primary */0,
                  _0: "number"
                };
        }
        if (match$2 === "double") {
          return {
                  TAG: /* Primary */0,
                  _0: "string"
                };
        }
        
      }
      
    } else if (match === "array") {
      var items = schema.items;
      if (items !== undefined) {
        var match$3 = getTsType(items, f);
        return {
                TAG: /* Primary */0,
                _0: match$3._0 + "[]"
              };
      }
      
    }
    
  }
  var ref = schema.$ref;
  if (ref !== undefined) {
    return getRefType(ref, f(ref));
  } else {
    return {
            TAG: /* Primary */0,
            _0: "any"
          };
  }
}

function writeTypes(parameters, writer, f) {
  var list = parameters.map(function (p) {
        var match = getTsType(p.schema, f);
        return p.name + (
                p.required ? "" : "?"
              ) + ": " + match._0;
      });
  writer.write(list.join(","));
  
}

function getSchemaFromRef(data, ref) {
  return getModelNameFromRef(ref).reduce((function (data, key) {
                return Js_option.map((function (d) {
                              return d[key];
                            }), data);
              }), Caml_option.some(data));
}

exports.SchemaResolve = SchemaResolve;
exports.getModelNameFromRef = getModelNameFromRef;
exports.getTypeNameFromRef = getTypeNameFromRef;
exports.getRefType = getRefType;
exports.getTsType = getTsType;
exports.writeTypes = writeTypes;
exports.getSchemaFromRef = getSchemaFromRef;
/* No side effect */
