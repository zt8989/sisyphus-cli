#!/usr/bin/env node

import axios from 'axios'
import request from './request'
import { Project } from 'ts-simple-ast'
import genModels from './model';

const [,, ...args] = process.argv
console.log("hello, world", args);

(async () => {
  const data = await request('http://localhost:9999/v2/api-docs')
  if(data !== null){
    const project = new Project()
    await genModels(project, data.definitions)
    project.save()
  }
})()

