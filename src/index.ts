#!/usr/bin/env node

import program from 'commander'
import main from './main';


program
  .version('1.0.0')
  .option('init [name]', 'init a project')
  .option('mock', 'mock data')
  .option('-c, --config [file]', 'config file')
  .action(main)
  
program.parse(process.argv);

