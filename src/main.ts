import request from './request'
import { Project } from 'ts-morph'
import ModelTool from './model';
import fs from 'fs'
import ApiTool from './api';
import path, { join } from 'path'
import { promisify } from 'util'
import ejs from 'ejs'
import { exec } from 'child_process';
import ora from 'ora';
import { ConfigDefinition, Context } from './types';
import { createApp } from './site';

// @ts-ignore
async function genIndex() {
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
  const spinner = ora('downloading swagger json from ' + file)
  if (file.startsWith('http')) {
    spinner.start()
    data = await request(file)
    spinner.succeed('downloaded swagger json from ' + file)
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

async function initProject(cmdObj: any){
  const projectName = cmdObj.name 
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

function getConfig(cmdObj: any) {
  const configFile1 = path.resolve(process.cwd(), cmdObj.config || 'sisyphus.js')
  const configFile2 = path.resolve(process.cwd(), cmdObj.config || 'sisyphus.json')
  
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

  if(configJson.onlyTags === undefined) {
    configJson.onlyTags = false
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

async function importSwagger(cmdObj: any) {
  const config = getConfig(cmdObj)
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
      generic: [],
      imports: []
    }

    const modelService = new ModelTool(context, project)

    await modelService.preMap(data)

    await new ApiTool(context, project).genApis(data)

    await modelService.genModels(data)
    // if(!config.onlyModel) {
    // }
    // await genIndex(project)
    await project.save()
  }
  const prettier = path.resolve(process.cwd() ,'./node_modules/.bin/prettier')
  if(fs.existsSync(prettier)){
    exec(`${prettier} --write ${config.outDir}`, {
      cwd: process.cwd()
    })
  }
  console.log(`生成成功！`)
}

export default function(args: any) {
  if(args.init) {
    initProject(args)
    return
  }

  if(args.mock){
    createApp()
    return
  }

  importSwagger(args)
}

export {
  createApp,
  importSwagger,
  initProject
}