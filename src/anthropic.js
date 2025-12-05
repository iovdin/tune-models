const { createProviderContext, autoFixMessages } = require("./llm-utils");

async function fetchAnthropicModels(apiKey) {
  const res = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    }
  });

  const content = await res.json();
  if (!res.ok) { 
    if (content?.error?.message) {
      throw new Error(content.error.message)
    }
    throw new Error(`${res.status} ${res.statusText}`);
  }

  return content.data;
}

module.exports = createProviderContext("anthropic", {
  apiKeyEnv: "ANTHROPIC_KEY",
  apiModelFetcher: fetchAnthropicModels,
  createExecFunction: (model, payload, key) => {

    if (payload.stream) {
      payload.stream_options = { include_usage: true}
    }
    return {
      url: "https://api.anthropic.com/v1/chat/completions",
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model.id,
        ...payload,
        messages: autoFixMessages(payload.messages).filter(msg => msg.role !== 'comment'),
      }),
    };
  }
});
