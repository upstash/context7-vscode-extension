import * as vscode from 'vscode';

const SERVER_URL = 'https://mcp.context7.com/mcp';
const OAUTH_SERVER_URL = `${SERVER_URL}/oauth`;

/**
 * Endpoint used to validate a Context7 API key before it is attached to the
 * MCP server definition. An anonymous request answers 200, a request carrying
 * an invalid key answers 401, so the status code alone tells us whether the
 * key may be used.
 */
const KEY_CHECK_URL = 'https://context7.com/api/v2/libs/search?libraryName=react';

const AUTH_MODE_STORAGE_KEY = 'context7.authMode';
const AUTH_MODE_CONTEXT_KEY = 'context7.authMode';

type AuthMode = 'token' | 'oauth';
type KeyCheck = 'valid' | 'invalid' | 'unknown';

const VALID_TTL_MS = 10 * 60 * 1000;
const INVALID_TTL_MS = 5 * 60 * 1000;
const UNKNOWN_TTL_MS = 60 * 1000;
const KEY_CHECK_TIMEOUT_MS = 10_000;

/** Prefix that every Context7 API key carries. */
const API_KEY_PREFIX = 'ctx7sk-';

/**
 * Fingerprint of the API key. The fingerprint is used as the server definition
 * version so VS Code notices that the credentials changed and asks for the
 * tools to be refreshed. The key itself never leaves the extension host.
 */
const fingerprint = (value: string): string => {
	let hash = 0x811c9dc5;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, '0');
};

export function activate(context: vscode.ExtensionContext) {
	const didChangeServerDefinitions = new vscode.EventEmitter<void>();
	context.subscriptions.push(didChangeServerDefinitions);

	let authMode: AuthMode = context.globalState.get<AuthMode>(AUTH_MODE_STORAGE_KEY, 'token');
	void vscode.commands.executeCommand('setContext', AUTH_MODE_CONTEXT_KEY, authMode);

	const keyCache = new Map<string, { check: KeyCheck; checkedAt: number }>();
	const inFlight = new Map<string, Promise<KeyCheck>>();
	const warnedKeys = new Set<string>();

	const getApiKey = (): string =>
		(vscode.workspace.getConfiguration('context7').get<string>('apiKey') ?? '').trim();

	/**
	 * Checks an API key against the Context7 API. The verdict is cached so the
	 * check is not repeated for every server start, and concurrent checks for
	 * the same key share a single request.
	 */
	const checkKey = (key: string, force = false): Promise<KeyCheck> => {
		const cached = keyCache.get(key);
		if (!force && cached) {
			const ttl =
				cached.check === 'valid'
					? VALID_TTL_MS
					: cached.check === 'invalid'
						? INVALID_TTL_MS
						: UNKNOWN_TTL_MS;
			if (Date.now() - cached.checkedAt < ttl) {
				return Promise.resolve(cached.check);
			}
		}

		const pending = inFlight.get(key);
		if (pending) {
			return pending;
		}

		const remember = (check: KeyCheck): KeyCheck => {
			keyCache.set(key, { check, checkedAt: Date.now() });
			return check;
		};

		const request = (async (): Promise<KeyCheck> => {
			// Context7 API keys always start with this prefix. Rejecting anything
			// else avoids a pointless round trip and gives a precise reason.
			if (!key.startsWith(API_KEY_PREFIX)) {
				return remember('invalid');
			}

			try {
				const response = await fetch(KEY_CHECK_URL, {
					method: 'HEAD',
					headers: { Authorization: `Bearer ${key}` },
					signal: AbortSignal.timeout(KEY_CHECK_TIMEOUT_MS),
				});
				// The API rejects a wrong key before it looks at the quota, so 401
				// and 403 mean the key itself is unusable.
				if (response.status === 401 || response.status === 403) {
					return remember('invalid');
				}
				// 402 and 429 mean the key authenticated but its quota or spending
				// limit is exhausted. The credential is good, so it is still sent.
				if (response.status === 402 || response.status === 429) {
					return remember('valid');
				}
				if (response.ok) {
					return remember('valid');
				}
			} catch {
				// The key could not be confirmed; fall back to anonymous access.
			}
			return remember('unknown');
		})().finally(() => inFlight.delete(key));

		inFlight.set(key, request);
		return request;
	};

	/**
	 * Builds the request headers for the current credentials.
	 *
	 * A missing or unusable key keeps the server on anonymous access. No
	 * credential is sent at all in that case, because Context7 answers a
	 * request carrying an invalid key with an error instead of falling back to
	 * the anonymous rate limit.
	 */
	const buildHeaders = async (): Promise<Record<string, string>> => {
		if (authMode === 'oauth') {
			// VS Code's native MCP OAuth flow provides the credential.
			return {};
		}

		const key = getApiKey();
		if (!key) {
			return {};
		}

		const check = await checkKey(key);
		if (check === 'valid') {
			return { Authorization: `Bearer ${key}` };
		}

		if (check === 'invalid' && !warnedKeys.has(key)) {
			warnedKeys.add(key);
			void vscode.window.showWarningMessage(
				vscode.l10n.t(
					'Context7: the configured API key was rejected by Context7. Continuing with anonymous access.'
				)
			);
		}
		return {};
	};

	const setAuthMode = async (mode: AuthMode): Promise<void> => {
		authMode = mode;
		await context.globalState.update(AUTH_MODE_STORAGE_KEY, mode);
		await vscode.commands.executeCommand('setContext', AUTH_MODE_CONTEXT_KEY, mode);
		didChangeServerDefinitions.fire();
	};

	context.subscriptions.push(vscode.commands.registerCommand('context7.useTokenMode', () => setAuthMode('token')));
	context.subscriptions.push(vscode.commands.registerCommand('context7.useOAuthMode', () => setAuthMode('oauth')));

	context.subscriptions.push(
		vscode.commands.registerCommand('context7.checkApiKey', async () => {
			const key = getApiKey();
			if (!key) {
				void vscode.window.showInformationMessage(
					vscode.l10n.t('Context7: no API key is configured. Set `context7.apiKey` to use account access.')
				);
				return;
			}
			const check = await checkKey(key, true);
			if (check === 'valid') {
				void vscode.window.showInformationMessage(vscode.l10n.t('Context7: the API key is valid.'));
			} else if (check === 'invalid') {
				void vscode.window.showWarningMessage(vscode.l10n.t('Context7: the API key was rejected by Context7.'));
			} else {
				void vscode.window.showWarningMessage(
					vscode.l10n.t('Context7: the API key could not be verified because Context7 did not answer.')
				);
			}
		})
	);

	// A new key invalidates the cached verdict and stops the running server so
	// the new credentials take effect.
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (!event.affectsConfiguration('context7.apiKey')) {
				return;
			}
			keyCache.clear();
			warnedKeys.clear();
			didChangeServerDefinitions.fire();
		})
	);

	context.subscriptions.push(
		vscode.lm.registerMcpServerDefinitionProvider('upstash/context7', {
			onDidChangeMcpServerDefinitions: didChangeServerDefinitions.event,
			async provideMcpServerDefinitions(): Promise<vscode.McpServerDefinition[]> {
				const key = getApiKey();
				const headers = await buildHeaders();
				return [
					new vscode.McpHttpServerDefinition(
						'Context7',
						vscode.Uri.parse(authMode === 'oauth' ? OAUTH_SERVER_URL : SERVER_URL),
						headers,
						// The version tells VS Code that the credentials changed, so it
						// stops the running server and refreshes the tool list.
						`${authMode}:${authMode === 'token' && key ? fingerprint(key) : 'anonymous'}`
					)
				];
			},
			async resolveMcpServerDefinition(server: vscode.McpHttpServerDefinition) {
				// The definition is resolved right before the server starts, so the
				// credential is validated one last time against the current setting.
				server.headers = await buildHeaders();
				return server;
			},
		})
	);
}

export function deactivate() {}