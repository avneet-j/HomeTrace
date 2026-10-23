import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer } from "./src/mcp-server.js";
import { load, save, seed, localDate } from "./src/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- MCP endpoint (Streamable HTTP, stateless) ----------
app.post("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error("MCP error:", e);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
});
const notAllowed = (_req, res) =>
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
app.get("/mcp", notAllowed);
app.delete("/mcp", notAllowed);

// ---------- Alexa+ simulator backend ----------
const sessions = new Map();

const SYSTEM = () =>
  `You are Alexa+, a warm, concise voice assistant running HomeTrace, the household maintenance memory. ` +
  `Today is ${new Date().toDateString()} (${localDate()}). ` +
  `Always use the tools to record or retrieve information; never answer from your own knowledge and never invent facts about the home. ` +
  `If a lookup returns nothing, say you have no record of it. ` +
  `Reply in at most 3 short spoken sentences, no markdown, no emojis. ` +
  `Convert relative dates like "today", "Friday" or "tomorrow" into YYYY-MM-DD. ` +
  `For durations like "again in six months" pass next_service_in_months instead of computing a date. ` +
  `For "next month" use within_days 31. For "last repaired" use find_service_history with type repair.`;

async function withMcp(fn) {
  const client = new Client({ name: "alexa-plus-simulator", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${PORT}/mcp`));
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

app.post("/api/chat", async (req, res) => {
  const sessionId = req.body?.sessionId || "default";
  try {
    const message = req.body?.message;
    if (!message) return res.status(400).json({ error: "message required" });

    const history = sessions.get(sessionId) || [];
    history.push({ role: "user", parts: [{ text: message }] });
    const toolCalls = [];

    const reply = await withMcp(async (client) => {
      const { tools } = await client.listTools();
      const functionDeclarations = tools.map((t) => ({
        name: t.name,
        description: t.description,
        parametersJsonSchema: t.inputSchema,
      }));

      for (let i = 0; i < 6; i++) {
        const response = await ai.models.generateContent({
          model: MODEL,
          contents: history,
          config: { systemInstruction: SYSTEM(), tools: [{ functionDeclarations }] },
        });
        history.push(response.candidates[0].content);
        const calls = response.functionCalls;
        if (!calls || calls.length === 0) return response.text || "Done.";

        const parts = [];
        for (const call of calls) {
          const result = await client.callTool({ name: call.name, arguments: call.args || {} });
          const out = (result.content || []).map((c) => c.text || "").join("\n");
          toolCalls.push({ name: call.name, args: call.args || {}, result: out });
          parts.push({ functionResponse: { name: call.name, response: { result: out } } });
        }
        history.push({ role: "user", parts });
      }
      return "Sorry, that took too many steps.";
    });

    sessions.set(sessionId, history.length > 40 ? [] : history);
    res.json({ reply, toolCalls });
  } catch (e) {
    console.error("Chat error:", e);
    sessions.delete(sessionId);
    res.status(500).json({ error: e.message || "Something went wrong" });
  }
});

app.get("/api/state", (_req, res) => {
  const d = load();
  res.json({
    appliances: d.appliances,
    logs: [...d.logs].sort((a, b) => b.date.localeCompare(a.date)),
    followups: d.followups,
  });
});

app.post("/api/seed", (_req, res) => {
  seed();
  sessions.clear();
  res.json({ ok: true });
});

app.post("/api/reset", (_req, res) => {
  save({ appliances: [], logs: [], followups: [], nextId: 1 });
  sessions.clear();
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`HomeTrace running: http://localhost:${PORT}  (MCP at /mcp)`));