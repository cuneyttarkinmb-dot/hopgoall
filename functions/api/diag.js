export async function onRequestGet({ env }) {
  const s = (env.STREAMS_SHEET_URL || "").trim();
  const a = (env.ADS_SHEET_URL || "").trim();

  const info = {
    ok: true,
    hasStreamsUrl: !!s,
    hasAdsUrl: !!a,
    streamsHasType: s.includes("type=streams"),
    adsHasType: a.includes("type=ads"),
    streamsHost: safeHost(s),
    adsHost: safeHost(a),
    streamsEndsWithExec: s.includes("/exec"),
    adsEndsWithExec: a.includes("/exec"),
  };

  return new Response(JSON.stringify(info, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function safeHost(u) {
  try { return new URL(u).host; } catch { return ""; }
}
