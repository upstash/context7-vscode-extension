# Context7 MCP Server for VS Code

This VS Code extension registers the [Context7](https://context7.com) MCP (Model Context Protocol) server with VS Code's built-in MCP support, giving AI assistants real-time access to up-to-date documentation for thousands of libraries and frameworks.

The extension connects to the hosted Context7 server at `https://mcp.context7.com/mcp`, so it is always running the latest version — no local server process, no manual updates.

## Features

- **Up-to-date Documentation**: Pulls version-specific documentation and code examples straight from the source into your AI assistant's context
- **Automatic Library Resolution**: Finds the right library documentation based on your query
- **Two Authentication Modes**: API token mode (default) or OAuth sign-in
- **Safe Token Handling**: An API key is validated before it is used, so a missing or invalid key never breaks the connection
## Installation

Install **Context7 MCP Server** from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Upstash.context7-mcp), or from the Extensions view in VS Code (`Upstash.context7-mcp`).

Requires VS Code 1.101 or later.

## Usage

Once installed, the Context7 MCP server is available to VS Code's AI features (e.g. Copilot Chat in agent mode). Ask questions like:

- "Show me how to use React hooks. use context7"
- "What are the best practices for Next.js routing? use context7"
- "How do I implement authentication with Supabase? use context7"

You can also reference a library directly by its Context7 ID:

```text
Implement basic authentication with Supabase. Use the API and documentation from the /supabase/supabase library.
```

> **Tip**: Add a rule to your AI assistant's instructions (e.g. `.github/copilot-instructions.md`) telling it to use Context7 for code generation and library questions, so you don't have to type `use context7` every time.

### Available Tools

1. **Resolve Context7 Library ID** — Resolves a package or product name to a Context7-compatible library ID
2. **Query Documentation** — Fetches up-to-date documentation for a library

## Authentication

Context7 offers two modes. Switch between them from the Command Palette; only the command for the mode you are not in is shown.

### API token mode (default)

The extension connects to `https://mcp.context7.com/mcp`. Set the `context7.apiKey` setting to a Context7 API key (`ctx7sk-...`) from [context7.com/dashboard](https://context7.com/dashboard) to use your account and its higher rate limit.

The key is **validated before it is sent**:

| Key state | Result |
| --- | --- |
| Valid | The request carries `Authorization: Bearer <key>` and uses your account |
| Missing | No credential is sent; the server falls back to anonymous access |
| Invalid (rejected by Context7) | No credential is sent, and a warning is shown; the server falls back to anonymous access |
| Context7 unreachable | No credential is sent; the server falls back to anonymous access |

The key is checked against the Context7 API before every server start. The verdict is cached for a few minutes, so a server restart does not issue a request each time.

Run `Context7: Check the configured API key` to validate the key on demand.

> **Note:** An invalid key is never sent to the server. Context7 answers a request carrying an invalid key with an error instead of falling back to anonymous access, so the key is dropped instead.

### OAuth sign-in mode

Run `Context7: Switch to OAuth sign-in mode` to use `https://mcp.context7.com/mcp/oauth`. VS Code's native MCP client opens the browser login flow when Context7 is first used in chat, and handles the account prompt, token storage, refresh, and revocation.

The extension does not implement or store OAuth tokens itself.

## Configuration

| Setting | Description |
| --- | --- |
| `context7.apiKey` | Optional Context7 API key for account access and the higher rate limit. An invalid key is ignored and the server continues anonymously. |

Changing the API key or the authentication mode stops the running server so the new credentials take effect. Restart it via **MCP: List Servers** → **Context7** → **Start Server** (or just send a new chat request, which prompts to start it) — no window reload required.

## Development

### Project Structure

```text
├── src/
│   └── extension.ts          # Main extension code
├── l10n/                     # Runtime message translations
├── package.json              # Extension manifest
├── package.nls.json          # Manifest translations (English)
├── package.nls.zh-cn.json    # Manifest translations (Simplified Chinese)
├── tsconfig.json             # TypeScript configuration
├── CHANGELOG.md              # Release notes
├── DEPLOYMENT.md             # Publishing guide
└── README.md                 # This file
```

### Building

```bash
npm install     # Install dependencies
npm run compile # Build the extension
```

### Localization

Manifest strings are localized with `package.nls.json` / `package.nls.<locale>.json`. Runtime messages are localized with `l10n/bundle.l10n.json` / `l10n/bundle.l10n.<locale>.json`.

The English runtime bundle is generated from the source, so run this after changing any `vscode.l10n.t()` call:

```bash
npm run l10n
```

Then translate the generated keys in `l10n/bundle.l10n.<locale>.json`.

### Testing

1. Open this repository in VS Code
2. Press F5 to launch the extension in a new Extension Development Host window
3. Run the **MCP: List Servers** command and confirm "Context7" is listed
4. Open Copilot Chat in agent mode and ask a library question with "use context7"

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Context7](https://context7.com) for providing the MCP server for real-time documentation access