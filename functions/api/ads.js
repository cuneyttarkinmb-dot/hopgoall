// functions/api/ads.js
// Env: ADS_SHEET_URL

const TTL_MS = 10 * 1000;
let cache = { ts: 0, payload: null };

export async function onRequestGet({ env }) {
  try {
    const url = (env.ADS_SHEET_URL || "").trim();
    if (!url) {
      return new Response(JSON.stringify({ ok: false, error: "ADS_SHEET_URL env yok" }), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    if (cache.payload && Date.now() - cache.ts < TTL_MS) {
      return new Response(JSON.stringify(cache.payload), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }

    const r = await fetch(url, { headers: { accept: "application/json" } });
    const text = await r.text();
    const t = (text || "").trim();

    // Upstream 500/403/404 vs. burada net görünsün
    if (!r.ok) {
      const preview = t.slice(0, 200);
      return new Response(JSON.stringify({ ok: false, error: `Upstream HTTP ${r.status}`, preview }), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }

    // Apps Script bazen HTML döndürür
    if (t.startsWith("<")) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Apps Script JSON dönmüyor (HTML geldi). Web app erişimi 'Anyone' değil veya yanlış /exec URL.",
      }), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }

    let j;
    try {
      j = JSON.parse(t);
    } catch (e) {
      return new Response(JSON.stringify({
        ok: false,
        error: "JSON parse edilemedi: " + String(e?.message || e),
        preview: t.slice(0, 200),
      }), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }

    cache = { ts: Date.now(), payload: j };

    return new Response(JSON.stringify(j), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}
