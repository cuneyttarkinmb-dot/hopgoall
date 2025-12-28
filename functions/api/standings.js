// functions/api/standings.js
// =========================================================
// /api/standings?code=PL
// - football-data.org üzerinden puan durumunu çeker
// - Varsayılan: PL (Premier League)
// - Cache: 60 sn (Cloudflare Functions içinde)
// - Token: FOOTBALL_DATA_TOKEN (Cloudflare Env)
// =========================================================

const CACHE = new Map(); // code -> { ts, payload }
const TTL_MS = 60 * 1000;

async function fetchJson(url, token) {
  const r = await fetch(url, { headers: { "X-Auth-Token": token } });
  const text = await r.text().catch(() => "");
  if (!r.ok) {
    // 403 genelde "token paketinde yok" / yetki yok
    const msg = text || `HTTP ${r.status}`;
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return JSON.parse(text);
}

function pickStandingsBlock(standingsArr) {
  if (!Array.isArray(standingsArr) || standingsArr.length === 0) return null;

  // Liglerde genelde type="TOTAL" olur
  const total = standingsArr.find(s => s && s.type === "TOTAL");
  return total || standingsArr[0];
}

export async function onRequestGet({ env, request }) {
  try {
    const token = env.FOOTBALL_DATA_TOKEN;
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: "FOOTBALL_DATA_TOKEN tanımlı değil (Cloudflare Env)" }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const url = new URL(request.url);
    const code = (url.searchParams.get("code") || "PL").toUpperCase();

    // Cache
    const cached = CACHE.get(code);
    if (cached && (Date.now() - cached.ts) < TTL_MS) {
      return new Response(JSON.stringify(cached.payload), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }

    const apiUrl = `https://api.football-data.org/v4/competitions/${encodeURIComponent(code)}/standings?standingType=TOTAL`;
    const data = await fetchJson(apiUrl, token);

    const block = pickStandingsBlock(data?.standings);
    const table = Array.isArray(block?.table) ? block.table : [];

    const rows = table.map(r => ({
      pos: r?.position ?? null,
      team: r?.team?.shortName || r?.team?.name || "",
      teamId: r?.team?.id ?? null,
      crest: r?.team?.crest || r?.team?.crestUrl || "", // varsa logo gelir
      played: r?.playedGames ?? 0,
      won: r?.won ?? 0,
      draw: r?.draw ?? 0,
      lost: r?.lost ?? 0,
      gf: r?.goalsFor ?? 0,
      ga: r?.goalsAgainst ?? 0,
      gd: r?.goalDifference ?? 0,
      pts: r?.points ?? 0,
    }));

    const payload = {
      ok: true,
      updatedAt: new Date().toISOString(),
      competition: {
        code,
        name: data?.competition?.name || code,
      },
      rows,
    };

    CACHE.set(code, { ts: Date.now(), payload });

    return new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (e) {
    const status = Number(e?.status) || 500;

    // 403 -> token paketi yetmiyor mesajı
    const friendly =
      status === 403
        ? "Bu lig token paketinde yok (football-data planı izin vermiyor)."
        : (e?.message || String(e));

    return new Response(JSON.stringify({ ok: false, error: friendly, status }), {
      status: 200, // UI bozulmasın diye 200 dönüp ok:false veriyoruz
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}
