const fs = require('node:fs')
const ts = require('typescript')

// Run the project's TypeScript with Node's built-in test runner, without adding
// a production dependency or importing the database into parser tests.
require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  module._compile(result.outputText, filename)
}
