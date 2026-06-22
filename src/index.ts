import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import express from "express";

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

const API_KEY = process.env.X_GOOG_API_KEY;

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
  const headers = { "X-Goog-Api-Key": API_KEY };
  
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

let transport: SSEServerTransport | null = null;

app.get("/sse", async (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("SSE transport not initialized");
  }
});

const PORT = parseInt(process.env.PORT || "9000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
