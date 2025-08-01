const assert = require('assert');

const fs = require('fs');
const path = require('path');
const tune = require('tune-sdk');
const models = require('../src/index');
const { openai, anthropic } = require('../src/index');

require('dotenv').config()

const env = { 
  OPENAI_KEY: process.env.OPENAI_KEY
}

const tests = {};

tests.api_keys = async function(){
  assert.ok(process.env.OPENAI_KEY, "OPENAI_KEY has to be set for testing") 
  assert.ok(process.env.ANTHROPIC_KEY, "ANTHROPIC_KEY has to be set for testing") 
}

tests.not_found = async function(){
  const ctx = tune.makeContext(
    env,
    models()
  )
  const result = await ctx.resolve("not_found")
  assert.ok(!result, "not found result is not set") 
}

tests.default_not_founnd = async function(){
  const ctx = tune.makeContext(
    env,
    models()
  )
  const result = await ctx.resolve("default", {type: "llm"} )
  assert.ok(!result, "default llm has found") 
}

tests.default = async function(){
  const ctx = tune.makeContext(
    env,
    models({"default": "gpt-4.1-mini"})
  )
  const result = await ctx.resolve("default", {type: "llm"} )
  assert.equal(result.type, "llm", "return type has to be 'llm' for default") 
  assert.ok(typeof(result.exec), "function", "exec has to be function") 
}

tests.default_specific = async function(){
  const ctx = tune.makeContext(
    env,
    openai({"default": "gpt-4.1-mini"})
  )
  const result = await ctx.resolve("default", {type: "llm"} )
  assert.equal(result.type, "llm", "return type has to be 'llm' for default") 
  assert.ok(typeof(result.exec), "function", "exec has to be function") 
}

tests.simple_model = async function() {
  let ctx = tune.makeContext(
    env,
    models()
  )
  let result = await ctx.resolve("gpt-4.1-mini")
  assert.ok(result, "gpt-4.1-mini not found") 

  ctx = tune.makeContext(
    env,
    openai()
  )
  result = await ctx.resolve("gpt-4.1-mini")
  assert.ok(result, "gpt-4.1-mini not found") 
}

tests.alias = async function() {
  let ctx = tune.makeContext(
    env,
    models({ alias: {"gpt": "gpt-4.1-mini"}} )
  )
  let result = await ctx.resolve("gpt")
  assert.ok(result, "alias gpt-4.1-mini not found") 

  ctx = tune.makeContext(
    env,
    openai({ alias: {"gpt": "gpt-4.1-mini"}} )
  )
  result = await ctx.resolve("gpt-4.1-mini")
  assert.ok(result, "alias gpt-4.1-mini not found") 
}

tests.resolve_type_image = async function() {
  const ctx = tune.makeContext(
    env,
    models()
  )
  const result = await ctx.resolve("gpt-4.1-mini", {type: "image"})
  assert.ok(!result, "gpt-4.1-mini image is found") 
}

tests.output_all = async function() {
  const ctx = tune.makeContext(
    env,
    models()
  )
  const result = await ctx.resolve("gpt.*", {type: "llm", match: 'regex', output: 'all'})
  assert.ok(Array.isArray(result), 'it is not array')
  assert.ok(result.length, 'it is empty')
  assert.ok(result[0].type, "llm", 'first result is not llm')
}

tests.api_keys = async function () {
  let ctx = tune.makeContext(
    env,
    models({apiKeys: { anthropic: process.env.ANTHROPIC_KEY}})
  )
  let result = await ctx.resolve("claude.*", { match: 'regex' })
  assert.ok(result, 'claude not found')

  ctx = tune.makeContext(
    env,
    anthropic({apiKey: process.env.ANTHROPIC_KEY})
  )
  result = await ctx.resolve("claude.*", { match: 'regex' })
  assert.ok(result, 'claude not found')
}

tests.mount = async function () {
  const ctx = tune.makeContext( env, openai({ mount: "openai" }))
  let result = await ctx.resolve("gpt-4.1-mini" )
  assert.ok(!result, "found without prefix")
  result = await ctx.resolve("openai/gpt-4.1-mini" )
  assert.ok(result, "not found with prefix")
}

tests.expose = async function () {
  let ctx = tune.makeContext( env, openai({ expose: ["gpt-4.1-mini"] }))

  let result =  await ctx.resolve("gpt-4.1-mini")
  assert.ok(result, "exposed gpt-4.1-mini not found")
  result = await ctx.resolve("gpt-4.1")
  assert.ok(!result, "non exposed gpt-4.1 found")

  ctx = tune.makeContext( env, models({ expose: ["gpt-4.1-mini"] }))

  result =  await ctx.resolve("gpt-4.1-mini")
  assert.ok(result, "exposed gpt-4.1-mini not found")
  result = await ctx.resolve("gpt-4.1")
  assert.ok(!result, "non exposed gpt-4.1 found")
}


tests.z_cache = async function () {

  const cachePath = (path.resolve("./src/.cache"))
  if (fs.existsSync(cachePath)) {
    fs.rmSync(cachePath, { recursive: true })
  }

  let ctx = tune.makeContext(
    env,
    models({ cache: false })
  )
  let start = process.hrtime();
  let result = await ctx.resolve("gpt-4.1-mini" )
  let diff = process.hrtime(start);

  assert.ok(result, 'gpt-4.1-min not found')
  assert.ok(!fs.existsSync(cachePath), "cache created, it should not")

  start = process.hrtime();
  result = await ctx.resolve("gpt-4.1-mini" )
  diff = process.hrtime(start);
  assert.ok(diff[1] / 1e6 < 1 , "should user memory cache took more than 1 milli second")

  ctx = tune.makeContext( env, openai({ cache: true }))
  result = await ctx.resolve("gpt-4.1-mini" )
  assert.ok(fs.existsSync(cachePath), "cache not created, it not")

}


async function run(testList){
  testList = testList || Object.keys(tests)
  let curTest
  while(curTest = testList.shift()) {
    try {
      await tests[curTest]()
      console.log(`pass: ${curTest}`)
    } catch (e) {
      console.log(`fail: ${curTest} ${e}`)
    }
  }
  

}
run();
