// functions/api/ads.js
// Google Apps Script JSON'u proxyler (CORS derdi yok).
// Env: ADS_SHEET_URL

const TTL_MS = 60 * 1000;
let cache = { ts: 0, payload: null };

export async function onRequestGet({ env }) {
  try {
    const url = env.ADS_SHEET_URL;
    if (!url) {
      return new Response(JSON.stringify({ ok:false, error:"ADS_SHEET_URL env yok" }), {
        headers: { "content-type":"application/json; charset=utf-8" }
      });
    }

    // Basit cache
    if (cache.payload && (Date.now() - cache.ts) < TTL_MS) {
      return new Response(JSON.stringify(cache.payload), {
        headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" }
      });
    }

    const r = await fetch(url, { headers: { "accept": "application/json" } });
    const j = await r.json();

    cache = { ts: Date.now(), payload: j };

    return new Response(JSON.stringify(j), {
      headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error:String(e?.message || e) }), {
      headers: { "content-type":"application/json; charset=utf-8" }
    });
  }
}
