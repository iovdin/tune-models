const assert = require('assert');

const fs = require('fs');
const path = require('path');
const tune = require('tune-sdk');
const models = require('../src/index');
const { openai, anthropic, groq, mistral, gemini, openrouter } = require('../src/index');

require('dotenv').config()

const env = { 
  OPENAI_KEY: process.env.OPENAI_KEY,
  ANTHROPIC_KEY: process.env.ANTHROPIC_KEY,
  GROQ_KEY: process.env.GROQ_KEY,
  MISTRAL_KEY: process.env.MISTRAL_KEY,
  GEMINI_KEY: process.env.GEMINI_KEY,
  OPENROUTER_KEY: process.env.OPENROUTER_KEY

}

const tests = {};

tests.api_keys = async function(){
  assert.ok(process.env.OPENAI_KEY, "OPENAI_KEY has to be set for testing") 
  assert.ok(process.env.ANTHROPIC_KEY, "ANTHROPIC_KEY has to be set for testing") 
  assert.ok(process.env.GROQ_KEY, "GROQ_KEY has to be set for testing") 
  assert.ok(process.env.MISTRAL_KEY, "MISTRAL_KEY has to be set for testing") 
  assert.ok(process.env.GEMINI_KEY, "GEMINI_KEY has to be set for testing") 
  assert.ok(process.env.OPENROUTER_KEY, "OPENROUTER_KEY has to be set for testing") 
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

tests.usage = async function() {

  let ctx = tune.makeContext(
    env,
    models({ cache: false })
  )

  let items = [
    { 
      model: "gpt-5-nano", 
      provider: "openai"
    }, 
    { 
      model: "gemini-2.5-flash",
      provider: "gemini" 
    },
    { 
      model: "claude-sonnet-4-20250514", 
      provider: "anthropic"
    },
    { 
      model: "qwen/qwen3-32b", 
      provider: "groq"
    },
    { 
      model: "mistral-small-latest",
      provider: "mistral" 
    },
  ] 

  const testUsage = (provider, model, stream) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Test timeout')), 15000);
      const lctx = ctx.clone();
      lctx.use(async function usage(p, m, u) {
        assert.equal(provider, p, `provider does not match ${provider} !== ${p}`)
        assert.equal(model, m, `provider does not match ${model} !== ${m}`)
        assert.ok(u, 'usage is empty')
        try {
          clearTimeout(timeout);
          assert.ok(u.prompt_tokens !== undefined, `prompt_tokens is not set for ${provider}/${model}`);
          assert.ok(u.completion_tokens !== undefined, `completion_tokens is not set for ${provider}/${model}`);
          assert.ok(u.total_tokens !== undefined, `total_tokens is not set for ${provider}/${model}`);
          assert.ok(typeof u.prompt_tokens === 'number', `prompt_tokens should be number for ${provider}/${model}`);
          assert.ok(typeof u.completion_tokens === 'number', `completion_tokens should be number for ${provider}/${model}`);
          assert.ok(typeof u.total_tokens === 'number', `total_tokens should be number for ${provider}/${model}`);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      lctx.text2run(`u: @${model} Hello, please respond with just 'Hi'`, { stream }).catch(reject);
    });
  };
  for (const item of items) {
    await testUsage(item.provider, item.model, false)
    await testUsage(item.provider, item.model, true)
  }
}

tests.errors = async function() {
  let ctx = tune.makeContext(openai({apiKey: "hello world"}))

  await assert.rejects(async () => ctx.resolve("model"),
    { message: /Incorrect API key/ }
  )
  ctx = tune.makeContext(anthropic({apiKey: "hello world"}))

  await assert.rejects(async () => ctx.resolve("model"),
    { message: /invalid x-api-key/ }
  )
  ctx = tune.makeContext(groq({apiKey: "hello world"}))

  await assert.rejects(async () => ctx.resolve("model"),
    { message: /Invalid API Key/ }
  )

  ctx = tune.makeContext(mistral({apiKey: "hello world"}))
  await assert.rejects(async () => ctx.resolve("model"),
    { message: /Unauthorized/ }
  )

  ctx = tune.makeContext(gemini({apiKey: "hello world"}))
  await assert.rejects(async () => ctx.resolve("model"),
    { message: /API key not valid/ }
  )
}


async function run(testList){
  testList = (testList && testList.length) ? testList : Object.keys(tests)
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
run(process.argv.slice(2));
