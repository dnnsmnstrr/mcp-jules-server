import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

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

const transport = new StdioServerTransport();
await server.connect(transport);
