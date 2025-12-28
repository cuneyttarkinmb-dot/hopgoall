// functions/api/popular.js
// =========================================================
// /api/popular
// - football-data.org API'dan maçları çeker
// - BİTEN maçları (FINISHED, AWARDED) listeye sokmaz
// - Veri boş kalmasın diye bugün + yarın (gerekirse dün) aralığından seçer
// - 5 maç döndürür (canlılar üstte, sonra en yakın başlayacaklar)
// - takım logolarını (crest) çeker ve cache'ler
// - her maç için streamUrl üretir (STREAM_LINK_TEMPLATE ile)
//
// ENV:
// - FOOTBALL_DATA_TOKEN (zorunlu)
// - STREAM_LINK_TEMPLATE (önerilir) örn: https://site.com/embed?matchId={id}
// =========================================================

let MATCH_CACHE = { ts: 0, data: null };
const TEAM_CREST_CACHE = new Map();

const MATCH_TTL_MS = 30 * 1000;            // 30sn
const CREST_TTL_MS = 7 * 24 * 3600 * 1000; // 7 gün

function ymdInTZ(timeZone, offsetDays = 0) {
  // TZ'e göre YYYY-MM-DD üret
  const now = new Date();
  const shifted = new Date(now.getTime() + offsetDays * 24 * 3600 * 1000);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(shifted);

  const y = parts.find(p => p.type === "year")?.value;
  const m = parts.find(p => p.type === "month")?.value;
  const d = parts.find(p => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function toTRTime(utcDate) {
  try {
    return new Date(utcDate).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function approxMinute(utcDate) {
  const kick = new Date(utcDate).getTime();
  const diffMin = Math.floor((Date.now() - kick) / 60000);
  return diffMin > 0 ? diffMin : 0;
}

function isLiveStatus(status) {
  return status === "IN_PLAY" || status === "PAUSED";
}

function isFinishedStatus(status) {
  // bitenleri göstermiyoruz
  return status === "FINISHED" || status === "AWARDED";
}

function scoreOf(m) {
  const ftHome = m?.score?.fullTime?.home ?? null;
  const ftAway = m?.score?.fullTime?.away ?? null;
  return {
    home: typeof ftHome === "number" ? ftHome : null,
    away: typeof ftAway === "number" ? ftAway : null
  };
}

function leaguePriority(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("champions league")) return 0;
  if (n.includes("europa league")) return 1;
  if (n.includes("premier league")) return 2;
  if (n.includes("laliga") || n.includes("primera")) return 3;
  if (n.includes("serie a")) return 4;
  if (n.includes("bundesliga")) return 5;
  if (n.includes("ligue 1")) return 6;
  if (n.includes("süper lig") || n.includes("super lig")) return 2;
  return 50;
}

async function fetchJson(url, token) {
  const r = await fetch(url, { headers: { "X-Auth-Token": token } });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`football-data API error: ${r.status} ${text}`);
  }
  return r.json();
}

async function getTeamCrest(teamId, token) {
  const cached = TEAM_CREST_CACHE.get(teamId);
  if (cached && (Date.now() - cached.ts) < CREST_TTL_MS) return cached.crestUrl;

  const j = await fetchJson(`https://api.football-data.org/v4/teams/${teamId}`, token);
  const crestUrl = j?.crest || j?.crestUrl || "";
  TEAM_CREST_CACHE.set(teamId, { ts: Date.now(), crestUrl });
  return crestUrl;
}

function buildStreamUrl(template, match) {
  // Template örnek: https://site.com/embed?matchId={id}
  // {id} {home} {away} destekliyoruz
  const t = template || "";
  if (!t) return ""; // template yoksa boş döneriz, UI tıklamada bir şey yapamaz
  return t
    .replaceAll("{id}", String(match.id))
    .replaceAll("{home}", encodeURIComponent(match.home?.name || ""))
    .replaceAll("{away}", encodeURIComponent(match.away?.name || ""));
}

export async function onRequestGet({ env }) {
  try {
    const token = env.FOOTBALL_DATA_TOKEN;
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: "FOOTBALL_DATA_TOKEN tanımlı değil (Cloudflare Env)" }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }

    // Cache
    if (MATCH_CACHE.data && (Date.now() - MATCH_CACHE.ts) < MATCH_TTL_MS) {
      return new Response(JSON.stringify(MATCH_CACHE.data), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
      });
    }

    // --- Tarih aralığı ---
    // Boş kalmaması için: dün + bugün + yarın aralığını çekiyoruz.
    // (Gece yarısı / saat farkı yüzünden “bugün boş” olmasın diye en sağlam yol.)
    const tz = "Europe/Podgorica";
    const dateFrom = ymdInTZ(tz, -1);
    const dateTo   = ymdInTZ(tz, +1);

    const url = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
    const data = await fetchJson(url, token);
    const matches = Array.isArray(data?.matches) ? data.matches : [];

    // Normalize
    const normalized = matches.map(m => {
      const status = m?.status || "";
      const live = isLiveStatus(status);

      const home = m?.homeTeam || {};
      const away = m?.awayTeam || {};

      return {
        id: m?.id,
        league: m?.competition?.name || "",
        utcDate: m?.utcDate || "",
        timeTR: m?.utcDate ? toTRTime(m.utcDate) : "",
        status,
        isLive: live,
        minute: live && m?.utcDate ? approxMinute(m.utcDate) : null,
        home: { id: home?.id, name: home?.shortName || home?.name || "Home", crest: "" },
        away: { id: away?.id, name: away?.shortName || away?.name || "Away", crest: "" },
        score: scoreOf(m),
      };
    });

    // 1) Bitenleri çıkar
    const active = normalized.filter(m => !isFinishedStatus(m.status));

    // 2) Sıralama: canlılar üstte, sonra lig önemi, sonra en yakın saat
    active.sort((a, b) => {
      const aLive = a.isLive ? 0 : 1;
      const bLive = b.isLive ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;

      const ap = leaguePriority(a.league);
      const bp = leaguePriority(b.league);
      if (ap !== bp) return ap - bp;

      const at = a.utcDate ? new Date(a.utcDate).getTime() : 0;
      const bt = b.utcDate ? new Date(b.utcDate).getTime() : 0;
      return at - bt;
    });

    // 3) İlk 5
    const top5 = active.slice(0, 5);

    // Logo doldur (en fazla 10 request; crest cache ile düşer)
    for (const m of top5) {
      if (m.home?.id) m.home.crest = await getTeamCrest(m.home.id, token);
      if (m.away?.id) m.away.crest = await getTeamCrest(m.away.id, token);
    }

    // streamUrl üret
    const template = env.STREAM_LINK_TEMPLATE || "";
    for (const m of top5) {
      m.streamUrl = buildStreamUrl(template, m);
    }

    const payload = { ok: true, updatedAt: new Date().toISOString(), matches: top5 };
    MATCH_CACHE = { ts: Date.now(), data: payload };

    return new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
}
