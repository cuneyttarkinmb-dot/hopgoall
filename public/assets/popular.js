// public/assets/popular.js
// =========================================================
// [UI] Popüler Maçlar
// - /api/popular endpoint’inden maçları çeker (max 5)
// - 30 sn’de bir yeniler
// - Dakika göstermek yerine DURUM gösterir (CANLI / DEVRE / saat)
//   Çünkü ücretsiz API'larda dakika çoğu zaman kesin doğru olmaz.
// - Maça tıklanınca: m.streamUrl ile yayını açar
// =========================================================

(function () {
  const root = document.getElementById("popularList");
  const meta = document.getElementById("popularMeta");

  if (!root) return;

  // ---------------------------------------------------------
  // HTML injection önlemek için basit escape
  // ---------------------------------------------------------
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  // ---------------------------------------------------------
  // PILL (sağdaki küçük yuvarlak gösterge)
  // - Canlıysa: "CANLI"
  // - Devredeyse: "DEVRE"
  // - Başlamadıysa: saat (m.timeTR)
  //
  // Not: Dakika göstermiyoruz. Çünkü dakika genelde tahmini oluyor
  // ve Google ile uyuşmayabiliyor.
  // ---------------------------------------------------------
  function pillText(m) {
    if (m?.isLive) {
      // status PAUSED çoğu zaman devre/ara anlamına gelir
      if (m?.status === "PAUSED") return "DEVRE";
      return "CANLI";
    }
    return m?.timeTR || "";
  }

  // ---------------------------------------------------------
  // Skor metni
  // - skor varsa "1 - 0"
  // - yoksa "VS"
  // ---------------------------------------------------------
  function scoreText(m) {
    const h = m?.score?.home;
    const a = m?.score?.away;
    if (typeof h === "number" && typeof a === "number") return `${h} - ${a}`;
    return "VS";
  }

  // ---------------------------------------------------------
  // Logo render (logo yoksa placeholder)
  // ---------------------------------------------------------
  function logoImg(url, alt) {
    const safe = esc(url || "");
    if (!safe) {
      return `<span class="pm-logo pm-logo--empty" aria-label="${esc(alt)}"></span>`;
    }
    return `<img class="pm-logo" src="${safe}" alt="${esc(alt)}" loading="lazy" />`;
  }

  // ---------------------------------------------------------
  // UI Render
  // - Her maç item'ına data-* koyuyoruz: streamUrl, title, league, time
  // - Böylece tıklanınca yayını açabiliyoruz
  // ---------------------------------------------------------
  function render(list) {
    root.innerHTML = (list || []).map((m) => {
      const league = esc(m?.league || "");
      const homeName = esc(m?.home?.name || "");
      const awayName = esc(m?.away?.name || "");
      const score = esc(scoreText(m));
      const pill = esc(pillText(m));

      const title = esc(`${m?.home?.name || ""} - ${m?.away?.name || ""}`);
      const streamUrl = esc(m?.streamUrl || "");
      const timeTR = esc(m?.timeTR || "");

      return `
        <!-- [POPULAR_MATCH_ITEM] Tek maç satırı (tıklanabilir) -->
        <div class="pm-item pm-item--click"
             data-stream="${streamUrl}"
             data-title="${title}"
             data-league="${league}"
             data-time="${timeTR}">
          <div class="pm-left">
            <div class="pm-league">${league}</div>

            <div class="pm-teams">
              <div class="pm-team">
                ${logoImg(m?.home?.crest, homeName)}
                <span class="pm-name">${homeName}</span>
              </div>

              <div class="pm-mid">
                <span class="pm-score">${score}</span>
              </div>

              <div class="pm-team pm-team--right">
                <span class="pm-name">${awayName}</span>
                ${logoImg(m?.away?.crest, awayName)}
              </div>
            </div>
          </div>

          <div class="pm-right">
            <span class="pm-pill ${m?.isLive ? "pm-pill--live" : ""}">${pill}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  // ---------------------------------------------------------
  // /api/popular fetch
  // ---------------------------------------------------------
  async function load() {
    try {
      if (meta) meta.textContent = "Güncelleniyor…";

      const r = await fetch("/api/popular", { cache: "no-store" });
      const j = await r.json();

      if (!j.ok) throw new Error(j.error || "API hata");

      const list = Array.isArray(j.matches) ? j.matches : [];
      render(list);

      // üstteki meta yazısı (sağ üst)
      if (meta) {
        const t = new Date(j.updatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
        meta.textContent = `Canlı / popüler • ${t}`;
      }

      // Eğer hiç maç yoksa, kullanıcıya “şu an veri yok” yazalım
      if (list.length === 0) {
        root.innerHTML = `<div class="pm-empty">Şu an veri yok.</div>`;
      }
    } catch (e) {
      // API hata / network hata / token vs.
      if (meta) meta.textContent = "Şu an veri yok";
      root.innerHTML = `<div class="pm-empty">Popüler maçlar yüklenemedi.</div>`;
      // console'a detay bas (istersen kaldırırsın)
      console.warn("[popular.js] load error:", e);
    }
  }

  // ---------------------------------------------------------
  // [CLICK] Popüler maç tıklanınca yayını aç
  // 1) Eğer app.js içinde window.HOPGOAL_PLAY_URL varsa -> player’da aç
  // 2) Yoksa live.html’e query ile yönlendir
  // ---------------------------------------------------------
  root.addEventListener("click", (ev) => {
    const item = ev.target.closest(".pm-item--click");
    if (!item) return;

    const stream = item.getAttribute("data-stream") || "";
    if (!stream) {
      // streamUrl gelmediyse (STREAM_LINK_TEMPLATE yoksa) bir şey yapamayız
      console.warn("[popular.js] streamUrl boş. STREAM_LINK_TEMPLATE tanımlı mı?");
      return;
    }

    const title = item.getAttribute("data-title") || "Yayın";
    const league = item.getAttribute("data-league") || "";
    const time = item.getAttribute("data-time") || "";

    // 1) Player’da aç
    if (typeof window.HOPGOAL_PLAY_URL === "function") {
      window.HOPGOAL_PLAY_URL(stream, {
        title,
        league,
        time,
        category: "Popüler Maç",
      });
      return;
    }

    // 2) Fallback: live.html’e yönlendir
    const u = new URL("/live.html", location.origin);
    u.searchParams.set("url", stream);
    u.searchParams.set("title", title);
    u.searchParams.set("league", league);
    u.searchParams.set("time", time);
    location.href = u.toString();
  });

  // İlk yükleme + periyodik yenileme
  load();
  setInterval(load, 30000);
})();
