// js/app.js – FINÁLNÍ OPRAVA: žádné pády, demo data, HSI, bez nekonečného růstu
(() => {
  // Globální nastavení Chart.js (pokud je načten)
  if (typeof Chart !== "undefined") {
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
  }

  // Demo API / data
  const API = {
    price: "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=hyperliquid&order=market_cap_desc&per_page=1&page=1&sparkline=false",
    demoNews: [
      { title: "Hyperliquid API výpadek kvůli přetížení (ne hack)", source: "CoinSpeaker, 2025" },
      { title: "Hyperliquid Strategies: zpětný odkup akcií za 30M USD", source: "StockTitan, 2025" },
      { title: "HIP-6 prošel: spalování fee pro držitele HYPE", source: "TheBlock" },
      { title: "Velryby nakoupily 2M HYPE při integraci Aster", source: "Reddit (mirror)" },
      { title: "beHYPE staking výnosy dosáhly 15% APY", source: "Oficiální blog" }
    ],
    whalesDemo: [
      { pair: "HYPE/USDC", side: "long", size_usd: 250000, time: Date.now() },
      { pair: "HYPE/ETH", side: "short", size_usd: 180000, time: Date.now() - 3600_000 },
      { pair: "BTC/USDC", side: "long", size_usd: 500000, time: Date.now() - 7200_000 }
    ],
    oiDemo: (() => {
      const now = Math.floor(Date.now() / 1000);
      const series = [];
      for (let i = 0; i < 12; i++) {
        const ts = now - (11 - i) * 3600;
        const longs = 1000000 + (i * 20000) + ((i % 3) * 50000);
        const shorts = 800000 + (i * 15000) + (((i + 1) % 4) * 30000);
        const oi = longs + shorts;
        const ratio = longs / Math.max(1, shorts);
        series.push({ ts, longs, shorts, oi, long_short_ratio: Number(ratio.toFixed(3)) });
      }
      return series;
    })(),
    governanceDemo: [
      { id: "HIP-1", title: "Navýšení staking odměn beHYPE", status: "active", proposer: "0xabc", aye: [{ validator: "val1", stake: 12000 }, { validator: "val2", stake: 8000 }], nay: [{ validator: "val3", stake: 2000 }] },
      { id: "HIP-2", title: "Úprava poplatkové struktury", status: "closed", proposer: "0xdef", aye: [{ validator: "val2", stake: 5000 }], nay: [{ validator: "val1", stake: 3000 }, { validator: "val4", stake: 1000 }] }
    ]
  };

  // Pomocné formátování
  function fmtUSD(v) {
    if (v === null || v === undefined) return "--";
    if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
    if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
    if (v >= 1e3) return "$" + (v / 1e3).toFixed(2) + "K";
    return "$" + Number(v).toFixed(2);
  }
  function fmtNum(v) {
    if (v === null || v === undefined) return "--";
    return Number(v).toLocaleString();
  }

  // Bezpečné získání elementů
  const $ = (id) => document.getElementById(id);
  const hypePriceEl = $("hypePrice");
  const hypeChangeEl = $("hypeChange");
  const cardPriceEl = $("cardPrice");
  const cardVolumeEl = $("cardVolume");
  const cardMarketCapEl = $("cardMarketCap");
  const lastUpdatedEl = $("lastUpdated");
  const newsListEl = $("newsList");
  const whaleListEl = $("whaleList");
  const oiLatestEl = $("oiLatest");
  const govSnapshotEl = $("govSnapshot");
  const sentimentScoreEl = $("sentimentScore");

  // Demo načítání (bez fetch, ihned)
  function loadNewsDemo() {
    if (!newsListEl) return;
    newsListEl.innerHTML = "";
    API.demoNews.slice(0, 5).forEach(item => {
      const el = document.createElement("div");
      el.className = "mb-2 p-2 glass rounded text-sm";
      el.innerHTML = `<a href="#" class="hover:underline">${item.title}</a><div class="muted text-xs mt-1">${item.source}</div>`;
      newsListEl.appendChild(el);
    });
  }

  function loadSentimentDemo() {
    if (!sentimentScoreEl) return;
    const score = 75;
    sentimentScoreEl.textContent = score + "%";
  }

  function loadWhalesDemo() {
    if (!whaleListEl) return;
    whaleListEl.innerHTML = "";
    API.whalesDemo.forEach(whale => {
      const el = document.createElement("div");
      el.className = "mb-2 p-2 glass rounded text-sm";
      el.innerHTML = `<div>${whale.pair} · ${whale.side.toUpperCase()} $${fmtNum(whale.size_usd)} (${new Date(whale.time).toLocaleString()})</div>`;
      whaleListEl.appendChild(el);
    });
  }

  function loadOIDemo() {
    if (!oiLatestEl) return;
    const latest = API.oiDemo[API.oiDemo.length - 1];
    oiLatestEl.textContent = fmtUSD(latest.oi);
  }

  function loadGovernanceDemo() {
    if (!govSnapshotEl) return;
    const hips = API.governanceDemo;
    govSnapshotEl.innerHTML = "";
    const hipsListEl = $("hipsList");
    if (!hipsListEl) return;
    hipsListEl.innerHTML = "";
    hips.forEach(h => {
      const s = document.createElement("div");
      s.className = "mb-2";
      s.innerHTML = `<div class="text-sm"><strong>${h.id}</strong> · ${h.title}</div>`;
      govSnapshotEl.appendChild(s);

      const card = document.createElement("div");
      card.className = "p-3 glass rounded";
      card.innerHTML = `<div class="flex justify-between items-center"><div><strong>${h.id}</strong> · ${h.title}</div><div class="muted">${h.status}</div></div>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <div><div class="font-semibold">Aye</div><div class="mt-1" id="aye-${h.id}"></div></div>
          <div><div class="font-semibold">Nay</div><div class="mt-1" id="nay-${h.id}"></div></div>
        </div>`;
      hipsListEl.appendChild(card);

      const ayeEl = $(`aye-${h.id}`);
      const nayEl = $(`nay-${h.id}`);
      (h.aye || []).forEach(v => { if (ayeEl) { const el = document.createElement("div"); el.className = "text-sm"; el.textContent = `${v.validator} · ${fmtNum(v.stake)}`; ayeEl.appendChild(el); } });
      (h.nay || []).forEach(v => { if (nayEl) { const el = document.createElement("div"); el.className = "text-sm"; el.textContent = `${v.validator} · ${fmtNum(v.stake)}`; nayEl.appendChild(el); } });
    });
  }

  // Cena
  async function fetchPrice() {
    try {
      const res = await fetch(API.price);
      const data = await res.json();
      const coin = data[0] || {};
      if (hypePriceEl) hypePriceEl.textContent = coin.current_price ? `$${Number(coin.current_price).toFixed(4)}` : "--";
      if (hypeChangeEl) hypeChangeEl.textContent = coin.price_change_percentage_24h != null ? `${coin.price_change_percentage_24h.toFixed(2)}%` : "--";
      if (cardPriceEl) cardPriceEl.textContent = coin.current_price ? `$${Number(coin.current_price).toFixed(4)}` : "--";
      if (cardVolumeEl) cardVolumeEl.textContent = fmtUSD(coin.total_volume);
      if (cardMarketCapEl) cardMarketCapEl.textContent = fmtUSD(coin.market_cap);
      if (lastUpdatedEl) lastUpdatedEl.textContent = "Updated: " + new Date().toLocaleTimeString();
    } catch (e) {
      console.warn("Price error:", e);
    }
  }

  // Charts – inicializace jen pokud existují canvasy
  let sentimentChart = null;
  let oiChart = null;
  let HSIGauge = null;
  let giypChart = null;
  let hsiChart = null;

  function initCharts() {
    const sCanvas = $("sentimentChart");
    if (sCanvas && typeof Chart !== "undefined") {
      const sCtx = sCanvas.getContext("2d");
      sentimentChart = new Chart(sCtx, {
        type: "doughnut",
        data: { labels: ["Positive", "Negative"], datasets: [{ data: [75, 25], backgroundColor: ["#00FF7F", "#FF0033"] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }

    const oiCanvas = $("oiChart");
    if (oiCanvas && typeof Chart !== "undefined") {
      const oiCtx = oiCanvas.getContext("2d");
      oiChart = new Chart(oiCtx, {
        type: "bar",
        data: { labels: ["T-2h","T-1h","Now"], datasets: [{ label: "Longs", data: [1.1e6, 1.2e6, 1.25e6], backgroundColor: "#00FF7F" }, { label: "Shorts", data: [0.85e6, 0.9e6, 0.95e6], backgroundColor: "#FF0033" }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
      });
    }

    // HSI gauge (pokud používáš polokruhový gauge – volitelně)
    const hsiGaugeCanvas = $("HSIGauge");
    if (hsiGaugeCanvas && typeof Chart !== "undefined") {
      const hsiGaugeCtx = hsiGaugeCanvas.getContext("2d");
      HSIGauge = new Chart(hsiGaugeCtx, {
        type: "doughnut",
        data: { labels: ["Index","Remaining"], datasets: [{ data: [60, 40], backgroundColor: ["#00FF7F", "#222"] }] },
        options: { rotation: -Math.PI, circumference: Math.PI, cutout: "70%", plugins: { legend: { display: false } } }
      });
    }

    // GIYP
    const giypCanvas = $("giypChart");
    if (giypCanvas && typeof Chart !== "undefined") {
      const giypCtx = giypCanvas.getContext("2d");
      giypChart = new Chart(giypCtx, {
        type: "line",
        data: { labels: ["Pre-vote", "Post-vote"], datasets: [{ label: "Yield %", data: [5, 6], borderColor: "cyan", fill: false }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
      });
    }

    // HSI (dříve CBBI/CCLB)
    const hsiCanvas = $("hsiChart");
    if (hsiCanvas && typeof Chart !== "undefined") {
      const hsiCtx = hsiCanvas.getContext("2d");
      hsiChart = new Chart(hsiCtx, {
        type: "bar",
        data: { labels: ["Sentiment", "Whales", "OI"], datasets: [{ label: "HSI Components", data: [60, 55, 50], backgroundColor: ["#00FF7F", "#00CC66", "#FF0033"] }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
      });
    }
  }

  // Bezpečný theme toggle (nebude padat, když chybí tlačítko)
  function initTheme() {
    const btn = $("themeToggle");
    const html = document.documentElement;
    if (!btn) return;
    const saved = localStorage.getItem("hyperhub-theme");
    if (saved === "light") {
      html.classList.add("light");
      btn.textContent = "Light";
    } else {
      html.classList.remove("light");
      btn.textContent = "Dark";
    }
    btn.addEventListener("click", () => {
      html.classList.toggle("light");
      localStorage.setItem("hyperhub-theme", html.classList.contains("light") ? "light" : "dark");
      btn.textContent = html.classList.contains("light") ? "Light" : "Dark";
    });
  }

  // VYPNUTO: mobilní menu (způsobovalo pád, protože prvky chybí)
  function initMobileMenu() {
    // Záměrně prázdné – nic neinicializovat, dokud nebudou v HTML skutečné prvky s id:
    // mobileMenuBtn, mobileMenu, mobileClose
    return;
  }

  // Načti vše
  async function loadAll() {
    loadNewsDemo();
    loadSentimentDemo();
    loadWhalesDemo();
    loadOIDemo();
    loadGovernanceDemo();
    await fetchPrice();
  }

  // Interval bez duplikací
  function startIntervals() {
    setInterval(() => {
      if (newsListEl) newsListEl.innerHTML = "";
      if (whaleListEl) whaleListEl.innerHTML = "";
      if (sentimentScoreEl) sentimentScoreEl.textContent = "";
      loadAll();
    }, 60000);
  }

  // Start
  function init() {
    initCharts();
    initTheme();
    initMobileMenu(); // bezpečně nic nedělá
    loadAll();
    startIntervals();
  }

  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("load", () => {
    // Fallback – pokud by DOMContentLoaded proběhlo dřív, než jsou prvky dostupné
    init();
  });
})();

