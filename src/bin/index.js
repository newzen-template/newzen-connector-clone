#!/usr/bin/env node
// eslint-disable-next-line @typescript-eslint/no-var-requires
process.argv.forEach(function (val, index) {
  if(index === 2) {
    switch (val) {
      case 'fetch-routes-generate':
        const a = require("./fetch-routes-generate")
        console.log(a.generateRoutes())
        break;
      default:
        console.log('default');
        break;
    }
  }
});