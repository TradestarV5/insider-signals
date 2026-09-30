#!/usr/bin/env node
/**
 * insider-signals-mcp — a thin stdio-to-HTTP proxy for the TradeStar Insider MCP server.
 *
 * On start it opens a streamable-HTTP MCP connection to the remote server, reads the tool
 * list from there, and exposes exactly those tools over local stdio. Every tools/call is
 * forwarded to the remote and its result passed back unchanged (filing_url and all). There
 * is no hardcoded tool list and no copied business logic — the remote server is the single
 * source of truth. No API key required.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const VERSION = "1.0.0";

const DEFAULT_REMOTE_URL = "https://mcp.tradestarinsider.com/mcp";
const REMOTE_URL =
  (process.env.INSIDER_SIGNALS_MCP_URL || "").trim() || DEFAULT_REMOTE_URL;

const STATUS_PAGE_URL = "https://status.tradestarinsider.com";

// Hard ceiling on any single remote round-trip (ms). Never hang.
const REMOTE_TIMEOUT_MS = 30000;

// Sent as clientInfo.name so the remote access log can tell this channel apart. Real users
// through the proxy count as external usage; our own CI sets INSIDER_SIGNALS_MCP_TEST=1 so the
// remote excludes it like all other internal traffic.
const CLIENT_NAME = process.env.INSIDER_SIGNALS_MCP_TEST
  ? "insider-signals-mcp-test"
  : "insider-signals-mcp";

function unreachableMessage(detail) {
  return (
    `The TradeStar Insider MCP server at ${REMOTE_URL} is unreachable ` +
    `(${detail}). Check the status page: ${STATUS_PAGE_URL}`
  );
}

async function main() {
  // 1) Open the downstream connection to the remote server.
  const remote = new Client(
    { name: CLIENT_NAME, version: VERSION },
    { capabilities: {} },
  );
  const transport = new StreamableHTTPClientTransport(new URL(REMOTE_URL));

  let remoteTools;
  try {
    await remote.connect(transport);
    // 2) Read the tool list from the remote — the only source of truth.
    const listed = await remote.listTools(undefined, {
      timeout: REMOTE_TIMEOUT_MS,
    });
    remoteTools = listed.tools;
  } catch (err) {
    // Startup could not reach the remote: exit non-zero with a clear message on stderr.
    process.stderr.write(unreachableMessage(String(err && err.message ? err.message : err)) + "\n");
    process.exit(1);
    return;
  }

  // 3) Build the upstream stdio server that mirrors those tools exactly.
  const app = new Server(
    { name: "insider-signals-mcp", version: VERSION },
    { capabilities: { tools: {} } },
  );

  app.setRequestHandler(ListToolsRequestSchema, async () => {
    // Return the remote's tools verbatim (name, title, description, inputSchema).
    return { tools: remoteTools };
  });

  app.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      // Forward unchanged and pass the result straight back.
      const result = await remote.callTool(
        { name, arguments: args || {} },
        undefined,
        { timeout: REMOTE_TIMEOUT_MS },
      );
      return result;
    } catch (err) {
      // Report as a tool error rather than crashing the whole proxy.
      return {
        content: [
          {
            type: "text",
            text: unreachableMessage(String(err && err.message ? err.message : err)),
          },
        ],
        isError: true,
      };
    }
  });

  // 4) Serve stdio.
  const stdio = new StdioServerTransport();
  await app.connect(stdio);
}

main().catch((err) => {
  process.stderr.write(unreachableMessage(String(err && err.message ? err.message : err)) + "\n");
  process.exit(1);
});
