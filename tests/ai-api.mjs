import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
import { createProvider } from "../server/provider.mjs";

const provider = {
  isConfigured: true,
  async explain(request) {
    return `Generated for ${request.action}: ${request.selectedText}`;
  }
};

const app = createApp({ provider });
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const port = server.address().port;
const url = `http://127.0.0.1:${port}`;

const health = await fetch(`${url}/health`);
assert.equal(health.status, 200);
assert.equal((await health.json()).ok, true);

const valid = await fetch(`${url}/api/explain`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ selectedText: "A closure captures variables.", action: "simple_explanation" })
});
assert.equal(valid.status, 200);
assert.equal((await valid.json()).action, "simple_explanation");

const invalid = await fetch(`${url}/api/explain`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ selectedText: "", action: "simple_explanation" })
});
assert.equal(invalid.status, 400);

const unknownAction = await fetch(`${url}/api/explain`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ selectedText: "text", action: "use_this_model" })
});
assert.equal(unknownAction.status, 400);

const rateLimitedApp = createApp({
  provider: {
    isConfigured: true,
    async explain() {
      const error = new Error("quota exhausted");
      error.code = "AI_RATE_LIMITED";
      throw error;
    }
  }
});
const rateLimitedServer = rateLimitedApp.listen(0, "127.0.0.1");
await new Promise((resolve) => rateLimitedServer.once("listening", resolve));
const rateLimitedUrl = `http://127.0.0.1:${rateLimitedServer.address().port}`;
const rateLimited = await fetch(`${rateLimitedUrl}/api/explain`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ selectedText: "text", action: "detailed_explanation" })
});
assert.equal(rateLimited.status, 429);
assert.equal((await rateLimited.json()).code, "AI_RATE_LIMITED");
rateLimitedServer.close();

const unconfigured = createProvider({});
assert.equal(unconfigured.isConfigured, false);
await assert.rejects(
  () => unconfigured.explain({ selectedText: "text", action: "summary", language: "en" }, new AbortController().signal),
  /AI provider is not configured/
);

const requests = [];
const fakeFetch = async (url, options) => {
  requests.push({ url, options });
  if (options?.method === "GET") {
    return new Response("{}", { status: 200 });
  }
  if (url.includes("groq")) {
    return new Response("busy", { status: 503 });
  }
  return new Response(JSON.stringify({
    choices: [{ message: { content: "fallback answer" } }]
  }), { status: 200, headers: { "content-type": "application/json" } });
};
const configured = createProvider({
  GROQ_API_KEY: "test-key",
  GROQ_API_URL: "https://groq.test/openai/v1/chat/completions",
  GROQ_MODEL: "configured-groq-model",
  OPENROUTER_API_KEY: "test-key",
  OPENROUTER_API_URL: "https://openrouter.test/api/v1/chat/completions",
  OPENROUTER_MODEL: "configured-router-model",
  AI_MODEL_PRIORITY: "groq:configured-groq-model,openrouter:configured-router-model"
}, { fetchImpl: fakeFetch });
assert.deepEqual(configured.listModels().map((model) => model.id), [
  "groq:configured-groq-model",
  "openrouter:configured-router-model"
]);
await assert.rejects(
  () => configured.explain({
    selectedText: "text",
    action: "summary",
    language: "en"
  }, new AbortController().signal, "not-allowlisted"),
  (error) => error.code === "AI_MODEL_NOT_ALLOWED"
);
const fallback = await configured.explain({
  selectedText: "text",
  action: "summary",
  language: "en"
}, new AbortController().signal);
assert.equal(fallback.text, "fallback answer");
assert.equal(fallback.modelId, "openrouter:configured-router-model");
assert.equal(requests.filter((request) => request.options?.method === "POST").length, 2);
const manual = await configured.explain({
  selectedText: "text",
  action: "summary",
  language: "en"
}, new AbortController().signal, "openrouter:configured-router-model");
assert.equal(manual.modelId, "openrouter:configured-router-model");
assert.equal(requests.filter((request) => request.options?.method === "POST").length, 3);

const timeoutProvider = createProvider({
  GROQ_API_KEY: "test-key",
  GROQ_API_URL: "https://groq.test/openai/v1/chat/completions",
  GROQ_MODEL: "timeout-model",
  AI_HEALTH_TIMEOUT_MS: "5"
}, {
  fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("timed out", "AbortError")), { once: true });
  })
});
assert.equal(await timeoutProvider.checkModel("groq:timeout-model"), "offline");

// Ollama is local and keyless: configured by model alone, no Authorization header sent.
const ollamaRequests = [];
const ollama = createProvider({ OLLAMA_MODEL: "llama3.1" }, {
  fetchImpl: async (url, options) => {
    ollamaRequests.push({ url, options });
    return new Response(JSON.stringify({ choices: [{ message: { content: "local answer" } }] }), { status: 200 });
  }
});
assert.deepEqual(ollama.listModels().map((model) => model.id), ["ollama:llama3.1"]);
const local = await ollama.explain({ selectedText: "text", action: "summary", language: "en" }, new AbortController().signal, "ollama:llama3.1");
assert.equal(local.text, "local answer");
assert.equal(ollamaRequests[0].url, "http://127.0.0.1:11434/v1/chat/completions");
assert.equal(ollamaRequests[0].options.headers.authorization, undefined);

// Keys never travel in URLs and never appear in what the browser can list.
const geminiRequests = [];
const gemini = createProvider({ GEMINI_API_KEY: "secret-gemini-key", GEMINI_MODEL: "gemini-test" }, {
  fetchImpl: async (url, options) => {
    geminiRequests.push({ url, options });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }), { status: 200 });
  }
});
await gemini.checkModel("gemini:gemini-test");
await gemini.explain({ selectedText: "text", action: "summary", language: "en" }, new AbortController().signal, "gemini:gemini-test");
for (const request of geminiRequests) {
  assert.ok(!String(request.url).includes("secret-gemini-key"), "API key leaked into a URL");
  assert.equal(request.options.headers["x-goog-api-key"], "secret-gemini-key");
}
for (const provider of [configured, gemini, ollama]) {
  const listed = JSON.stringify(provider.listModels());
  assert.ok(!listed.includes("test-key") && !listed.includes("secret-gemini-key"), "listModels exposed a credential");
  assert.ok(!listed.includes("healthUrl") && !listed.includes("headers"), "listModels exposed server internals");
}

server.close();
console.log("ai-api ok: health, validation, model allowlisting, fallback, keyless local models, and credential hygiene");
