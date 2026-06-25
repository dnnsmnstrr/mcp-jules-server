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

const API_KEY = process.env.X_GOOG_API_KEY;
const BASE_URL = "https://jules.googleapis.com/v1alpha";

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_sources",
        description: "List available sources from Jules API",
        inputSchema: {
          type: "object",
          properties: {
            pageSize: { type: "integer", description: "Number of sources to return" },
            pageToken: { type: "string", description: "Page token for pagination" },
            filter: { type: "string", description: "AIP-160 filter expression" },
          },
        },
      },
      {
        name: "create_session",
        description: "Create a new session in Jules API",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The task description for Jules to execute" },
            title: { type: "string", description: "Optional title for the session" },
            sourceContext: {
              type: "object",
              properties: {
                source: { type: "string", description: "The source resource name (e.g., 'sources/...') " },
                githubRepoContext: {
                  type: "object",
                  properties: {
                    startingBranch: { type: "string", description: "The branch to start the session from" },
                  },
                  required: ["startingBranch"],
                },
              },
              required: ["source"],
            },
            requirePlanApproval: { type: "boolean", description: "If true, plans require explicit approval" },
            automationMode: { type: "string", description: "Automation mode (e.g., 'AUTO_CREATE_PR')" },
          },
          required: ["prompt"],
        },
      },
      {
        name: "get_session",
        description: "Retrieve a single session by ID",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "The ID of the session" },
          },
          required: ["sessionId"],
        },
      },
      {
        name: "list_sessions",
        description: "List all sessions for the user",
        inputSchema: {
          type: "object",
          properties: {
            pageSize: { type: "integer", description: "Number of sessions to return" },
            pageToken: { type: "string", description: "Page token for pagination" },
          },
        },
      },
      {
        name: "delete_session",
        description: "Delete a session",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "The ID of the session to delete" },
          },
          required: ["sessionId"],
        },
      },
      {
        name: "send_message",
        description: "Send a message to an active Jules session",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "The ID of the session" },
            prompt: { type: "string", description: "The message to send" },
          },
          required: ["sessionId", "prompt"],
        },
      },
      {
        name: "approve_plan",
        description: "Approve a pending plan in a session",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "The ID of the session" },
          },
          required: ["sessionId"],
        },
      },
      {
        name: "list_activities",
        description: "List all activities for a session",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "The ID of the session" },
            pageSize: { type: "integer", description: "Number of activities to return" },
            pageToken: { type: "string", description: "Page token for pagination" },
          },
          required: ["sessionId"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const apiKey = authStorage.getStore() || process.env.X_GOOG_API_KEY;
  const headers = { "X-Goog-Api-Key": apiKey };
  
  const { name, arguments: args } = request.params;

  switch (name) {
    case "list_sources": {
      const response = await axios.get(`${BASE_URL}/sources`, { headers, params: args });
      return { content: [{ type: "text", text: JSON.stringify(response.data) }] };
    }

    case "create_session": {
      const response = await axios.post(`${BASE_URL}/sessions`, args, { headers });
      return { content: [{ type: "text", text: JSON.stringify(response.data) }] };
    }

    case "get_session": {
      const { sessionId } = args as { sessionId: string };
      const response = await axios.get(`${BASE_URL}/sessions/${sessionId}`, { headers });
      return { content: [{ type: "text", text: JSON.stringify(response.data) }] };
    }

    case "list_sessions": {
      const response = await axios.get(`${BASE_URL}/sessions`, { headers, params: args });
      return { content: [{ type: "text", text: JSON.stringify(response.data) }] };
    }

    case "delete_session": {
      const { sessionId } = args as { sessionId: string };
      await axios.delete(`${BASE_URL}/sessions/${sessionId}`, { headers });
      return { content: [{ type: "text", text: "Session deleted" }] };
    }

    case "send_message": {
      const { sessionId, prompt } = args as { sessionId: string, prompt: string };
      const response = await axios.post(`${BASE_URL}/sessions/${sessionId}:sendMessage`, { prompt }, { headers });
      return { content: [{ type: "text", text: JSON.stringify(response.data) }] };
    }

    case "approve_plan": {
      const { sessionId } = args as { sessionId: string };
      const response = await axios.post(`${BASE_URL}/sessions/${sessionId}:approvePlan`, {}, { headers });
      return { content: [{ type: "text", text: JSON.stringify(response.data) }] };
    }

    case "list_activities": {
      const { sessionId, ...params } = args as { sessionId: string };
      const response = await axios.get(`${BASE_URL}/sessions/${sessionId}/activities`, { headers, params });
      return { content: [{ type: "text", text: JSON.stringify(response.data) }] };
    }

    default:
      throw new Error(`Tool not found: ${name}`);
  }
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
