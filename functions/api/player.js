// functions/api/player.js
// Amaç: myplayer.html'i kendi domaininden serve etmek.
// Böylece inspect'te trycloudflare linkin görünmez.

export async function onRequestGet({ request, env }) {
  const upstream = env.PLAYER_UPSTREAM_URL; // ör: https://xxxxx.trycloudflare.com/myplayer.html
  if (!upstream) {
    return new Response("PLAYER_UPSTREAM_URL env yok", { status: 500 });
  }

  // Basit "direct open" engeli (kolay aşılabilir ama işe yarar)
  const ref = request.headers.get("referer") || "";
  const allowed = (env.ALLOWED_REF || "").trim(); // ör: hopgoal.pages.dev
  if (allowed && !ref.includes(allowed)) {
    return new Response("Forbidden", { status: 403 });
  }

  const r = await fetch(upstream, {
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
