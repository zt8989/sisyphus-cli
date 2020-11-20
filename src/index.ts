#!/usr/bin/env node

import request from './request'
import { Project } from 'ts-simple-ast'
import ModelTool from './model';
import program from 'commander'
import fs from 'fs'
import ApiTool, { RenameOption } from './api';
import path, { join } from 'path'
import { promisify } from 'util'
import ejs from 'ejs'
import { exec } from 'child_process';


program
  .version('1.0.0')
  .option('-c, --config [file]', 'config file')
  .option('init [name]', 'init a project')
  .parse(process.argv);

(async () => {
  if(program.init){
    initProject()
    return
  }
  const config = getConfig()
  if (config === false) return

  const files = typeof config.file === 'string' ? { default: config.file } : config.file
  for(let key in files){
    let file = files[key]
    const data = await getData(file)
    if (data === false) return
    const project = new Project()
    const context: Context = {
      config,
      fileMap: {},
      outDir: key === 'default' ? config.outDir : join(config.outDir, key),
      generic: []
    }
    await new ModelTool(context, project).genModels(data)
    if(!config.onlyModel) {
      await new ApiTool(context, project).genApis(data)
    }
    // await genIndex(project)
    await project.save()
  }
  const prettier = path.resolve(process.cwd() ,'./node_modules/.bin/prettier')
  if(fs.existsSync(prettier)){
    exec(`${prettier} --write ${config.outDir}`)
  }
  console.log(`生成成功, 请修改${join(config.outDir, 'request.ts')}的request方法实现！`)
})()

// @ts-ignore
async function genIndex(project: Project) {
  if(!fs.existsSync('src')){
    await promisify(fs.mkdir)('src')
  }
  if(!fs.existsSync('src/index.ts')){
    await promisify(fs.writeFile)('src/index.ts', `import api from './api'\n`
    + `export default api`, { flag: 'w+' })
  }
}

async function getData(file: string) {
  let data
  if (file.startsWith('http')) {
    console.log('downloading swagger json from ' + file)
    data = await request(file)
    console.log('downloaded swagger json from ' + file)
  } else {
    const json = await promisify(fs.readFile)(file, { encoding: 'utf8' })
    data = JSON.parse(json)
  }
  if (!data) {
    console.error('获取json失败')
    return false
  }
  return data
}

export interface Context {
  config: ConfigDefinition
  fileMap: Record<string, string>
  outDir: string
  generic: string[]
}

export interface ConfigDefinition {
  file: string | { [key: string]: string },
  outDir: string,
  tags?: {
    [key: string]: string
  },
  unpackResponse?: boolean,
  nameStrategy?: (option: RenameOption, changeCase: any) => string,
  optionalQuery?: boolean,
  appendOptions?: boolean
  onlyModel?: boolean
  createTags?: boolean
  requestPath?: string
}

async function initProject(){
  const projectName = program.init 
  const files = await promisify(fs.readdir)(path.resolve(__dirname, '../sample'))
  const readFile = promisify(fs.readFile)
  const writeFile = promisify(fs.writeFile)
  for(let file of files){
    const str = await readFile(path.resolve(__dirname, '../sample', file), { encoding: 'utf8' })
    const renderStr = ejs.render(str, { name: projectName })
    await writeFile(file, renderStr, { encoding: 'utf8'} )
  }
  console.log('创建成功，请修改sisyphus.json中的swagger地址!have fun!')
}

function getConfig() {
  const configFile1 = program.config || path.resolve(process.cwd() ,'sisyphus.js')
  const configFile2 = program.config || path.resolve(process.cwd() ,'sisyphus.json')
  
  if (!fs.existsSync(configFile1) && !fs.existsSync(configFile2)) {
    console.error('请确认配置文件是否存在!如果未执行初始化，请执行sisyphus init project-name')
    return false
  }
  let configJson
  if(configFile1){
    configJson = require(configFile1) as ConfigDefinition
  } else {
    configJson = require(configFile2) as ConfigDefinition
  }

  if(configJson.unpackResponse === undefined){
    configJson.unpackResponse = false
  }

  if(configJson.optionalQuery === undefined){
    configJson.optionalQuery = false
  }

  if(!configJson.outDir) {
    configJson.outDir = './src/api'
  }

  const files = typeof configJson.file === 'string' ? [configJson.file] : getValues(configJson.file)

  if(!configJson.requestPath) {
    configJson.requestPath = typeof configJson.file === 'string' ? "./request" : "../request"
  }
   
  for(let file of files){
    if (!file) {
      console.error('请检查配置文件是否正确！')
      return false
    }
  
  
    if (!file.startsWith('http') && !fs.existsSync(path.resolve(process.cwd(), file))) {
      console.error('请确认json文件是否存在!', fs.existsSync(path.resolve(process.cwd(), file)))
      return false
    }
  }

  return configJson
}

function getValues(map: Record<string, string>) {
  return Object.keys(map).map(x => map[x])
}