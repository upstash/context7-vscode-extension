# Changelog

## [Unreleased]

### Added

- API token mode (default): the `context7.apiKey` setting is validated against the Context7 API before it is attached to the MCP server definition, and the key is sent as `Authorization: Bearer <key>`. A valid key grants account access and the higher rate limit.
- `Context7: Check the configured API key` command to validate the configured key on demand.
- OAuth sign-in mode: `Context7: Switch to OAuth sign-in mode` uses `https://mcp.context7.com/mcp/oauth`, where VS Code's native MCP client runs the browser login flow and manages the token.
- Runtime message translations in `l10n/`, with English and Simplified Chinese bundles. The English bundle is generated from the source with `npm run l10n`.

### Changed

- A missing or unusable API key now falls back to anonymous access instead of being sent to the server. Context7 answers a request carrying an invalid key with an error rather than degrading to the anonymous rate limit, so the key is dropped instead.
- The server definition carries a version derived from the authentication mode and a fingerprint of the API key, so VS Code stops the running server and refreshes the tool list when the credentials change.
- The API key is checked once per server start instead of on every request. The verdict is cached for a few minutes.

## [1.1.0] - 2026-06-11

### Changed

- The extension now connects to the hosted Context7 MCP server (`https://mcp.context7.com/mcp`) over Streamable HTTP instead of bundling and spawning a local copy of `@upstash/context7-mcp`. The server is always up to date and no local Node.js process is spawned.
- Server definition ID updated to `upstash/context7` to match the entry in the official MCP registry, so VS Code can deduplicate the two ([#3](https://github.com/upstash/context7-vscode-extension/pull/3), thanks @sandy081).
- Switched from the proposed-API `vscode.d.ts` snapshot to the stable `@types/vscode` typings (the MCP server definition provider API is stable since VS Code 1.101).

### Added

- `context7.apiKey` setting: optionally provide a Context7 API key (from [context7.com/dashboard](https://context7.com/dashboard)) for higher rate limits and access to private repositories. Changing the key stops the server; restart it via the `MCP: List Servers` command (no window reload needed).
- MIT license text (the LICENSE file was previously empty).
- CI workflows for build verification and Marketplace publishing.

## [1.0.1] - 2025-08-04

- Initial Marketplace release: registers the Context7 MCP server (stdio, bundled `@upstash/context7-mcp`) with VS Code's built-in MCP support.
