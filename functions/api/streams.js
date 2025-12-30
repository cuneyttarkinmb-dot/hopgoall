// functions/api/streams.js
// Google Apps Script JSON'u proxyler (CORS derdi yok).
// Env: STREAMS_SHEET_URL
//
// Not: Apps Script URL JSON döndürmüyorsa (HTML login sayfası geliyorsa)
// burada daha anlaşılır bir hata mesajı döndürür.

const TTL_MS = 60 * 1000;
let cache = { ts: 0, payload: null };

export async function onRequestGet({ env }) {
  try {
    const url = env.STREAMS_SHEET_URL;
    if (!url) {
      return new Response(JSON.stringify({ ok:false, error:"STREAMS_SHEET_URL env yok" }), {
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
    const text = await r.text();

    // Apps Script bazen JSON yerine HTML döner (login / izin ekranı).
    const t = (text || "").trim();
    if (t.startsWith("<")) {
      const hint = "Apps Script JSON dönmüyor (HTML geldi). Muhtemel sebep: Web uygulaması 'Herkes' erişimine açık değil veya doğru proje URL'si değil.";
      return new Response(JSON.stringify({ ok:false, error: hint }), {
        headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" }
      });
    }

    let j;
    try {
      j = JSON.parse(t);
    } catch (e) {
      return new Response(JSON.stringify({ ok:false, error:"JSON parse edilemedi: " + String(e?.message || e) }), {
        headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" }
      });
    }

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
