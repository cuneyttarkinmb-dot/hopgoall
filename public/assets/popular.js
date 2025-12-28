/* =========================================================
   [POPULAR MATCHES] (Top 5)
   - Kaynak: /popular.json  (public/popular.json)
   - Görünüm: sağ panel üstünde, alt alta 5 satır
   - Canlıysa dakika gösterir, değilse saat gösterir
   ========================================================= */
(() => {
  const ROOT_ID = "popularMatches";
  const STATUS_ID = "popularStatus";
  const DATA_URL = "/popular.json";
  const REFRESH_MS = 30_000;

  const LOGO_PH =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect width='100%25' height='100%25' rx='6' ry='6' fill='rgba(255,255,255,0.10)'/%3E%3C/svg%3E";

  const $ = (id) => document.getElementById(id);

  function safe(v, d = "") { return (v === null || v === undefined) ? d : v; }

  function isLiveStatus(status) {
    const s = String(status || "").toUpperCase();
    return ["LIVE","1H","2H","HT","ET","PEN","INPLAY"].includes(s);
  }

  function fmtMinute(minute) {
    const n = Number(minute);
    if (!Number.isFinite(n)) return "";
    return `${n}'`;
  }

  function fmtKickoff(kickoffTime) {
    // kickoffTime: "16:00" veya ISO string
    if (!kickoffTime) return "";
    const t = String(kickoffTime);
    if (/^\d{2}:\d{2}$/.test(t)) return t;

    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  async function fetchMatches() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) return [];
      const data = await res.json();
      const arr = Array.isArray(data.matches) ? data.matches : (Array.isArray(data) ? data : []);
      return arr;
    } catch {
      return [];
    }
  }

  function render(matches) {
    const root = $(ROOT_ID);
    if (!root) return;

    root.innerHTML = "";

    const top5 = (matches || []).slice(0, 5);

    if (top5.length === 0) {
      root.innerHTML = `<div class="pop-empty">Şu an popüler maç yok.</div>`;
      return;
    }

    top5.forEach((m) => {
      const homeName = safe(m?.home?.name || m?.homeName, "Home");
      const awayName = safe(m?.away?.name || m?.awayName, "Away");
      const homeLogo = safe(m?.home?.logo || m?.homeLogo, LOGO_PH);
      const awayLogo = safe(m?.away?.logo || m?.awayLogo, LOGO_PH);

      const league = safe(m?.league, "");
      const status = safe(m?.status, "");
      const live = isLiveStatus(status);

      const sh = m?.score?.home ?? m?.homeScore;
      const sa = m?.score?.away ?? m?.awayScore;
      const hasScore = (sh !== null && sh !== undefined && sa !== null && sa !== undefined && sh !== "" && sa !== "");

      const scoreText = hasScore ? `${sh} - ${sa}` : "VS";
      const minuteText = live ? fmtMinute(m?.minute ?? m?.elapsed) : "";
      const kickoffText = !live ? fmtKickoff(m?.kickoffTime) : "";

      const rightMeta = live ? (minuteText || "CANLI") : (kickoffText || status || "");

      const url = safe(m?.url, "#");

      const a = document.createElement("a");
      a.className = "pop-row";
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";

      a.innerHTML = `
        <!-- SOL: Lig + Takımlar -->
        <div class="pop-left">
          ${league ? `<div class="pop-league">${league}</div>` : ``}

          <div class="pop-teams">
            <span class="pop-team">
              <img class="pop-logo" src="${homeLogo}" alt="" onerror="this.src='${LOGO_PH}'">
              <span class="pop-name" title="${homeName}">${homeName}</span>
            </span>

            <span class="pop-sep">-</span>

            <span class="pop-team">
              <img class="pop-logo" src="${awayLogo}" alt="" onerror="this.src='${LOGO_PH}'">
              <span class="pop-name" title="${awayName}">${awayName}</span>
            </span>
          </div>
        </div>

        <!-- SAĞ: Skor + Dakika/Saat -->
        <div class="pop-right">
          <div class="pop-score">${scoreText}</div>
          <div class="pop-meta ${live ? "live" : ""}">${rightMeta}</div>
        </div>
      `;

      root.appendChild(a);
    });
  }

  async function tick() {
    const s = $(STATUS_ID);
    if (s) s.textContent = "Güncelleniyor…";

    const matches = await fetchMatches();
    render(matches);

    if (s) s.textContent = matches.length ? "Canlı / popüler" : "Veri yok";
  }

  document.addEventListener("DOMContentLoaded", () => {
    tick();
    setInterval(tick, REFRESH_MS);
  });
})();
