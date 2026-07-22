import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const rootDir = resolve(".");
const publicDir = join(rootDir, "public");
const uploadDir = join(rootDir, "uploads");

const languageNames = {
  auto: "auto detect",
  en: "English",
  ja: "Japanese",
  zh: "Chinese"
};

const sendJson = (res, status, payload) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
};

const sendText = (res, status, text, contentType = "text/plain; charset=utf-8") => {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(text);
};

const readBody = async (req, maxBytes = 120 * 1024 * 1024) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      throw new Error("File is too large. Please use a smaller file for the demo.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

const loadEnvFile = async () => {
  try {
    const env = await readFile(join(rootDir, ".env"), "utf8");
    for (const line of env.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = valueParts.join("=").trim();
    }
  } catch {
    // .env is optional; environment variables can be supplied by the shell.
  }
};

const safePublicPath = (pathname) => {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(publicDir, "." + requested);
  return filePath.startsWith(publicDir) ? filePath : null;
};

const contentTypeFor = (filePath) => {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
};

const splitSentences = (text) => {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。！？])\s+/u)
    .map((sentence, index) => ({ id: index + 1, text: sentence.trim() }))
    .filter((sentence) => sentence.text.length > 0);
};

const transcribeFile = async ({ filePath, fileName, mimeType, sourceLanguage }) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Create .env from .env.example first.");
  }

  const form = new FormData();
  const file = new File([await readFile(filePath)], fileName, { type: mimeType || "application/octet-stream" });
  form.append("file", file);
  form.append("model", "gpt-4o-mini-transcribe");
  form.append("response_format", "json");
  if (sourceLanguage && sourceLanguage !== "auto") {
    form.append("language", sourceLanguage);
  }

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || "Transcription request failed.");
  }

  const text = data.text || "";
  return {
    text,
    sentences: splitSentences(text)
  };
};

const explainSentence = async ({ sentence, sourceLanguage, explanationLanguage }) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Create .env from .env.example first.");
  }

  const source = languageNames[sourceLanguage] || sourceLanguage || "auto detect";
  const explanation = languageNames[explanationLanguage] || explanationLanguage || "Japanese";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You are a careful language tutor. Explain clearly and briefly. Return valid JSON only."
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Explain this sentence for language learning.",
            sentence,
            source_language: source,
            explanation_language: explanation,
            output_schema: {
              translation: "natural translation",
              grammar: "short grammar explanation",
              vocabulary: [{ word: "word or phrase", meaning: "meaning" }],
              example: { sentence: "similar example", translation: "example translation" }
            }
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "language_explanation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              translation: { type: "string" },
              grammar: { type: "string" },
              vocabulary: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    word: { type: "string" },
                    meaning: { type: "string" }
                  },
                  required: ["word", "meaning"]
                }
              },
              example: {
                type: "object",
                additionalProperties: false,
                properties: {
                  sentence: { type: "string" },
                  translation: { type: "string" }
                },
                required: ["sentence", "translation"]
              }
            },
            required: ["translation", "grammar", "vocabulary", "example"]
          }
        }
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || "Explanation request failed.");
  }

  const text = data.output_text || data.output?.[0]?.content?.[0]?.text || "{}";
  return JSON.parse(text);
};

const handleApi = async (req, res, url) => {
  if (url.pathname === "/api/transcribe" && req.method === "POST") {
    if (!process.env.OPENAI_API_KEY) {
      sendJson(res, 400, { error: "OPENAI_API_KEY is not set. Create .env from .env.example first." });
      return;
    }

    const fileName = req.headers["x-file-name"] || `upload-${randomUUID()}`;
    const mimeType = req.headers["content-type"] || "application/octet-stream";
    const sourceLanguage = req.headers["x-source-language"] || "auto";
    const safeName = String(fileName).replace(/[^\w.\-() ]+/g, "_");
    await mkdir(uploadDir, { recursive: true });
    const filePath = join(uploadDir, `${randomUUID()}-${safeName}`);

    try {
      const buffer = await readBody(req);
      await writeFile(filePath, buffer);
      const result = await transcribeFile({ filePath, fileName: safeName, mimeType, sourceLanguage });
      sendJson(res, 200, result);
    } finally {
      await rm(filePath, { force: true }).catch(() => {});
    }
    return;
  }

  if (url.pathname === "/api/explain" && req.method === "POST") {
    if (!process.env.OPENAI_API_KEY) {
      sendJson(res, 400, { error: "OPENAI_API_KEY is not set. Create .env from .env.example first." });
      return;
    }

    const body = JSON.parse((await readBody(req, 1024 * 1024)).toString("utf8"));
    if (!body.sentence) {
      sendJson(res, 400, { error: "sentence is required" });
      return;
    }
    const result = await explainSentence(body);
    sendJson(res, 200, result);
    return;
  }

  sendJson(res, 404, { error: "API route not found" });
};

await loadEnvFile();
const port = Number(process.env.PORT || 3000);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    const filePath = safePublicPath(url.pathname);
    if (!filePath) {
      sendText(res, 403, "Forbidden");
      return;
    }

    const file = await readFile(filePath);
    sendText(res, 200, file, contentTypeFor(filePath));
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(res, 404, "Not found");
      return;
    }
    console.error(error);
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(port, () => {
  console.log(`Local AI transcription tool running at http://localhost:${port}`);
});
