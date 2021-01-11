import request from './request'
import { Project } from 'ts-morph'
import ModelTool from './model';
import fs from 'fs'
import ApiTool from './api';
import path, { join } from 'path'
import { promisify } from 'util'
import ejs from 'ejs'
import ora from 'ora';
import { ConfigDefinition, Context, SwaggerJson, SwaggerTag } from './types';
import { createApp } from './site';
import inquirer from 'inquirer'
inquirer.registerPrompt('checkbox-plus', require('inquirer-checkbox-plus-prompt'));
import { match } from 'pinyin-match'

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

  let files = typeof config.file === 'string' ? { default: config.file } : config.file

  if(Object.keys(files).length > 1){
    const choices = Object.keys(files).map(x => `[${x}]: ${files[x]}`)
    const name = "source"
    const message = "select your import swagger, press <enter> to download all"
    const answers = await inquirer
      .prompt([
        {
          name,
          message,
          type: "checkbox",
          choices: choices,
        }
      ])
    const newFiles: Record<string, string> = {}
    if(answers[name].length > 0) {
      Object.keys(files).forEach(x => {
        if(answers[name].includes(`[${x}]: ${files[x]}`)) {
          newFiles[x] = files[x]
        }
      })
      files = newFiles
    }
  }
  

  for(let key in files){
    let file = files[key]
    const data: SwaggerJson | false = await getData(file)
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

    let tags = data.tags

    const choices = tags.map(x => {
      const map = (config.tags || {})[x.name]
      return {
        name: x.name + (map ? `(${map})` : ""),
        value: x.name
      }
    })
    const name = "tags"
    const message = "search the controller you want to generate."
    const answers = await inquirer
      .prompt([
        {
          name,
          message,
          type: 'checkbox-plus',
          searchable: true,
          source: async (_:any, input: string) => {
            const i = String.prototype.trim.call(input || "")
            return i ? choices.filter(x => match(x.name, i)) : choices
          },
        }
      ])

    await new ApiTool(context, project, data).genApis(answers[name])

    await modelService.genModels(data)
    // if(!config.onlyModel) {
    // }
    // await genIndex(project)
    await project.save()
  }
  console.log(`生成成功！执行以下命令修复ts格式`)
  console.log(`yarn prettier --write ${config.outDir}/**/*.ts`)
}

async function mockData(cmdObj: any){
  const config = getConfig(cmdObj)
  if (config === false) return

  let files = typeof config.file === 'string' ? { default: config.file } : config.file

  if(Object.keys(files).length > 1){
    const choices = Object.keys(files).map(x => `[${x}]: ${files[x]}`)
    const name = "select your import swagger, press <enter> to download all"
    const answers = await inquirer
      .prompt([
        {
          name,
          type: "checkbox",
          choices: choices,
        }
      ])
    const newFiles: Record<string, string> = {}
    if(answers[name].length > 0) {
      Object.keys(files).forEach(x => {
        if(answers[name].includes(`[${x}]: ${files[x]}`)) {
          newFiles[x] = files[x]
        }
      })
      files = newFiles
    }
  }
  

  for(let key in files){
    let file = files[key]
    const data: SwaggerJson | false = await getData(file)
    if (data === false) return
    const project = new Project()
    const context: Context = {
      config,
      fileMap: {},
      outDir: key === 'default' ? config.outDir : join(config.outDir, key),
      generic: [],
      imports: []
    }

    let tags = data.tags
    if(config.onlyTags) {
      tags = tags.filter(x => !!(config.tags || {})[x.name])
    }

    if(tags.length > 1){
      const choices = tags.map(x => x.name)
      const name = "select your import tag, press <enter> to download all"
      const answers = await inquirer
        .prompt([
          {
            name,
            type: "checkbox",
            choices: choices,
          }
        ])
      if(answers[name].length > 0) {
        const newTags: SwaggerTag[] = []

        tags.forEach(x => {
          if(answers[name].includes(x.name)) {
            newTags.push(x)
          }
        })
        tags = newTags
      }
    }

    await new ApiTool(context, project, data).genMocks(tags)
    await project.save()
    console.log(`生成成功！执行以下命令修复js格式`)
    console.log(`yarn prettier --write ./mock/*.js`)
  }
}

export default function(args: any) {
  if(args.init) {
    initProject(args)
    return
  }

  if(args['mockServer']){
    createApp()
    return
  }

  if(args['mockData']){
    mockData(args)
    return
  }

  importSwagger(args)
}

export {
  createApp,
  importSwagger,
  initProject,
  mockData
}