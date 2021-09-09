#!/usr/bin/env node

import program from "commander";
import main from "./main";

program
  .version(require("../package.json").version)
  .option("init [name]", "init a project")
  .option("mock-data", "mock data")
  .option("mock-server", "mock server")
  .option("-c, --config [file]", "config file")
  .option("-y", "generate all tags")
  .action(main);

program.parse(process.argv);
