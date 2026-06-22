import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import express from "express";
import { AsyncLocalStorage } from "node:async_hooks";

const authStorage = new AsyncLocalStorage<string>();

const server = new Server(
  {
    name: "mcp-jules-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_sources",
        description: "List available sources from Jules API",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "create_session",
        description: "Create a new session in Jules API",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "send_message",
        description: "Send a message to a Jules session",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
            message: { type: "string" },
          },
          required: ["sessionId", "message"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const apiKey = authStorage.getStore() || process.env.X_GOOG_API_KEY;
  const headers = { "X-Goog-Api-Key": apiKey };
  
  if (request.params.name === "list_sources") {
    const response = await axios.get("https://jules.google/v1/sources", { headers });
    return { content: [{ type: "text", text: JSON.stringify(response.data) }] };
  }
  
  if (request.params.name === "create_session") {
    const response = await axios.post("https://jules.google/v1/sessions", {}, { headers });
    return { content: [{ type: "text", text: JSON.stringify(response.data) }] };
  }
  
  if (request.params.name === "send_message") {
    const { sessionId, message } = request.params.arguments as { sessionId: string, message: string };
    const response = await axios.post(`https://jules.google/v1/sessions/${sessionId}/messages`, { message }, { headers });
    return { content: [{ type: "text", text: JSON.stringify(response.data) }] };
  }
  
  throw new Error("Tool not found");
});

const app = express();
app.use(express.json());

// Map to store transports by session ID
const transports = new Map<string, SSEServerTransport>();

app.get("/sse", async (req, res) => {
  const sessionId = Math.random().toString(36).substring(2);
  
  // Set headers for SSE and Uberspace/Proxy compatibility
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const transport = new SSEServerTransport(`/messages?sessionId=${sessionId}`, res);
  transports.set(sessionId, transport);
  
  // Heartbeat to keep connection alive on Uberspace
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  res.on('close', () => {
    clearInterval(heartbeat);
    transports.delete(sessionId);
    console.log(`Connection closed: ${sessionId}`);
  });

  await server.connect(transport);
  console.log(`New SSE connection: ${sessionId}`);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(400).send("Invalid session ID or SSE transport not initialized");
    return;
  }

  // Extract API key from Authorization header
  const authHeader = req.headers.authorization;
  const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : "";

  // Run the handler within the context of the extracted API key
  await authStorage.run(apiKey, async () => {
    await transport.handlePostMessage(req, res);
  });
});

const PORT = parseInt(process.env.PORT || "9000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
