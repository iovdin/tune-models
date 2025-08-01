const openai = require("./openai.js")
const openrouter = require("./openrouter.js")
const anthropic = require("./antrophic.js")
const gemini = require("./gemini.js")
const mistral = require("./mistral.js")
const groq = require("./groq.js")

const tune = require("tune-sdk")

function createModelsMiddleware(options = {}) {
  const { 
    cache = true,           // disk cache by default for text editors
    cacheTtl = 3600000,     // 1 hour default
    default: defaultModel,
    apiKeys = {},
    expose = undefined, 
    alias = {}
  } = options;

  // Create configured providers
  const providers = [
    openai({ cache, cacheTtl, apiKey: apiKeys.openai }),
    openrouter({ cache, cacheTtl, apiKey: apiKeys.openrouter  }),
    anthropic({ cache, cacheTtl, apiKey: apiKeys.anthropic }),
    gemini({ cache, cacheTtl, apiKey: apiKeys.gemini}),
    mistral({ cache, cacheTtl, apiKey: apiKeys.mistral }),
    groq({ cache, cacheTtl, apiKey: apiKeys.groq })
  ];

  return async function models(name, args) {
    // Handle default model resolution
    if (name === "default" && args.type === "llm" && defaultModel) {
      return tune.resolve(this, defaultModel, args, providers);
    }


    // Handle aliases
    const resolvedName = alias[name] || name;
  
    // TODO: what if name is regex?
    if (expose && expose.indexOf(resolvedName) === -1) {
      return
    }

    return tune.resolve(this, resolvedName, args, providers);
  }
}

// Export main function and individual providers
module.exports = createModelsMiddleware;
module.exports.openai = openai;
module.exports.openrouter = openrouter;
module.exports.anthropic = anthropic;
module.exports.gemini = gemini;
module.exports.mistral = mistral;
module.exports.groq = groq;

