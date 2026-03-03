const { createProviderContext, autoFixMessages } = require("./llm-utils");

function hashIntegerToBase62(num) {
  const crypto = require("crypto");
  const base62chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const buffer = crypto.createHash("sha256").update(num.toString()).digest();

  let hashValue = "";
  for (let i = 0; hashValue.length < 9 && i < buffer.length; i++) {
    const index = buffer[i] % base62chars.length;
    hashValue += base62chars.charAt(index);
  }

  return hashValue.padEnd(9, "0");
}

async function fetchOpenRouterModels() {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    method: "GET",
  });

  if (!res.ok) throw new Error(`Error: ${res.status} ${res.statusText}`);
  const content = await res.json();
  return content.data;
}

module.exports = createProviderContext("openrouter", {
  apiKeyEnv: "OPENROUTER_KEY",
  apiModelFetcher: fetchOpenRouterModels,
  //modelMatcher: (name) => true, // Handle all names
  // modelFilter: (models, name) => {
  //   const baseName = name.split(":")[0];
  //   return models.filter(item => item.id === baseName);
  // },
  createExecFunction: (model, payload, key) => {
    const { messages, ...rest } = payload;

    // OpenRouter can proxy Mistral models (mistralai/...), which inherit Mistral's
    // restriction that tool_call_id / tool_calls[].id must be exactly 9 chars.
    // Apply the same formatting we do in the native Mistral provider.
    if (model?.id?.startsWith("mistralai/")) {
      messages.forEach((msg) => {
        if (msg.role === "tool") {
          msg.tool_call_id = hashIntegerToBase62(msg.tool_call_id);
        }
        if (msg.tool_calls) {
          msg.tool_calls.forEach((tc) => {
            tc.id = hashIntegerToBase62(tc.id);
          });
        }
      });
    }

    return {
      url: "https://openrouter.ai/api/v1/chat/completions",
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://iovdin.github.io/tune",
        "X-Title": "tune",
      },
      body: JSON.stringify({
        model: model.id,
        messages: autoFixMessages(messages).filter((msg) => msg.role !== "comment"),
        ...rest,
      }),
    };
  },
});
