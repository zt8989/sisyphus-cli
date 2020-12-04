# sisyphus-cli(西西弗斯)

一个从swagger自动生成ts,js代码的工具

## 为什么要使用这个？

1. 减少模板代码
2. 接口的版本控制 
3. 请求参数和返回结果的自动提示 
4. 自动生成文档和注释

# 如何使用

## 安装cli

`npm install sisyphus-cli -g`

## 如何增加新的项目

1. 新建文件夹如`xxx-api`
2. `sisyphus init xxx-api`初始化
3. 查看如何更新代码

## 如何更新代码

1. 进入相应文件夹如`xxx-api`
2. 查看`sisyphus.js`文件file路径是否执行对应swagger的地址
3. 执行`sisyphus`生成ts
4. 执行`npm run build`生成js

# sisyphus
```javascript
module.exports = {
  "file": "http://localhost:8000/v2/api-docs",
  "tags": {
    "信息相关": "message",
  },
  outDir: "./src/service",
  nameStrategy(interfaceInfo, changeCase) {
    const subs = interfaceInfo.parsedPath.dir.split('/');
    const dirSub = subs.slice(subs.length - 2);
    dirSub.push(interfaceInfo.parsedPath.name);
    dirSub.push(interfaceInfo.method.toLocaleLowerCase());
    return changeCase.camelCase(dirSub.join('_'));
  },
  dataKey: 'data',
  optionalQuery: false,
  appendOptions: true,
  onlyTags: false,
  createTags: false,
  requestPath: "@/service/request.ts",
  mock: true,
  mockOverwrite: response => {
    return Object.assign({}, response, {
      "resultCode": 100,
      "resultMsg": "",
      "success": true
    })
  }
}
```

## 参数说明

### file

必填，表示swagger地址，可以是url或者file
如果是对象比如
```json
{
  "a": "http://localhost:8000/v2/api-docs",
  "b": "http://localhost:8000/v2/api-docs",
}
```
会在各自模块下生成对应的请求文件和模型
outDir + "a" 下面生成请求文件和模型
outDir + "b" 下面生成请求文件和模型

### tags

可选，表示tag映射，如果tag是中文的最好映射一下

### nameStrategy

可选，命名策略， `interfaceInfo`接口信息，`changeCase`表示[`change-case`](https://www.npmjs.com/package/change-case)实例

### dataKey

可选，字符串，响应结果解包。`Result<T> { data: T, code: number, string }`,设置dataKey为`data`, `Promise<Result<BaseVo>>` => `Promise<BaseVo>`

### optionalQuery

可选，默认false，将所有query属性转为option

### appendOptions

可选，增加额外的options, `function abc() { return request({}) }` => `function abc(options?: any) { return request({ ...options }) }`

### onlyTags

可选，根据tags生成对应的controller而不是所有, 默认false

### outDir

可选，自动生成位置， 默认`./src/api`

### requestPath

可选，请求路径位置， 默认如果file是string 返回`./request`,否则`../request`
现在不会生成`request.ts`文件可参考自己写一份
```typescript
import axios from 'axios'

function bindUrl(path: string, pathParams: any) {
  if (!path.match(/^\//)) {
    path = '/' + path;
  }
  var url = path;
  url = url.replace(/\{([\w-]+)\}/g, function (fullMatch, key) {
    var value;
    if (pathParams.hasOwnProperty(key)) {
      value = pathParams[key];
    } else {
      value = fullMatch;
    }
    return encodeURIComponent(value);
  });
  return url;
}

const request = axios

export { request, bindUrl };
```

### createTags

可选，默认false， 生成tags文件方便映射

### mock
可选，默认false， 在src同级mock目录下生成mock文件

### mockOverwrite
可选，null， mock响应覆盖

```javascript
  mockOverwrite: response => {
    return Object.assign({}, response, {
      "resultCode": 100,
      "resultMsg": "",
      "success": true
    })
  }
```

# QA

Q: 我遇到了中文的model怎么办？
> A: 修改java中的注解，`@ApiModel("xxx")` => `@ApiModel(description = "xxx")`

# TODO

* [x] 生成model代码
* [x] 生成api代码
* [x] 优化注释
* [x] 自动打包发布到npm，包含可以提示的d.ts
* [ ] 自动生成浏览器可以用的js
* [x] 考虑泛型的优化

# 更新日志

* 0.15 如果request.ts已存在则不覆盖
* 0.16 修复解析数组的报错的bug
* 0.17 增加命名策略
* 0.18 增加命名策略
* 0.22 
  
  sisyphus.json => sisyphus.js
  移除`generic`选项，工具会判断，自动生成

* 0.23
  
  超过三个类型的query自动生成query类型

* 0.24

  修复字典解析错误的问题

* 0.25

  增加onlyTags选项，移除onlyModel

* 0.26

  增加dataKey，用于返回解包