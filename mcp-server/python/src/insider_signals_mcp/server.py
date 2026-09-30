"""Pure stdio-to-HTTP MCP proxy.

On start it opens a streamable-HTTP MCP connection to the remote TradeStar Insider server,
reads the tool list from there, and exposes exactly those tools over local stdio. Every
``tools/call`` is forwarded to the remote and its result passed back unchanged (``filing_url``
and all). There is no hardcoded tool list and no copied business logic — the remote server is
the single source of truth.
"""

from __future__ import annotations

import os
import sys
from contextlib import AsyncExitStack

import anyio
import httpx2
import mcp.types as types
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.server.lowlevel import Server
from mcp.server.lowlevel.server import ServerRequestContext
from mcp.server.stdio import stdio_server

from . import __version__

# The remote server this proxy fronts. Overridable for testing / self-hosting.
DEFAULT_REMOTE_URL = "https://mcp.tradestarinsider.com/mcp"
REMOTE_URL = (
    os.environ.get("INSIDER_SIGNALS_MCP_URL", "").strip() or DEFAULT_REMOTE_URL
)

STATUS_PAGE_URL = "https://status.tradestarinsider.com"

# Hard ceiling on any single remote round-trip. Never hang.
REMOTE_TIMEOUT_SECONDS = 30.0

# Sent as clientInfo.name so the remote access log can tell this channel apart. Real users
# through the proxy count as external usage; our own CI sets INSIDER_SIGNALS_MCP_TEST=1 so the
# remote excludes it like all other internal traffic.
CLIENT_NAME = "insider-signals-mcp"
if os.environ.get("INSIDER_SIGNALS_MCP_TEST"):
    CLIENT_NAME = "insider-signals-mcp-test"


class RemoteUnreachable(RuntimeError):
    """The remote MCP server could not be reached or did not answer in time."""


def _unreachable_message(detail: str) -> str:
    return (
        f"The TradeStar Insider MCP server at {REMOTE_URL} is unreachable "
        f"({detail}). Check the status page: {STATUS_PAGE_URL}"
    )


async def _run() -> None:
    """Connect to the remote once, then serve stdio backed by that live session."""
    # Bound every HTTP round-trip at the transport layer (connect + read). This keeps the
    # 30s ceiling without wrapping anyio task-group context managers in a fail_after scope,
    # which would corrupt anyio's cancel-scope stack.
    timeout = httpx2.Timeout(REMOTE_TIMEOUT_SECONDS, connect=REMOTE_TIMEOUT_SECONDS)

    async with AsyncExitStack() as stack:
        # 1) Open the downstream connection to the remote server.
        try:
            http_client = await stack.enter_async_context(
                httpx2.AsyncClient(timeout=timeout, follow_redirects=True)
            )
            read_r, write_r = await stack.enter_async_context(
                streamable_http_client(REMOTE_URL, http_client=http_client)
            )
            remote = await stack.enter_async_context(
                ClientSession(
                    read_r,
                    write_r,
                    read_timeout_seconds=REMOTE_TIMEOUT_SECONDS,
                    client_info=types.Implementation(
                        name=CLIENT_NAME, version=__version__
                    ),
                )
            )
            await remote.initialize()
            # 2) Read the tool list from the remote — the only source of truth.
            listed = await remote.list_tools()
        except Exception as exc:  # noqa: BLE001 — surface every startup failure cleanly
            raise RemoteUnreachable(_unreachable_message(repr(exc))) from exc

        remote_tools: list[types.Tool] = list(listed.tools)

        # 3) Build the upstream stdio server that mirrors those tools exactly.
        app: Server = Server("insider-signals-mcp", version=__version__)

        async def _list_tools(
            ctx: ServerRequestContext,
            params: types.PaginatedRequestParams | None,
        ) -> types.ListToolsResult:
            # Return the remote's tools verbatim (name, title, description, inputSchema).
            return types.ListToolsResult(tools=remote_tools)

        async def _call_tool(
            ctx: ServerRequestContext,
            params: types.CallToolRequestParams,
        ) -> types.CallToolResult:
            # Forward unchanged and pass the result straight back. The per-call read
            # timeout bounds the round-trip (never hang).
            try:
                result = await remote.call_tool(
                    params.name,
                    dict(params.arguments or {}),
                    read_timeout_seconds=REMOTE_TIMEOUT_SECONDS,
                )
            except Exception as exc:  # noqa: BLE001
                # Report as a tool error rather than crashing the whole proxy.
                return types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text", text=_unreachable_message(repr(exc))
                        )
                    ],
                    isError=True,
                )
            if isinstance(result, types.CallToolResult):
                return result
            # Defensive: older/newer client shapes — wrap into a CallToolResult.
            return types.CallToolResult(**result.model_dump())

        app.add_request_handler("tools/list", types.PaginatedRequestParams, _list_tools)
        app.add_request_handler("tools/call", types.CallToolRequestParams, _call_tool)

        # 4) Serve stdio.
        async with stdio_server() as (stdin, stdout):
            await app.run(stdin, stdout, app.create_initialization_options())


def _flatten(exc: BaseException) -> list[BaseException]:
    """Flatten (possibly nested) ExceptionGroups into a flat list of leaf exceptions."""
    if isinstance(exc, BaseExceptionGroup):
        out: list[BaseException] = []
        for sub in exc.exceptions:
            out.extend(_flatten(sub))
        return out
    return [exc]


def main() -> None:
    try:
        anyio.run(_run)
    except KeyboardInterrupt:
        raise SystemExit(0)
    except BaseException as exc:  # noqa: BLE001 — convert every failure to a clean message
        leaves = _flatten(exc)
        # Prefer our own explicit RemoteUnreachable message if present.
        for leaf in leaves:
            if isinstance(leaf, RemoteUnreachable):
                print(str(leaf), file=sys.stderr)
                raise SystemExit(1)
        # Otherwise summarize the underlying transport/connection failure cleanly —
        # never dump a raw traceback, never hang.
        detail = "; ".join(repr(leaf) for leaf in leaves) or repr(exc)
        print(_unreachable_message(detail), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
