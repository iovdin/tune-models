# Tune Models

LLM models middleware for [Tune](https://github.com/tune-sdk/tune-sdk) - chat with AI directly in your text editor.

This middleware connects popular AI models like OpenAI, Anthropic, and others to your Tune setup.

## Available Models

```chat
 system: @gpt-4.1-mini

 user: 
 what is 2+2?

 assistant: 
 2+2 equals 4.

 system: @claude-3-sonnet  

 user: 
 explain quantum computing briefly

 assistant: 
 Quantum computing uses quantum bits that can exist in multiple states...
```

Supports:
- **OpenAI**: gpt-4, gpt-4.1-mini, gpt-3.5-turbo, etc.
- **Anthropic**: claude-3-5-sonnet, claude-3-haiku, claude-3-opus, etc.  
- **OpenRouter**: Access to hundreds of models from various providers
- **Google Gemini**: gemini-pro, gemini-1.5-pro, gemini-flash, etc.
- **Mistral**: mistral-large, mistral-medium, mistral-small, etc.
- **Groq**: llama3-70b-8192, mixtral-8x7b-32768, gemma-7b-it, etc.

It fetches the list of latest models from provider's api.

## Setup for Text Editor

Install globally in your `~/.tune` folder:

```bash
cd ~/.tune
npm install tune-models
```

Add to `~/.tune/default.ctx.js`:

```javascript
const models = require('tune-models')

module.exports = [
    ...
    models({
        default: "gpt-4.1",
        ...
    })
    ...
]
```

Set your API keys in environment or `~/.tune/.env`:
```
OPENAI_KEY=sk-...
ANTHROPIC_KEY=sk-ant-...
OPENROUTER_KEY=sk-or-...
GEMINI_KEY=AI...
MISTRAL_KEY=...
GROQ_KEY=gsk_...
```

## Setup for JavaScript Project

```bash
npm install tune-models tune-sdk
```

```javascript
const tune = require('tune-sdk')
const { openai, anthropic } = require('tune-models')

const ctx = tune.makeContext(
    { OPENAI_KEY: process.env.OPENAI_KEY }, 
    openai({ expose: ["gpt-4.1", "gpt-4.1-mini"], cache: false }), 
    anthropic({ apiKey: 'sk-ant-...' }))

const result = await ctx.text2run(`
 system: @gpt-4.1-mini
 user: hello
`)
```

## Configuration Options

### All Providers
```javascript
models({
  // Set default model when no @model specified
  default: "gpt-4.1-mini",
  
  // Create aliases for models  
  alias: { "gpt": "gpt-4.1-mini" },
  
  // Only expose specific models
  expose: ["gpt-4.1-mini", "claude-3-sonnet"],
  
  // Mount under prefix: @models/gpt-4.1-mini
  mount: "models",
  
  // Cache model lists on disk (default: true)
  cache: true,
  cache_ttl: 3600000, // 1 hour
  
  // API keys for all providers
  apiKeys: {
    openai: process.env.OPENAI_KEY,
    anthropic: process.env.ANTHROPIC_KEY
  }
})
```

### Provider-Specific
```javascript
openai({ 
  default: "gpt-4.1-mini",
  apiKey: "sk-...",
  mount: "openai",
  expose: ["gpt-4.1-mini"]
  cache: true,
})

```
