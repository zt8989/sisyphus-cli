const express = require('express')
const cors = require('cors')
const path = require("path")

export function createApp(){
  const app = express()

  app.use(cors())

  app.options('*', cors()) 

  app.get('/', function (req: any, res: any) {
    res.send('hello world')
  })

  var normalizedPath = path.join(process.cwd(), "mock");

  require("fs").readdirSync(normalizedPath).forEach(function(file: any) {
    if(file.endsWith("js")){
      const mockData = require(path.join(normalizedPath, file));
      Object.keys(mockData).forEach(key => {
        const [method, url] = key.split(" ")
        app[method.toLowerCase()](url, mockData[key])
      })
    }
  });

  app.listen(process.env.PORT || 9000, function () {
    console.log(`mock server listening on port ${process.env.PORT || 9000}`)
  })
}