// Google Docs MCP Server — Zero dependencies
// OAuth 2.0 with auto-refresh, tokens stored in Cloudflare KV

const SERVER_INFO = { name: "google-docs-api", version: "1.1.0" };
const PROTOCOL_VERSION = "2024-11-05";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const KV_KEY = "google_oauth_tokens";
const SCOPES = "https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file";

async function getTokens(env) {
  const raw = await env.GOOGLE_TOKENS.get(KV_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}

async function saveTokens(env, tokens) {
  const existing = await getTokens(env);
  await env.GOOGLE_TOKENS.put(KV_KEY, JSON.stringify({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || existing?.refresh_token,
    expires_at: Date.now() + (tokens.expires_in || 3600) * 1000 - 60000,
  }));
}

async function refreshAccessToken(env) {
  const tokens = await getTokens(env);
  if (!tokens?.refresh_token) throw new Error("No refresh token. Visit /auth to authorize.");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(tokens.refresh_token)}&client_id=${encodeURIComponent(env.GOOGLE_CLIENT_ID)}&client_secret=${encodeURIComponent(env.GOOGLE_CLIENT_SECRET)}`,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  await saveTokens(env, data);
  return data.access_token;
}

async function getAccessToken(env) {
  const tokens = await getTokens(env);
  if (!tokens) throw new Error("Not authorized. Visit /auth to connect Google.");
  if (Date.now() < tokens.expires_at) return tokens.access_token;
  return await refreshAccessToken(env);
}

async function callDocs(env, method, path, body) {
  const token = await getAccessToken(env);
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`https://docs.googleapis.com/v1${path}`, {
    method, headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) return { _error: true, status: res.status, body: text };
  try { return JSON.parse(text); } catch { return text; }
}

async function callDrive(env, method, path, body) {
  const token = await getAccessToken(env);
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    method, headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) return { _error: true, status: res.status, body: text };
  try { return JSON.parse(text); } catch { return text; }
}

function toolResult(data) {
  return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

function buildMermaidUrl(mermaidSource) {
  const encoded = btoa(unescape(encodeURIComponent(mermaidSource)));
  return `https://mermaid.ink/img/${encoded}`;
}

const TOOLS = [
  {
    name: "doc_create",
    description: "Create a new Google Doc with a title and plain-text body content. Auto-shares as viewable by anyone with the link. Returns the document ID and URL.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title" },
        content: { type: "string", description: "Plain text content to insert into the document body" },
        folderId: { type: "string", description: "Optional Google Drive folder ID to place the doc in" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "doc_create_with_flowchart",
    description: "Create a new Google Doc with a Mermaid flowchart image inserted between contentBefore and contentAfter. Use for NDIB proposal docs that need a process diagram. Renders the Mermaid source as an image via mermaid.ink and inserts it inline. Auto-shares.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title" },
        contentBefore: { type: "string", description: "Text content BEFORE the flowchart (everything up to and including the Exactly How I Will header line)" },
        mermaidSource: { type: "string", description: "Mermaid graph TD source. Example: graph TD\\n    A[Set conversion objective] --> B[Write no contract creative]\\n    B --> C[Split by trade angle]" },
        contentAfter: { type: "string", description: "Text content AFTER the flowchart (numbered steps, What you'll get, Timeline)" },
        folderId: { type: "string", description: "Optional Google Drive folder ID" },
      },
      required: ["title", "contentBefore", "mermaidSource", "contentAfter"],
    },
  },
  {
    name: "doc_get",
    description: "Get the full content of a Google Doc by its document ID. Returns the title and plain-text body.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Google Doc ID (from the URL)" },
      },
      required: ["documentId"],
    },
  },
  {
    name: "doc_append",
    description: "Append plain text to the end of an existing Google Doc.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Google Doc ID" },
        content: { type: "string", description: "Text to append" },
      },
      required: ["documentId", "content"],
    },
  },
  {
    name: "doc_replace",
    description: "Replace all content in an existing Google Doc with new plain text.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Google Doc ID" },
        content: { type: "string", description: "New content to replace the entire body" },
      },
      required: ["documentId", "content"],
    },
  },
  {
    name: "doc_insert_image",
    description: "Insert an image into an existing Google Doc at a specific character index. Works with any publicly accessible image URL including mermaid.ink.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Google Doc ID" },
        imageUrl: { type: "string", description: "Publicly accessible image URL" },
        index: { type: "number", description: "Character index where the image should be inserted" },
      },
      required: ["documentId", "imageUrl", "index"],
    },
  },
  {
    name: "doc_share",
    description: "Make a Google Doc viewable (or writable) by anyone with the link.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Google Doc ID" },
        role: { type: "string", enum: ["reader", "writer", "commenter"], description: "Permission level (default: reader)" },
      },
      required: ["documentId"],
    },
  },
];

async function handleTool(env, name, args) {
  const a = args || {};
  switch (name) {
    case "doc_create": {
      const doc = await callDocs(env, "POST", "/documents", { title: a.title });
      if (doc._error) return toolResult(doc);
      const docId = doc.documentId;
      if (a.content) {
        await callDocs(env, "POST", `/documents/${docId}:batchUpdate`, {
          requests: [{ insertText: { location: { index: 1 }, text: a.content } }],
        });
      }
      if (a.folderId) {
        await callDrive(env, "PATCH", `/files/${docId}?addParents=${a.folderId}&fields=id`, {});
      }
      const token = await getAccessToken(env);
      await fetch(`https://www.googleapis.com/drive/v3/files/${docId}/permissions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });
      return toolResult({
        documentId: docId, title: a.title,
        url: `https://docs.google.com/document/d/${docId}/edit`,
        viewUrl: `https://docs.google.com/document/d/${docId}`,
        shared: true,
      });
    }

    case "doc_create_with_flowchart": {
      const doc = await callDocs(env, "POST", "/documents", { title: a.title });
      if (doc._error) return toolResult(doc);
      const docId = doc.documentId;
      let diagramInserted = false;

      await callDocs(env, "POST", `/documents/${docId}:batchUpdate`, {
        requests: [{ insertText: { location: { index: 1 }, text: a.contentBefore + "\n" } }],
      });

      const docAfterBefore = await callDocs(env, "GET", `/documents/${docId}`);
      if (!docAfterBefore._error) {
        const bodyContent = docAfterBefore.body?.content || [];
        const lastEl = bodyContent[bodyContent.length - 1];
        const insertIdx = lastEl?.endIndex ? lastEl.endIndex - 1 : 1;
        const imageUrl = buildMermaidUrl(a.mermaidSource);
        const imgResult = await callDocs(env, "POST", `/documents/${docId}:batchUpdate`, {
          requests: [{
            insertInlineImage: {
              location: { index: insertIdx },
              uri: imageUrl,
              objectSize: {
                width: { magnitude: 300, unit: "PT" },
                height: { magnitude: 350, unit: "PT" },
              },
            },
          }],
        });
        if (!imgResult._error) diagramInserted = true;
      }

      const docAfterImage = await callDocs(env, "GET", `/documents/${docId}`);
      if (!docAfterImage._error) {
        const bodyContent = docAfterImage.body?.content || [];
        const lastEl = bodyContent[bodyContent.length - 1];
        const afterIdx = lastEl?.endIndex ? lastEl.endIndex - 1 : 1;
        await callDocs(env, "POST", `/documents/${docId}:batchUpdate`, {
          requests: [{ insertText: { location: { index: afterIdx }, text: "\n" + a.contentAfter } }],
        });
      }

      if (a.folderId) {
        await callDrive(env, "PATCH", `/files/${docId}?addParents=${a.folderId}&fields=id`, {});
      }

      const token = await getAccessToken(env);
      await fetch(`https://www.googleapis.com/drive/v3/files/${docId}/permissions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });

      return toolResult({
        documentId: docId, title: a.title,
        url: `https://docs.google.com/document/d/${docId}/edit`,
        viewUrl: `https://docs.google.com/document/d/${docId}`,
        shared: true,
        diagramInserted,
      });
    }

    case "doc_get": {
      const doc = await callDocs(env, "GET", `/documents/${a.documentId}`);
      if (doc._error) return toolResult(doc);
      let text = "";
      if (doc.body?.content) {
        for (const el of doc.body.content) {
          if (el.paragraph?.elements) {
            for (const e of el.paragraph.elements) {
              if (e.textRun?.content) text += e.textRun.content;
            }
          }
        }
      }
      return toolResult({ documentId: doc.documentId, title: doc.title, content: text, url: `https://docs.google.com/document/d/${doc.documentId}/edit` });
    }

    case "doc_append": {
      const doc = await callDocs(env, "GET", `/documents/${a.documentId}`);
      if (doc._error) return toolResult(doc);
      const body = doc.body?.content || [];
      const lastEl = body[body.length - 1];
      const endIdx = lastEl?.endIndex ? lastEl.endIndex - 1 : 1;
      await callDocs(env, "POST", `/documents/${a.documentId}:batchUpdate`, {
        requests: [{ insertText: { location: { index: endIdx }, text: a.content } }],
      });
      return toolResult({ documentId: a.documentId, appended: true, url: `https://docs.google.com/document/d/${a.documentId}/edit` });
    }

    case "doc_replace": {
      const doc = await callDocs(env, "GET", `/documents/${a.documentId}`);
      if (doc._error) return toolResult(doc);
      const body = doc.body?.content || [];
      const lastEl = body[body.length - 1];
      const endIdx = lastEl?.endIndex ? lastEl.endIndex - 1 : 1;
      const requests = [];
      if (endIdx > 1) requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIdx } } });
      requests.push({ insertText: { location: { index: 1 }, text: a.content } });
      await callDocs(env, "POST", `/documents/${a.documentId}:batchUpdate`, { requests });
      return toolResult({ documentId: a.documentId, replaced: true, url: `https://docs.google.com/document/d/${a.documentId}/edit` });
    }

    case "doc_insert_image": {
      const result = await callDocs(env, "POST", `/documents/${a.documentId}:batchUpdate`, {
        requests: [{
          insertInlineImage: {
            location: { index: a.index },
            uri: a.imageUrl,
            objectSize: {
              width: { magnitude: 300, unit: "PT" },
              height: { magnitude: 350, unit: "PT" },
            },
          },
        }],
      });
      return toolResult({ documentId: a.documentId, imageInserted: !result._error, url: `https://docs.google.com/document/d/${a.documentId}/edit` });
    }

    case "doc_share": {
      const token = await getAccessToken(env);
      const role = a.role || "reader";
      await fetch(`https://www.googleapis.com/drive/v3/files/${a.documentId}/permissions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role, type: "anyone" }),
      });
      return toolResult({ documentId: a.documentId, shared: true, role, url: `https://docs.google.com/document/d/${a.documentId}/edit` });
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function jsonrpc(id, result) { return { jsonrpc: "2.0", id, result }; }
function jsonrpcError(id, code, message) { return { jsonrpc: "2.0", id, error: { code, message } }; }

async function handleRpc(env, req) {
  const { method, params, id } = req;
  switch (method) {
    case "initialize":
      return jsonrpc(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO });
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;
    case "ping":
      return jsonrpc(id, {});
    case "tools/list":
      return jsonrpc(id, { tools: TOOLS });
    case "tools/call": {
      const { name, arguments: toolArgs } = params || {};
      try {
        const result = await handleTool(env, name, toolArgs);
        return jsonrpc(id, result);
      } catch (err) {
        return jsonrpc(id, { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true });
      }
    }
    default:
      return jsonrpcError(id, -32601, `Method not found: ${method}`);
  }
}

function handleAuth(env, url) {
  const redirectUri = `${url.origin}/callback`;
  const authUrl = `${AUTH_URL}?client_id=${encodeURIComponent(env.GOOGLE_CLIENT_ID)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&redirect_uri=${encodeURIComponent(redirectUri)}&access_type=offline&prompt=consent`;
  return Response.redirect(authUrl, 302);
}

async function handleCallback(env, url) {
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) return new Response(`OAuth error: ${error}`, { status: 400 });
  if (!code) return new Response("Missing authorization code", { status: 400 });
  const redirectUri = `${url.origin}/callback`;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${encodeURIComponent(env.GOOGLE_CLIENT_ID)}&client_secret=${encodeURIComponent(env.GOOGLE_CLIENT_SECRET)}`,
  });
  if (!res.ok) {
    const err = await res.text();
    return new Response(`Token exchange failed: ${err}`, { status: 500 });
  }
  const tokens = await res.json();
  await saveTokens(env, tokens);
  return new Response(
    '<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h1>Connected to Google Docs!</h1><p>You can close this window. Brain now has access to Google Docs.</p></body></html>',
    { headers: { "Content-Type": "text/html" } }
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      const tokens = await getTokens(env);
      return Response.json({ status: "ok", google_connected: !!tokens?.refresh_token });
    }
    if (url.pathname === "/auth") return handleAuth(env, url);
    if (url.pathname === "/callback") return await handleCallback(env, url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id" },
      });
    }
    if (env.MCP_AUTH_TOKEN) {
      const auth = request.headers.get("Authorization");
      if (auth !== `Bearer ${env.MCP_AUTH_TOKEN}`) return new Response("Unauthorized", { status: 401 });
    }
    if (!url.pathname.startsWith("/mcp")) return new Response("Not found", { status: 404 });
    if (request.method === "GET") return new Response("Use POST for MCP requests", { status: 405 });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    let body;
    try { body = await request.json(); } catch { return Response.json(jsonrpcError(null, -32700, "Parse error"), { status: 400 }); }
    const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
    if (Array.isArray(body)) {
      const results = [];
      for (const req of body) { const res = await handleRpc(env, req); if (res !== null) results.push(res); }
      if (results.length === 0) return new Response(null, { status: 202, headers });
      return Response.json(results, { headers });
    }
    const result = await handleRpc(env, body);
    if (result === null) return new Response(null, { status: 202, headers });
    return Response.json(result, { headers });
  },
};
