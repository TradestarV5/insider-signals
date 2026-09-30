/**
 * Smoke test: spawn the proxy over stdio, list tools, compare against the remote directly,
 * and do one real tools/call asserting filing_url is present.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = resolve(__dirname, "..", "index.js");
const REMOTE = "https://mcp.tradestarinsider.com/mcp";

function schemaKey(tools) {
  return tools.map((t) => `${t.name}::${JSON.stringify(t.inputSchema)}`);
}

async function remoteTools() {
  const c = new Client({ name: "smoke", version: "0" }, { capabilities: {} });
  await c.connect(new StreamableHTTPClientTransport(new URL(REMOTE)));
  const r = await c.listTools();
  await c.close();
  return r.tools;
}

async function viaProxy() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [ENTRY],
    env: { ...process.env, INSIDER_SIGNALS_MCP_TEST: "1" },
  });
  const c = new Client({ name: "smoke", version: "0" }, { capabilities: {} });
  await c.connect(transport);
  const list = await c.listTools();
  const call = await c.callTool({
    name: "insider_signals_today",
    arguments: { limit: 3 },
  });
  await c.close();
  return { tools: list.tools, call };
}

const rem = await remoteTools();
const { tools: prx, call } = await viaProxy();

console.log("REMOTE tool count:", rem.length);
console.log("PROXY  tool count:", prx.length);

const remKey = schemaKey(rem).join("\n");
const prxKey = schemaKey(prx).join("\n");
if (remKey !== prxKey) {
  console.error("SCHEMA/NAME MISMATCH");
  console.error("remote:", remKey);
  console.error("proxy :", prxKey);
  process.exit(1);
}
console.log("NAMES + SCHEMAS MATCH EXACTLY ✓");

const blob = JSON.stringify(call);
const found = blob.includes("filing_url");
console.log("tools/call isError:", !!call.isError);
console.log("filing_url present in result:", found);
if (call.isError) {
  console.error("tools/call returned isError");
  process.exit(1);
}
if (!found) {
  console.error("filing_url missing from tools/call result");
  process.exit(1);
}
console.log("REAL tools/call → records with filing_url ✓");
console.log("\nALL ACCEPTANCE CHECKS PASS");
