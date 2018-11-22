#!/usr/bin/env node

import axios from 'axios'
import request from './request'
import { Project } from 'ts-simple-ast'
import genModels from './model';
import program from 'commander'
import fs from 'fs'
import genApis from './api';
import path from 'path'
import { promisify } from 'util'

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
  await genModels(project, data)
  await genApis(project, data)
  await genIndex(project)
  project.save()
})()

async function genIndex(project: Project) {
  await promisify(fs.mkdir)('src')
  await promisify(fs.writeFile)(path.resolve('src/index.ts'), `import api from './api'\n`
  + `export default api`, { flag: 'w+' })
}

async function getData(config: any) {
  let data
  if (config.file.startsWith('http')) {
    data = await request(config.file)
  } else {
    data = require(config.file)
  }
  if (!data) {
    console.error('获取json失败')
    return false
  }
  return data
}

function getConfig() {
  const configFile = program.config || path.resolve(process.cwd() ,'sisyphus.json')
  if (!fs.existsSync(configFile)) {
    console.error('请确认配置文件是否存在!')
    return false
  }
  const configJson = require(configFile)
  console.log(configJson)
  if (!configJson.file) {
    console.error('请检查配置文件是否正确！')
    return false
  }


  if (!configJson.file.startsWith('http') || fs.existsSync(configJson.file)) {
    console.error('请确认json文件是否存在!')
    return false
  }

  return configJson
}