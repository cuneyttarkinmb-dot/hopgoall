// functions/api/standings.js
// =========================================================
// /api/standings?code=PL
//
// Bu endpoint NE YAPAR?
// - Puan durumunu ÜCRETSİZ şekilde TheSportsDB'den çeker (test key "3").
// - Cloudflare Pages/Functions üzerinden geçtiği için CORS sıkıntısı yok.
// - Cache: 60 sn
//
// Desteklenen lig kodları (UI select bunları gönderiyor):
// PL, SA, PD, BL1, FL1, PPL, DED, TR
// =========================================================

const TTL_MS = 60 * 1000;
const CACHE = new Map(); // cacheKey -> { ts, payload }

// UI "code" -> TheSportsDB "idLeague"
const LEAGUE_MAP = {
  PL:  { idLeague: 4328, name: "English Premier League" },
  SA:  { idLeague: 4332, name: "Italian Serie A" },
  PD:  { idLeague: 4335, name: "Spanish La Liga" },
  BL1: { idLeague: 4331, name: "German Bundesliga" },
  FL1: { idLeague: 4334, name: "French Ligue 1" },
  PPL: { idLeague: 4344, name: "Portuguese Primeira Liga" },
  DED: { idLeague: 4337, name: "Dutch Eredivisie" },
  TR:  { idLeague: 4339, name: "Turkish Super Lig" },
};

function calcSeasonStr(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1; // 1-12
  if (m >= 7) return `${y}-${y + 1}`;
  return `${y - 1}-${y}`;
}

function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  const text = await r.text().catch(() => "");
  if (!r.ok) {
    const err = new Error(`Upstream HTTP ${r.status}`);
    err.status = r.status;
    err.body = text?.slice(0, 200);
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch (_) {
    const err = new Error("Upstream JSON parse error (HTML dönüyor olabilir)");
    err.status = 502;
    err.body = text?.slice(0, 200);
    throw err;
  }
}

export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const code = (url.searchParams.get("code") || "PL").toUpperCase();

    const league = LEAGUE_MAP[code];
    if (!league) {
      return new Response(JSON.stringify({ ok: false, error: `Bilinmeyen lig kodu: ${code}` }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const season = url.searchParams.get("season") || calcSeasonStr();
    const cacheKey = `${code}:${season}`;

    const cached = CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < TTL_MS) {
      return new Response(JSON.stringify(cached.payload), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }

    const apiUrl =
      `https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=${encodeURIComponent(league.idLeague)}&s=${encodeURIComponent(season)}`;

    const data = await fetchJson(apiUrl);

    const table = Array.isArray(data?.table) ? data.table : [];
    if (!table.length) {
      const payloadEmpty = {
        ok: false,
        status: 404,
        error: `Bu lig için tablo bulunamadı. code=${code} season=${season}`,
      };
      CACHE.set(cacheKey, { ts: Date.now(), payload: payloadEmpty });
      return new Response(JSON.stringify(payloadEmpty), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }

    const rows = table.map((r) => {
      const gf = toInt(r?.intGoalsFor);
      const ga = toInt(r?.intGoalsAgainst);
      return {
        pos: toInt(r?.intRank, null),
        team: String(r?.strTeam || "").trim(),
        crest: String(r?.strBadge || "").trim(),
        played: toInt(r?.intPlayed),
        won: toInt(r?.intWin),
        draw: toInt(r?.intDraw),
        lost: toInt(r?.intLoss),
        gf,
        ga,
        gd: toInt(r?.intGoalDifference, gf - ga),
        pts: toInt(r?.intPoints),
      };
    });

    const payload = {
      ok: true,
      updatedAt: new Date().toISOString(),
      competition: {
        code,
        name: table?.[0]?.strLeague || league.name || code,
        season: table?.[0]?.strSeason || season,
      },
      rows,
    };

    CACHE.set(cacheKey, { ts: Date.now(), payload });

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (e) {
    const payloadErr = {
      ok: false,
      status: Number(e?.status) || 500,
      error: String(e?.message || e),
      debug: e?.body ? String(e.body) : undefined,
    };
    return new Response(JSON.stringify(payloadErr), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}
