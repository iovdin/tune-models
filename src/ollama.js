const { createProviderContext } = require("./llm-utils");

async function fetchOpenAIModels(url) {
  const res = await fetch(`${url}/v1/models`);

  if (!res.ok) throw new Error(`Error: ${res.status} ${res.statusText}`);
  const content = await res.json();
  return content.data;
}

module.exports = createProviderContext("openai", {
  apiKeyEnv: "OLLAMA_URL",
  apiModelFetcher: fetchOpenAIModels,
  createExecFunction: (model, payload, url) => {
    return {
      url: `${url}/v1/chat/completions`,
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: model.id,
        ...payload,
        messages: payload.messages.filter(msg => msg.role !== 'comment'),
      }),
    };
  }
});
