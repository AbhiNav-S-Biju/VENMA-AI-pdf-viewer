import { createApp } from "./app.mjs";

const port = Number(process.env.PORT || 3001);
const configuredOrigins = (
  process.env.CORS_ORIGINS ||
  process.env.CORS_ORIGIN ||
  "http://127.0.0.1:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const app = createApp({ allowedOrigins: configuredOrigins });

app.listen(port, "127.0.0.1", () => {
  console.log(`VENMA AI server listening on http://127.0.0.1:${port}`);
});
