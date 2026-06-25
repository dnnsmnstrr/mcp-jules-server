import axios from "axios";

const BASE_URL = "https://jules.googleapis.com/v1alpha";
const API_KEY = "test-api-key";
const headers = { "X-Goog-Api-Key": API_KEY };

async function callTool(name: string, args: any) {
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
}

async function runTests() {
  console.log("Running tests...");

  const calls: any = { get: [], post: [], delete: [] };
  const mockedAxios: any = {
      get: (url: string, config: any) => {
          calls.get.push([url, config]);
          return Promise.resolve({ data: { success: true } });
      },
      post: (url: string, body: any, config: any) => {
          calls.post.push([url, body, config]);
          return Promise.resolve({ data: { success: true } });
      },
      delete: (url: string, config: any) => {
          calls.delete.push([url, config]);
          return Promise.resolve({ data: { success: true } });
      }
  };

  // Override axios
  (axios as any).get = mockedAxios.get;
  (axios as any).post = mockedAxios.post;
  (axios as any).delete = mockedAxios.delete;

  // Test list_sources
  await callTool("list_sources", { pageSize: 10 });
  if (calls.get[0][0] !== `${BASE_URL}/sources`) throw new Error("list_sources URL mismatch");
  console.log("✓ list_sources passed");

  // Test create_session
  await callTool("create_session", { prompt: "test prompt" });
  if (calls.post[0][0] !== `${BASE_URL}/sessions`) throw new Error("create_session URL mismatch");
  if (calls.post[0][1].prompt !== "test prompt") throw new Error("create_session body mismatch");
  console.log("✓ create_session passed");

  // Test get_session
  await callTool("get_session", { sessionId: "123" });
  if (calls.get[1][0] !== `${BASE_URL}/sessions/123`) throw new Error("get_session URL mismatch");
  console.log("✓ get_session passed");

  // Test send_message
  await callTool("send_message", { sessionId: "123", prompt: "hello" });
  if (calls.post[1][0] !== `${BASE_URL}/sessions/123:sendMessage`) throw new Error("send_message URL mismatch");
  if (calls.post[1][1].prompt !== "hello") throw new Error("send_message body mismatch");
  console.log("✓ send_message passed");

  // Test approve_plan
  await callTool("approve_plan", { sessionId: "123" });
  if (calls.post[2][0] !== `${BASE_URL}/sessions/123:approvePlan`) throw new Error("approve_plan URL mismatch");
  console.log("✓ approve_plan passed");

  // Test list_activities
  await callTool("list_activities", { sessionId: "123", pageSize: 5 });
  if (calls.get[2][0] !== `${BASE_URL}/sessions/123/activities`) throw new Error("list_activities URL mismatch");
  console.log("✓ list_activities passed");

  // Test delete_session
  await callTool("delete_session", { sessionId: "123" });
  if (calls.delete[0][0] !== `${BASE_URL}/sessions/123`) throw new Error("delete_session URL mismatch");
  console.log("✓ delete_session passed");

  console.log("All tests passed!");
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
