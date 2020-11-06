#!/usr/bin/env node

import request, { swaggerRequest } from './request'
import { Project } from 'ts-simple-ast'
import ModelTool from './model';
import program from 'commander'
import fs from 'fs'
import ApiTool from './api';
import path from 'path'
import { promisify } from 'util'
import ejs from 'ejs'


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
  const data = await getData(config)
  if (data === false) return
  const project = new Project()
  const context: Context = {
    config,
    hasGeneric: false
  }
  await new ModelTool(context).genModels(project, data, context)
  await new ApiTool(context).genApis(project, data)
  await genIndex(project)
  await project.save()
  console.log('生成成功, 请修改src/request.ts的request方法实现！')
})()

async function genIndex(project: Project) {
  if(!fs.existsSync('src')){
    await promisify(fs.mkdir)('src')
  }
  if(!fs.existsSync('src/index.ts')){
    await promisify(fs.writeFile)('src/index.ts', `import api from './api'\n`
    + `export default api`, { flag: 'w+' })
  }
}

async function getData(config: any) {
  let data
  if (config.file.startsWith('http')) {
    console.log('downloading swagger json')
    data = await request(config.file)
    console.log('downloaded swagger json')
  } else {
    const json = await promisify(fs.readFile)(config.file, { encoding: 'utf8' })
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
  hasGeneric: boolean
}

export interface ConfigDefinition {
  file: string
  generic?: string[],
  tags?: {
    [key: string]: string
  },
  unpackResponse?: boolean,
  nameStrategy?: (sr: swaggerRequest, tag: string, url: string) => string
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
   
  if (!configJson.file) {
    console.error('请检查配置文件是否正确！')
    return false
  }


  if (!configJson.file.startsWith('http') && !fs.existsSync(configJson.file)) {
    console.error('请确认json文件是否存在!')
    return false
  }

  return configJson
}