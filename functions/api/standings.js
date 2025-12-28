// functions/api/standings.js
// =========================================================
// /api/standings?code=TR
// - ÜCRETSİZ: TheSportsDB test key "3" kullanır
// - Cache: 60 sn
//
// code -> idLeague map (TR dahil)
// =========================================================

const TTL_MS = 60 * 1000;
const CACHE = new Map(); // key -> { ts, payload }

const LEAGUE_MAP = {
  PL:  { idLeague: 4328, name: "Premier League" },
  SA:  { idLeague: 4332, name: "Serie A" },
  PD:  { idLeague: 4335, name: "LaLiga" },
  BL1: { idLeague: 4331, name: "Bundesliga" },
  FL1: { idLeague: 4334, name: "Ligue 1" },
  PPL: { idLeague: 4344, name: "Primeira Liga" },
  DED: { idLeague: 4337, name: "Eredivisie" },
  TR:  { idLeague: 4339, name: "Süper Lig" },
};

function calcSeasonStr(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return (m >= 7) ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  const text = await r.text().catch(() => "");
  if (!r.ok) throw new Error(`Upstream HTTP ${r.status}`);
  try { return JSON.parse(text); }
  catch { throw new Error("Upstream JSON parse error (HTML dönüyor olabilir)"); }
}

export async function onRequestGet({ request }) {
  try {
    const u = new URL(request.url);
    const code = (u.searchParams.get("code") || "TR").toUpperCase();
    const season = u.searchParams.get("season") || calcSeasonStr();

    const league = LEAGUE_MAP[code];
    if (!league) {
      return new Response(JSON.stringify({ ok:false, error:`Bilinmeyen lig kodu: ${code}` }), {
        headers: { "content-type":"application/json; charset=utf-8" }
      });
    }

    const key = `${code}:${season}`;
    const cached = CACHE.get(key);
    if (cached && (Date.now() - cached.ts) < TTL_MS) {
      return new Response(JSON.stringify(cached.payload), {
        headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" }
      });
    }

    const apiUrl = `https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=${league.idLeague}&s=${encodeURIComponent(season)}`;
    const data = await fetchJson(apiUrl);

    const table = Array.isArray(data?.table) ? data.table : [];
    if (!table.length) {
      const payload = { ok:false, error:`Tablo bulunamadı. code=${code} season=${season}` };
      CACHE.set(key, { ts: Date.now(), payload });
      return new Response(JSON.stringify(payload), {
        headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" }
      });
    }

    const rows = table.map((r) => {
      const gf = toInt(r?.intGoalsFor);
      const ga = toInt(r?.intGoalsAgainst);
      const gd = toInt(r?.intGoalDifference, gf - ga);
      return {
        pos: toInt(r?.intRank, null),
        team: String(r?.strTeam || "").trim(),
        crest: String(r?.strBadge || "").trim(),
        played: toInt(r?.intPlayed),
        won: toInt(r?.intWin),
        draw: toInt(r?.intDraw),
        lost: toInt(r?.intLoss),
        gf,  // Attığı
        ga,  // Yediği
        gd,  // Averaj
        pts: toInt(r?.intPoints),
      };
    });

    const payload = {
      ok: true,
      updatedAt: new Date().toISOString(),
      competition: { code, name: league.name, season },
      rows
    };

    CACHE.set(key, { ts: Date.now(), payload });

    return new Response(JSON.stringify(payload), {
      headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error:String(e?.message || e) }), {
      headers: { "content-type":"application/json; charset=utf-8" }
    });
  }
}
