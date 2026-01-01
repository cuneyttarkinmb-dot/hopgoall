// functions/api/player.js
// /api/player
// iframe src içinde gerçek upstream linki göstermemek için proxy.
// Env:
// - PLAYER_UPSTREAM_URL (zorunlu)
// - ALLOWED_REF (opsiyonel)  ör: hopgoal.pages.dev
// - PLAYER_ALLOWED_HOSTS (opsiyonel) ör: trycloudflare.com,example.com

function b64UrlToStr(b64url) {
  try {
    const b64 = String(b64url || "").replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const bin = atob(b64 + pad);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

function hostAllowed(host, allowList) {
  const h = (host || "").toLowerCase();
  return allowList.some((a) => {
    const x = String(a || "").trim().toLowerCase();
    if (!x) return false;
    return h === x || h.endsWith("." + x);
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("u");

  // Referer kontrolü (tam koruma değil, sadece “kolay açmayı” azaltır)
  const ref = request.headers.get("referer") || "";
  const allowedRef = (env.ALLOWED_REF || "").trim(); // ör: hopgoal.pages.dev
  if (allowedRef && !ref.includes(allowedRef)) {
    return new Response("Forbidden", { status: 403 });
  }

  let upstream = (env.PLAYER_UPSTREAM_URL || "").trim();
  if (token) {
    const decoded = b64UrlToStr(token);
    if (decoded) upstream = decoded;
  }

  if (!upstream) return new Response("PLAYER_UPSTREAM_URL env yok", { status: 500 });

  let upstreamUrl;
  try {
    upstreamUrl = new URL(upstream);
  } catch {
    return new Response("Bad upstream url", { status: 400 });
  }

  // Host whitelist
  const allowHostsRaw = (env.PLAYER_ALLOWED_HOSTS || "").trim();
  let allowHosts = allowHostsRaw ? allowHostsRaw.split(",") : [];
  if (allowHosts.length === 0) allowHosts = ["trycloudflare.com"];

  if (!hostAllowed(upstreamUrl.hostname, allowHosts)) {
    return new Response("Upstream host not allowed", { status: 403 });
  }

  const r = await fetch(upstreamUrl.toString(), {
    headers: { "user-agent": request.headers.get("user-agent") || "" },
  });

  const html = await r.text();

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
