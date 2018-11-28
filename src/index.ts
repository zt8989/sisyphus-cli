#!/usr/bin/env node

import axios from 'axios'
import request from './request'
import { Project } from 'ts-simple-ast'
import ModelTool from './model';
import program from 'commander'
import fs from 'fs'
import ApiTool from './api';
import path from 'path'
import { promisify } from 'util'

const logger = require('debug')('index')

program
  .version('1.0.0')
  .option('-c, --config', 'config file')
  .parse(process.argv);

(async () => {
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
  project.save()
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
    data = await request(config.file)
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
  generic?: string[]
}

function getConfig() {
  const configFile = program.config || path.resolve(process.cwd() ,'sisyphus.json')
  if (!fs.existsSync(configFile)) {
    console.error('请确认配置文件是否存在!')
    return false
  }
  const configJson = require(configFile) as ConfigDefinition
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