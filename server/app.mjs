import express from "express";
import { createProvider } from "./provider.mjs";
import { validateExplainRequest } from "./validation.mjs";

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;

function getRequestTimeoutMs(config = process.env) {
  const value = Number(config.AI_REQUEST_TIMEOUT_MS || DEFAULT_REQUEST_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 5_000 && value <= 300_000
    ? value
    : DEFAULT_REQUEST_TIMEOUT_MS;
}

export function createApp({
  provider = createProvider(),
  allowedOrigin = "http://127.0.0.1:5173",
  allowedOrigins,
  requestTimeoutMs = getRequestTimeoutMs()
} = {}) {
  const app = express();
  const rateState = new Map();
  const originAllowlist = new Set(
    (allowedOrigins || [allowedOrigin]).filter(Boolean)
  );

  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use((request, response, next) => {
    const origin = request.get("origin");
    if (origin && !originAllowlist.has(origin)) {
      return response.status(403).json({ error: "Origin is not allowed." });
    }
    if (origin) {
      response.setHeader("access-control-allow-origin", origin);
      response.setHeader("vary", "Origin");
    }
    if (request.method === "OPTIONS") {
      response.setHeader("access-control-allow-methods", "POST, GET, OPTIONS");
      response.setHeader("access-control-allow-headers", "content-type");
      return response.sendStatus(204);
    }
    next();
  });

  const health = (_request, response) => {
    response.json({ ok: true, providerConfigured: provider.isConfigured });
  };
  app.get("/health", health);
  app.get("/api/health", health);
  app.get("/api/models", async (_request, response) => {
    const models = typeof provider.listModels === "function" ? provider.listModels() : [];
    const availability = typeof provider.getAvailability === "function"
      ? await provider.getAvailability()
      : [];
    const availabilityById = new Map(availability.map((entry) => [entry.id, entry.status]));
    response.json({
      models: models.map((model) => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
        suitability: model.suitability,
        temporary: Boolean(model.temporary),
        status: availabilityById.get(model.id) || model.status || "unknown"
      })),
      auto: true
    });
  });

  app.post("/api/explain", async (request, response) => {
    const now = Date.now();
    const key = request.ip || "unknown";
    const current = rateState.get(key);
    if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
      rateState.set(key, { startedAt: now, count: 1 });
    } else if (current.count >= RATE_LIMIT) {
      return response.status(429).json({ error: "Too many requests. Please try again shortly." });
    } else {
      current.count += 1;
    }

    const validation = validateExplainRequest(request.body);
    if (!validation.ok) {
      return response.status(400).json({ error: validation.message });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const result = await provider.explain(
        validation.value,
        controller.signal,
        validation.value.modelId
      );
      const text = typeof result === "string" ? result : result.text;
      return response.json({
        explanation: text,
        action: validation.value.action,
        language: validation.value.language,
        generatedBy: "VENMA AI",
        modelId: typeof result === "string" ? validation.value.modelId : result.modelId,
        provider: typeof result === "string" ? undefined : result.provider
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        return response.status(504).json({ error: "The AI provider timed out. Please retry." });
      }
      if (error?.code === "AI_NOT_CONFIGURED") {
        return response.status(503).json({ error: error.message, code: error.code });
      }
      if (error?.code === "AI_RATE_LIMITED") {
        response.setHeader("retry-after", error.retryAfter || "60");
        return response.status(429).json({
          error: "The selected AI provider is rate-limited. Please retry after the indicated delay or choose another model.",
          code: error.code
        });
      }
      if (error?.code === "AI_MODEL_NOT_ALLOWED") {
        return response.status(400).json({ error: "The selected AI model is not configured.", code: error.code });
      }
      if (error?.code === "AI_ALL_PROVIDERS_UNAVAILABLE") {
        return response.status(503).json({ error: "No configured AI provider is currently reachable.", code: error.code });
      }
      if (error?.code === "AI_AUTH_FAILED") {
        return response.status(503).json({ error: "The selected AI provider is not authenticated.", code: error.code });
      }
      console.error("AI explanation request failed", { code: error?.code || "UNKNOWN" });
      return response.status(502).json({ error: "The AI provider could not complete the request." });
    } finally {
      clearTimeout(timeout);
    }
  });

  app.use((error, _request, response, _next) => {
    if (error?.type === "entity.too.large") {
      return response.status(413).json({ error: "Request body is too large." });
    }
    console.error("Unhandled API error", { code: error?.code || "UNKNOWN" });
    return response.status(500).json({ error: "Unexpected server error." });
  });

  return app;
}
