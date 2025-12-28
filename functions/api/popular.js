// functions/api/popular.js
// =========================================================
// [API] /api/popular
// Amaç: Popüler 5 maç JSON’u üretmek (canlı skor + dakika + logo url)
// Kaynak: football-data.org API (X-Auth-Token ile)  :contentReference[oaicite:2]{index=2}
// =========================================================

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function toTRTime(utcDate) {
  try {
    return new Date(utcDate).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function approxMinute(utcDate) {
  // football-data her zaman “dakika” vermez; biz kickoff saatinden tahmini hesaplarız.
  // Bu yüzden bu değer "yaklaşık"tır.
  const kick = new Date(utcDate).getTime();
  const diffMin = Math.floor((Date.now() - kick) / 60000);
  return diffMin > 0 ? diffMin : 0;
}

function getCrest(team) {
  // Bazı response’larda crest/crestUrl doğrudan gelebilir, gelmezse boş döner.
  return team?.crest || team?.crestUrl || "";
}

function normalizeMatch(m) {
  const status = m?.status || "";
  const isLive = status === "IN_PLAY" || status === "PAUSED";

  const home = m?.homeTeam || {};
  const away = m?.awayTeam || {};

  const ftHome = m?.score?.fullTime?.home ?? null;
  const ftAway = m?.score?.fullTime?.away ?? null;

  // skor yoksa null kalsın, UI “VS” gösterecek
  const scoreHome = typeof ftHome === "number" ? ftHome : null;
  const scoreAway = typeof ftAway === "number" ? ftAway : null;

  return {
    id: m?.id,
    league: m?.competition?.name || "",
    utcDate: m?.utcDate || "",
    timeTR: m?.utcDate ? toTRTime(m.utcDate) : "",
    status,
    isLive,
    minute: isLive && m?.utcDate ? approxMinute(m.utcDate) : null,

    home: {
      name: home?.shortName || home?.name || "Home",
      crest: getCrest(home),
    },
    away: {
      name: away?.shortName || away?.name || "Away",
      crest: getCrest(away),
    },

    score: { home: scoreHome, away: scoreAway },
  };
}

export async function onRequestGet({ env }) {
  // =========================================================
  // [ENV] Cloudflare Pages > Settings > Environment Variables
  // FOOTBALL_DATA_TOKEN = (football-data.org token)
  // =========================================================
  const token = env.FOOTBALL_DATA_TOKEN;

  if (!token) {
    return new Response(JSON.stringify({
      ok: false,
      error: "FOOTBALL_DATA_TOKEN yok. Cloudflare Pages env değişkeni ekle."
    }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } });
  }

  // Bugün + yarın aralığı (canlı + yaklaşan maçlar)
  const now = new Date();
  const today = isoDate(now);
  const tomorrow = isoDate(new Date(now.getTime() + 24 * 3600 * 1000));

  const url = `https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${tomorrow}`;

  const r = await fetch(url, {
    headers: {
      // football-data auth header :contentReference[oaicite:3]{index=3}
      "X-Auth-Token": token
    }
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return new Response(JSON.stringify({
      ok: false,
      error: `football-data hata: ${r.status}`,
      detail: t.slice(0, 400)
    }), { status: 502, headers: { "content-type": "application/json; charset=utf-8" } });
  }

  const data = await r.json().catch(() => ({}));
  const matches = Array.isArray(data?.matches) ? data.matches : [];

  // Normalize
  const normalized = matches.map(normalizeMatch);

  // “Popüler” seçimi:
  // 1) canlılar öne
  // 2) kalanlar: en yakın başlayacaklar
  normalized.sort((a, b) => {
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    return (a.utcDate || "").localeCompare(b.utcDate || "");
  });

  const top5 = normalized.slice(0, 5);

  return new Response(JSON.stringify({
    ok: true,
    updatedAt: new Date().toISOString(),
    matches: top5
  }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

