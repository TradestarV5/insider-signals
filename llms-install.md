# Installing the Insider Buy Signals MCP server

This file is written for an AI coding agent (e.g. Cline) that is setting up this
MCP server on a user's behalf. Follow the steps exactly. The server needs **no API
key, no account, and no secrets** — every endpoint it uses is public.

## What this server does

`insider-signals-mcp` is a small stdio proxy to the hosted TradeStar Insider MCP
endpoint. It exposes verify tools that check a claim about a U.S. SEC filing —
an insider purchase (Form 4), an activist stake (13D), a corporate event (8-K), or
an institutional holding (13F) — field-by-field against the source filing on
sec.gov. Every number it returns is traceable to a parsed filing field; unlinked
records are dropped, never guessed (Rule 2).

## Option A — stdio proxy via `uvx` (recommended, no install)

Requires [`uv`](https://docs.astral.sh/uv/) on the user's machine (`uv --version`
to check; install from https://docs.astral.sh/uv/ if missing). The proxy itself
needs no separate install step — `uvx` fetches and runs it on demand.

Add this MCP server entry to the client's config:

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

- `command`: `uvx`
- `args`: `["insider-signals-mcp"]`
- No `env` block is needed — there are no credentials.

Verify it works: start the client, confirm the `insider-signals` server connects,
and list its tools. You should see the `verify_*` tools (insider purchase, 13D,
8-K, 13F) plus the daily-signal readers.

## Option B — point the client straight at the remote endpoint (no proxy)

If the client supports **Streamable HTTP** MCP transports directly, skip the proxy
and connect to the hosted endpoint:

```
https://mcp.tradestarinsider.com/mcp
```

- Transport: Streamable HTTP
- Auth: none (public, no key)

For Claude Code's CLI this is a one-liner:

```bash
claude mcp add --transport http insider-signals https://mcp.tradestarinsider.com/mcp
```

## After install — sanity check

Ask the server to verify a known public filing, for example:

> Verify that ORBIMED bought ETRA shares — check it against the SEC filing.

A correct install returns a verdict (`confirmed` / `not_found` / `partial` /
`out_of_scope` / `out_of_coverage`) with a `sec.gov` filing link and a coverage
window. If you get a connection error on Option A, confirm `uv` is installed and on
PATH; on Option B, confirm the client actually supports Streamable HTTP (if not,
fall back to Option A).

## Links

- Website: https://www.tradestarinsider.com
- MCP endpoint: https://mcp.tradestarinsider.com/mcp
- REST (OpenAPI 3.0.2): https://api.tradestarinsider.com/v1/openapi.json
- Live status: https://status.tradestarinsider.com
- Source + examples: https://github.com/TradestarV5/insider-signals
