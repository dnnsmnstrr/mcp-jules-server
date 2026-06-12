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
        name: "example_tool",
        description: "An example tool",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string" },
          },
          required: ["prompt"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "example_tool") {
    const prompt = String(request.params.arguments?.prompt);
    try {
      const response = await axios.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
        { contents: [{ parts: [{ text: prompt }] }] },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": API_KEY,
          },
        }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(response.data) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: "Error: " + error.message }],
        isError: true,
      };
    }
  }
  throw new Error("Tool not found");
});

const transport = new StdioServerTransport();
await server.connect(transport);
