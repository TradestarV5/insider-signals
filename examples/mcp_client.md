# Using the MCP server

The same filing-verified feed is available as a remote [Model Context Protocol](https://modelcontextprotocol.io)
server, so an AI assistant can query it directly. It is open, free, and per-IP rate limited —
no API key, no OAuth.

**Endpoint (Streamable HTTP):** `https://mcp.tradestarinsider.com/mcp`

## Add it to Claude

Claude Code CLI, one line:

```bash
claude mcp add --transport http insider-signals https://mcp.tradestarinsider.com/mcp
```

Any MCP client that supports remote Streamable HTTP servers connects the same way — point it at
the endpoint above. A static server card (name, description, tool list) is published at
`https://www.tradestarinsider.com/.well-known/mcp/server-card.json`.

## Then just ask

- "Show today's insider buy signals."
- "Any insider cluster buys this week? Link the filings."
- "Have insiders bought GME recently?"
- "Insider buys filed between 2026-09-01 and 2026-09-10 over $100k."

## Tools the server exposes

| Tool | What it returns |
|------|-----------------|
| `insider_signals_today` | Today's filing-verified insider open-market buy signals |
| `insider_signals_by_ticker` | Signals for a given ticker |
| `insider_signals_by_date_range` | Signals over a filed-date range |
| `insider_cluster_buys` | Cluster buys — 2+ insiders in one company within 7 days |
| `insider_filing_lookup` | A single Form 4 filing by accession number |
| `federal_awards_recent` | Recent federal contract awards (USAspending) |
| `activist_stakes_recent` | Recent activist 13D stakes (SEC EDGAR) |

## Calling the server programmatically

Using the official MCP Python SDK (`pip install mcp`):

```python
import asyncio
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

async def main():
    async with streamablehttp_client("https://mcp.tradestarinsider.com/mcp") as (r, w, _):
        async with ClientSession(r, w) as session:
            await session.initialize()
            tools = await session.list_tools()
            print("tools:", [t.name for t in tools.tools])
            result = await session.call_tool("insider_signals_today", {})
            print(result.content)

asyncio.run(main())
```

Every record carries a `filing_url` to its source on sec.gov. If a figure has no filing link,
it is not in this feed — the server drops unlinkable records rather than guessing (Rule 2).
