<!-- mcp-name: com.tradestarinsider/edgar-insider-signals -->

# insider-signals-mcp

A thin **local stdio MCP proxy** for the [TradeStar Insider](https://www.tradestarinsider.com)
server. It connects to the hosted MCP endpoint at `https://mcp.tradestarinsider.com/mcp`,
reads the tool list from there, and exposes exactly those tools over stdio — so any MCP client
that expects a local command (Claude Desktop, Cursor, VS Code, …) can use them.

- **No API key.** The free tier needs no credentials.
- **Nothing hardcoded.** The tool list and every result come straight from the remote server,
  which stays the single source of truth. Your client always sees the live tools.
- **Filing-verified data.** Every record carries its source `filing_url` on SEC.gov.

The tools cover SEC Form 4 insider-buy signals (today / by ticker / by date range / cluster
buys), filing lookup, recent federal awards, activist 13D stakes, 13F fund position changes,
and verification helpers.

## Install & run

Pick one — both start the same proxy and require no install step of their own:

```bash
# Python (via uv)
uvx insider-signals-mcp

# Node
npx -y insider-signals-mcp
```

An optional environment variable `INSIDER_SIGNALS_MCP_URL` overrides the endpoint (for
self-hosting or testing). If the remote is unreachable, the proxy returns a clear error
that includes the status page (`https://status.tradestarinsider.com`) — it never hangs
(30-second timeout) and never crashes silently.

## Client configuration

### Claude Desktop

`claude_desktop_config.json` → `mcpServers`:

```json
{
  "mcpServers": {
    "insider-signals": {
      "command": "uvx",
      "args": ["insider-signals-mcp"]
    }
  }
}
```

Node variant:

```json
{
  "mcpServers": {
    "insider-signals": {
      "command": "npx",
      "args": ["-y", "insider-signals-mcp"]
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json` (or **Settings → MCP → Add**):

```json
{
  "mcpServers": {
    "insider-signals": {
      "command": "uvx",
      "args": ["insider-signals-mcp"]
    }
  }
}
```

Node variant: replace with `"command": "npx", "args": ["-y", "insider-signals-mcp"]`.

### VS Code

`.vscode/mcp.json` in your workspace (or **MCP: Add Server**):

```json
{
  "servers": {
    "insider-signals": {
      "command": "uvx",
      "args": ["insider-signals-mcp"]
    }
  }
}
```

Node variant: replace with `"command": "npx", "args": ["-y", "insider-signals-mcp"]`.

## Prefer the hosted server directly?

Clients that support remote (streamable-HTTP) MCP servers can skip this proxy entirely and
point at `https://mcp.tradestarinsider.com/mcp`. This package exists for clients that only
accept a local command.

## Links

- Web: https://www.tradestarinsider.com
- Hosted MCP endpoint: https://mcp.tradestarinsider.com/mcp
- Status: https://status.tradestarinsider.com
- Source: https://github.com/TradestarV5/insider-signals

## License

MIT
