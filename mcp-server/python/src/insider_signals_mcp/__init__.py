"""insider-signals-mcp — a thin stdio-to-HTTP proxy for the TradeStar Insider MCP server.

Exposes the remote server at https://mcp.tradestarinsider.com/mcp over local stdio so
any MCP client that expects a local command (Claude Desktop, Cursor, VS Code, ...) can use
it. The remote server stays the single source of truth: the tool list and every result are
read from it live and forwarded unchanged. No API key required.
"""

__version__ = "1.1.0"
