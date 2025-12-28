// public/assets/standings.js
// =========================================================
// Puan Durumu UI
// - /api/standings?code=TR
// - İlk 5 takım, ok'a basınca tam liste
// =========================================================

(function () {
  const card = document.getElementById("standingsCard");
  const meta = document.getElementById("standingsMeta");
  const sel  = document.getElementById("leagueSelect");
  const tbl  = document.getElementById("standingsTable");
  const tog  = document.getElementById("standingsToggle");
  if (!card || !sel || !tbl || !tog) return;

  const LEAGUES = [
    { code: "TR",  name: "Türkiye • Süper Lig" },
    { code: "PL",  name: "İngiltere • Premier League" },
    { code: "PD",  name: "İspanya • LaLiga" },
    { code: "SA",  name: "İtalya • Serie A" },
    { code: "BL1", name: "Almanya • Bundesliga" },
    { code: "FL1", name: "Fransa • Ligue 1" },
    { code: "PPL", name: "Portekiz • Primeira Liga" },
    { code: "DED", name: "Hollanda • Eredivisie" },
  ];

  const LS_LEAGUE = "hg_league_code";
  const LS_EXPAND = "hg_standings_expand";
  let current = null;

  function esc(s){
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function setExpanded(v){
    card.classList.toggle("expanded", !!v);
    localStorage.setItem(LS_EXPAND, v ? "1" : "0");
    render();
  }

  function renderError(msg){
    tbl.innerHTML = `
      <tbody>
        <tr><td class="st-error">${esc(msg)}</td></tr>
      </tbody>
    `;
  }

  function render(){
    if (!current || !current.ok) {
      renderError(current?.error || "Şu an veri yok");
      return;
    }

    const rows = Array.isArray(current.rows) ? current.rows : [];
    const expanded = card.classList.contains("expanded");
    const show = expanded ? rows : rows.slice(0, 5);

    let html = `
      <thead>
        <tr>
          <th>#</th>
          <th>Takım</th>
          <th>O</th>
          <th>G</th>
          <th>B</th>
          <th>M</th>
          <th>A</th>
          <th>Y</th>
          <th>AV</th>
          <th>P</th>
        </tr>
      </thead>
      <tbody>
    `;

    for (const r of show) {
      const crest = esc(r.crest || "");
      const team = esc(r.team || "");
      html += `
        <tr>
          <td class="st-pos">${esc(r.pos)}</td>
          <td class="st-team">
            ${crest ? `<img class="st-crest" src="${crest}" alt="${team}" loading="lazy">` : `<span class="st-crest st-crest--empty"></span>`}
            <span class="st-teamname">${team}</span>
          </td>
          <td>${esc(r.played)}</td>
          <td>${esc(r.won)}</td>
          <td>${esc(r.draw)}</td>
          <td>${esc(r.lost)}</td>
          <td>${esc(r.gf)}</td>
          <td>${esc(r.ga)}</td>
          <td>${esc(r.gd)}</td>
          <td class="st-pts">${esc(r.pts)}</td>
        </tr>
      `;
    }

    html += `</tbody>`;
    tbl.innerHTML = html;
  }

  async function load(code){
    try{
      if (meta) meta.textContent = "Güncelleniyor…";

      const r = await fetch(`/api/standings?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const j = await r.json();
      current = j;

      if (!current.ok) {
        if (meta) meta.textContent = "Şu an veri yok";
        render();
        return;
      }

      const t = new Date(current.updatedAt).toLocaleTimeString("tr-TR", { hour:"2-digit", minute:"2-digit" });
      if (meta) meta.textContent = `${(current.competition?.name || code)} • ${t}`;
      render();
    } catch (e){
      current = { ok:false, error:"Puan durumu yüklenemedi." };
      if (meta) meta.textContent = "Şu an veri yok";
      render();
    }
  }

  // Select doldur
  sel.innerHTML = LEAGUES.map(l => `<option value="${esc(l.code)}">${esc(l.name)}</option>`).join("");

  const saved = localStorage.getItem(LS_LEAGUE);
  sel.value = LEAGUES.some(x => x.code === saved) ? saved : "TR";

  sel.addEventListener("change", () => {
    localStorage.setItem(LS_LEAGUE, sel.value);
    load(sel.value);
  });

  tog.addEventListener("click", () => setExpanded(!card.classList.contains("expanded")));

  setExpanded(localStorage.getItem(LS_EXPAND) === "1");
  load(sel.value);
  setInterval(() => load(sel.value), 60000);
})();
