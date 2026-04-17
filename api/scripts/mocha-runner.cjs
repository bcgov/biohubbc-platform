const fs = require('node:fs');
const path = require('node:path');
const { globSync } = require('glob');
const Mocha = require('mocha');

process.env.TS_NODE_PROJECT = process.env.TS_NODE_PROJECT || path.resolve(process.cwd(), 'tsconfig.mocha.json');
process.env.TS_NODE_TRANSPILE_ONLY = process.env.TS_NODE_TRANSPILE_ONLY || 'true';
require('ts-node/register');

const args = process.argv.slice(2);

const getArg = (name) => {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) {
    return undefined;
  }

  return args[index + 1];
};

const configPath = getArg('--config') || '.mocharc.json';
const fullConfigPath = path.resolve(process.cwd(), configPath);

if (!fs.existsSync(fullConfigPath)) {
  throw new Error(`Mocha config file not found: ${fullConfigPath}`);
}

const config = JSON.parse(fs.readFileSync(fullConfigPath, 'utf8'));

const requires = Array.isArray(config.require) ? config.require : config.require ? [config.require] : [];
requires.forEach((entry) => {
  require(path.resolve(process.cwd(), entry));
});

const mocha = new Mocha({
  timeout: config.timeout,
  exit: config.exit,
  color: true
});

const specPatterns = Array.isArray(config.spec) ? config.spec : [config.spec];
specPatterns.forEach((pattern) => {
  const matches = globSync(pattern, {
    cwd: process.cwd(),
    absolute: true,
    nodir: true
  });

  matches.forEach((file) => mocha.addFile(file));
});

mocha.loadFiles();
mocha.run((failures) => {
  process.exitCode = failures ? 1 : 0;
});
