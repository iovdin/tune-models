const { createProviderContext, autoFixMessages } = require("./llm-utils");
const util = require("util")

async function fetchGeminiModels(apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`,
  );

  const content = await res.json();
  if (!res.ok) { 
    if (content?.error?.message) {
      throw new Error(content.error.message)
    }
    throw new Error(`${res.status} ${res.statusText}`);
  }

  content.models.forEach(model => {
    model.id = model.name.split("/")[1]
  })
  return content.models;
}

module.exports = createProviderContext("gemini", {
  apiKeyEnv: "GEMINI_KEY",
  apiModelFetcher: fetchGeminiModels,
  //modelMatcher: (name) => name.indexOf("google/") === 0,
  // modelFilter: (models, name, args) => {
  //   const shortName = name.split("/")[1];
  //   return models
  //     .map((item) => ({ ...item, shortName: item.name.split("/")[1] }))
  //     .filter((item) => item.shortName === shortName);
  // },
  
  hookMsg: (msg) => {
    if (!Array.isArray(msg.tool_calls)) {
      return msg
    }
    msg.tool_calls.forEach(toolCall => {
      const signature = toolCall.extra_content?.google?.thought_signature 
      if (!signature) {
        return
      }
      let args = toolCall.function.arguments
      if (typeof args === "string") {
        args = JSON.parse(args)
      }
      args.google_thought_signature = signature
      toolCall.function.arguments = JSON.stringify(args)

    })
    // console.log(util.inspect(msg, { depth: 10 }))
    return msg
  },
  createExecFunction: (model, payload, key) => {
    // google does not like content to be null
    payload.messages.forEach((message) => {
      if (message.content === null) {
        message.content = [];
      }
    });
    if (payload.stream) {
      payload.stream_options = { include_usage: true}
    }

    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model.shortName || model.name.split("/")[1],
        ...payload,
        messages: autoFixMessages(payload.messages).filter(msg => msg.role !== 'comment').map(msg => {
          if (! Array.isArray(msg.tool_calls)) {
            return msg
          }

          msg.tool_calls.forEach(toolCall => {
            const args = JSON.parse(toolCall.function.arguments)
            const thought_signature = args.google_thought_signature
            if (!thought_signature) {
              return
            }
            delete args.google_thought_signature
            toolCall.function.arguments = JSON.stringify(args)
            toolCall.extra_content = {
              google: { thought_signature }
            }
          })
          return msg
        }),
      }),
    };
  }
});
