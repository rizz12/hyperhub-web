// js/app.js
(() => {
  // Direct API endpoints for static site (no backend)
  const API = {
    // Replace "hyperliquid" with the actual CoinGecko ID for HYPE if available.
    price: "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=hyperliquid&order=market_cap_desc&per_page=1&page=1&sparkline=false",

    // RSS feeds: some may have CORS. Reddit supports CORS; others might need a proxy in production.
    newsFeeds: [
      "https://www.reddit.com/r/Hyperliquid/.rss",
      "https://cointelegraph.com/rss",
      "https://www.theblock.co/rss"
      // Add Hyperliquid blog RSS if available and CORS-allowed
    ],

    // Placeholder JSON for whales / OI / governance (static demo)
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
      { id: "HIP-1", title: "Increase beHYPE staking rewards", status: "active", proposer: "0xabc", aye: [{ validator: "val1", stake: 12000 }, { validator: "val2", stake: 8000 }], nay: [{ validator: "val3", stake: 2000 }] },
      { id: "HIP-2", title: "Adjust fee structure", status: "closed", proposer: "0xdef", aye: [{ validator: "val2", stake: 5000 }], nay: [{ validator: "val1", stake: 3000 }, { validator: "val4", stake: 1000 }] }
    ]
  };

  // Utility
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

  // DOM refs
  const hypePriceEl = document.getElementById("hypePrice");
  const hypeChangeEl = document.getElementById("hypeChange");
  const cardPriceEl = document.getElementById("cardPrice");
  const cardVolumeEl = document.getElementById("cardVolume");
  const cardMarketCapEl = document.getElementById("cardMarketCap");
  const lastUpdatedEl = document.getElementById("lastUpdated");
  const newsListEl = document.getElementById("newsList");
  const whaleListEl = document.getElementById("whaleList");
  const oiLatestEl = document.getElementById("oiLatest");
  const govSnapshotEl = document.getElementById("govSnapshot");
  const sentimentScoreEl = document.getElementById("sentimentScore");

  // Charts
  let sentimentChart = null;
  let oiChart = null;
  let cbbiGauge = null;
  let sentimentPie = null;
  let whalesBar = null;
  let oiLine = null;
  let cbbiChart = null;

  // Init charts
  function initCharts() {
    const sCtx = document.getElementById("sentimentChart").getContext("2d");
    sentimentChart = new Chart(sCtx, {
      type: "doughnut",
      data: { labels: ["Bullish", "Bearish"], datasets: [{ data: [50, 50], backgroundColor: ["#00FF7F", "#FF0033"] }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const oiCtx = document.getElementById("oiChart").getContext("2d");
    oiChart = new Chart(oiCtx, {
      type: "bar",
      data: { labels: [], datasets: [{ label: "Longs", data: [], backgroundColor: "#00FF7F" }, { label: "Shorts", data: [], backgroundColor: "#FF0033" }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });

    // Gauge
    const cbbiCtx = document.getElementById("cbbiGauge").getContext("2d");
    cbbiGauge = new Chart(cbbiCtx, {
      type: "doughnut",
      data: { labels: ["Index", "Remaining"], datasets: [{ data: [60, 40], backgroundColor: ["#00FF7F", "#222"] }] },
      options: { rotation: -Math.PI, circumference: Math.PI, cutout: "70%", plugins: { legend: { display: false } } }
    });

    // Analytics charts
    const sentimentPieCtx = document.getElementById("sentimentPie").getContext("2d");
    sentimentPie = new Chart(sentimentPieCtx, {
      type: "pie",
      data: { labels: ["Positive", "Negative"], datasets: [{ data: [60, 40], backgroundColor: ["#00FF7F", "#FF0033"] }] },
      options: { responsive: true, maintainAspectRatio: false }
    });

    const whalesBarCtx = document.getElementById("whalesBar").getContext("2d");
    whalesBar = new Chart(whalesBarCtx, {
      type: "bar",
      data: { labels: [], datasets: [{ label: "Whale USD", data: [], backgroundColor: "#00CC66" }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });

    const oiLineCtx = document.getElementById("oiLine").getContext("2d");
    oiLine = new Chart(oiLineCtx, {
      type: "line",
      data: { labels: [], datasets: [{ label: "OI", data: [], borderColor: "#00FF7F", fill: false }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });

    const cbbiChartCtx = document.getElementById("cbbiChart").getContext("2d");
    cbbiChart = new Chart(cbbiChartCtx, {
      type: "bar",
      data: { labels: ["Sentiment", "Whales", "OI"], datasets: [{ label: "Components", data: [50, 50, 50], backgroundColor: ["#00FF7F", "#00CC66", "#FF0033"] }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
    });
  }

  // Fetch and update
  async function fetchPrice() {
    try {
      const res = await fetch(API.price);
      const data = await res.json();
      const item = data[0] || {};
      const price = item.current_price || 0;
      const change = item.price_change_percentage_24h || 0;
      const vol = item.total_volume || 0;
      const mcap = item.market_cap || 0;
      hypePriceEl.textContent = price ? `$${Number(price).toFixed(4)}` : "--";
      cardPriceEl.textContent = price ? `$${Number(price).toFixed(4)}` : "--";
      cardVolumeEl.textContent = fmtUSD(vol);
      cardMarketCapEl.textContent = fmtUSD(mcap);
      hypeChangeEl.textContent = (change >= 0 ? "+" : "") + (change ? change.toFixed(2) + "%" : "--");
      hypeChangeEl.className = change >= 0 ? "tag-green" : "tag-red";
      lastUpdatedEl.textContent = new Date().toLocaleTimeString();
    } catch (e) {
      console.warn("fetchPrice error", e);
    }
  }

  async function fetchNews() {
    // Best-effort: try multiple feeds; CORS may block some
    newsListEl.innerHTML = "";
    const items = [];
    for (const feed of API.newsFeeds) {
      try {
        const res = await fetch(feed);
        const text = await res.text();
        // Naive RSS title extraction
        const titles = [...text.matchAll(/<title>([^<]+)<\/title>/gi)].map(m => m[1]).slice(1); // skip channel title
        const links = [...text.matchAll(/<link[^>]*>([^<]+)<\/link>/gi)].map(m => m[1]);
        titles.slice(0, 3).forEach((t, i) => {
          items.push({ title: t, link: links[i] || feed, source: feed });
        });
      } catch (e) {
        console.warn("RSS fetch failed:", feed, e);
      }
    }
    if (items.length === 0) {
      newsListEl.innerHTML = '<div class="muted text-sm">No news available</div>';
      return;
    }
    items.slice(0, 8).forEach(it => {
      const el = document.createElement("div");
      el.className = "mb-2";
      el.innerHTML = `<a href="${it.link}" target="_blank" class="text-sm brand-green">${it.title}</a><div class="muted text-xs">${new URL(it.source).hostname}</div>`;
      newsListEl.appendChild(el);
    });
  }

  async function fetchSentiment() {
    // Use news titles + a simple dictionary to compute sentiment
    try {
      // Reuse what we have in newsList; if empty, fetchNews first
      if (!newsListEl.children.length) await fetchNews();
      const titles = Array.from(newsListEl.querySelectorAll("a")).map(a => a.textContent.toLowerCase());

      const positive = ["gain", "bull", "bullish", "surge", "rally", "up", "moon", "pump", "positive", "beat", "record", "growth", "increase", "win"];
      const negative = ["drop", "down", "bear", "bearish", "dump", "crash", "loss", "decline", "sell", "negative", "risk", "liquidation", "fall", "slump"];

      let score = 0, posCount = 0, negCount = 0;
      titles.forEach(t => {
        positive.forEach(p => { if (t.includes(p)) { score += 1; posCount += 1; } });
        negative.forEach(n => { if (t.includes(n)) { score -= 1; negCount += 1; } });
      });
      const total = posCount + negCount;
      const sentimentIndex = total === 0 ? 50 : Math.max(0, Math.min(100, Math.round(50 + (score / total) * 50)));
      sentimentScoreEl.textContent = sentimentIndex;

      const pos = Math.max(0, sentimentIndex);
      const neg = Math.max(0, 100 - sentimentIndex);
      if (sentimentChart) {
        sentimentChart.data.datasets[0].data = [pos, neg];
        sentimentChart.update();
      }
      if (sentimentPie) {
        sentimentPie.data.datasets[0].data = [pos, neg];
        sentimentPie.update();
      }
      document.getElementById("cbbiSent").textContent = sentimentIndex;
      computeCBBI();
    } catch (e) {
      console.warn("fetchSentiment error", e);
    }
  }

  async function fetchWhales() {
    try {
      const whales = API.whalesDemo;
      whaleListEl.innerHTML = "";
      if (!whales.length) {
        whaleListEl.innerHTML = '<div class="muted text-sm">No whale activity</div>';
      } else {
        whales.slice(0, 6).forEach(w => {
          const el = document.createElement("div");
          el.className = "mb-2";
          el.innerHTML = `<div class="flex justify-between"><div class="text-sm">${w.pair} · ${w.side}</div><div class="text-sm muted">${fmtUSD(w.size_usd)}</div></div><div class="muted text-xs">${new Date(w.time).toLocaleString()}</div>`;
          whaleListEl.appendChild(el);
        });
      }
      if (whalesBar) {
        whalesBar.data.labels = whales.map(w => w.pair);
        whalesBar.data.datasets[0].data = whales.map(w => w.size_usd);
        whalesBar.update();
      }
      const totalWhaleVol = whales.reduce((s, w) => s + (w.size_usd || 0), 0);
      const whalesScore = Math.max(0, Math.min(100, Math.round(100 - Math.log10(1 + totalWhaleVol) * 10)));
      document.getElementById("cbbiWhales").textContent = whalesScore;
      computeCBBI();
    } catch (e) {
      console.warn("fetchWhales error", e);
    }
  }

  async function fetchOI() {
    try {
      const series = API.oiDemo;
      if (series.length > 0) {
        const labels = series.map(s => new Date(s.ts * 1000).toLocaleTimeString());
        const longs = series.map(s => s.longs);
        const shorts = series.map(s => s.shorts);
        const oi = series.map(s => s.oi);
        if (oiChart) {
          oiChart.data.labels = labels;
          oiChart.data.datasets[0].data = longs;
          oiChart.data.datasets[1].data = shorts;
          oiChart.update();
        }
        if (oiLine) {
          oiLine.data.labels = labels;
          oiLine.data.datasets[0].data = oi;
          oiLine.update();
        }
        oiLatestEl.textContent = fmtUSD(series[series.length - 1].oi);
        const latest = series[series.length - 1];
        const ratio = latest.longs / Math.max(1, latest.shorts);
        const oiScore = Math.max(0, Math.min(100, Math.round((ratio / 2) * 100)));
        document.getElementById("cbbiOI").textContent = oiScore;
        computeCBBI();
      }
    } catch (e) {
      console.warn("fetchOI error", e);
    }
  }

  function computeCBBI() {
    const s = Number(document.getElementById("cbbiSent").textContent) || 50;
    const w = Number(document.getElementById("cbbiWhales").textContent) || 50;
    const o = Number(document.getElementById("cbbiOI").textContent) || 50;
    const overall = Math.round((s + w + o) / 3);
    if (cbbiGauge) {
      cbbiGauge.data.datasets[0].data = [overall, 100 - overall];
      cbbiGauge.update();
    }
    if (cbbiChart) {
      cbbiChart.data.datasets[0].data = [s, w, o];
      cbbiChart.update();
    }
  }

  function initTabs() {
    document.querySelectorAll(".tabBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tabPanel").forEach(p => p.classList.add("hidden"));
        document.querySelectorAll(".tabBtn").forEach(b => b.classList.remove("bg-white/10"));
        const t = btn.dataset.tab;
        document.getElementById(t).classList.remove("hidden");
        btn.classList.add("bg-white/10");
      });
    });
    const first = document.querySelector(".tabBtn");
    if (first) first.click();
  }

  function initMobileMenu() {
    const mobileBtn = document.getElementById("mobileMenuBtn");
    const mobileMenu = document.getElementById("mobileMenu");
    const mobileClose = document.getElementById("mobileClose");
    mobileBtn.addEventListener("click", () => mobileMenu.classList.remove("hidden"));
    mobileClose.addEventListener("click", () => mobileMenu.classList.add("hidden"));
    mobileMenu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => mobileMenu.classList.add("hidden")));
  }

  // Theme toggle: toggles "light" class on html and CSS variables handle colors
  function initTheme() {
    const btn = document.getElementById("themeToggle");
    const html = document.documentElement;
    const saved = localStorage.getItem("hyperhub-theme");
    if (saved === "light") {
      html.classList.add("light");
      btn.textContent = "Light";
    } else {
      html.classList.remove("light");
      btn.textContent = "Dark";
    }
    btn.addEventListener("click", () => {
      if (html.classList.contains("light")) {
        html.classList.remove("light");
        localStorage.setItem("hyperhub-theme", "dark");
        btn.textContent = "Dark";
      } else {
        html.classList.add("light");
        localStorage.setItem("hyperhub-theme", "light");
        btn.textContent = "Light";
      }
    });
  }

  function init() {
    initCharts();
    initTabs();
    initMobileMenu();
    initTheme();
    fetchAll();
    setInterval(fetchAll, 60 * 1000);
  }

  function fetchAll() {
    fetchPrice();
    fetchNews();
    fetchSentiment();
    fetchWhales();
    fetchOI();
    fetchGovernanceDemo();
  }

  function fetchGovernanceDemo() {
    const hips = API.governanceDemo;
    govSnapshotEl.innerHTML = "";
    const hipsListEl = document.getElementById("hipsList");
    hipsListEl.innerHTML = "";
    if (!hips.length) {
      govSnapshotEl.innerHTML = '<div class="muted text-sm">No HIPs</div>';
      hipsListEl.innerHTML = '<div class="muted text-sm">No HIPs</div>';
      return;
    }
    hips.forEach(h => {
      const s = document.createElement("div");
      s.className = "mb-2";
      s.innerHTML = `<div class="text-sm"><strong>${h.id}</strong> · ${h.title}</div>`;
      govSnapshotEl.appendChild(s);

      const card = document.createElement("div");
      card.className = "p-3 glass rounded";
      card.innerHTML = `<div class="flex justify-between items-center"><div><strong>${h.id}</strong> · ${h.title}</div><div class="muted">${h.status}</div></div>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <div>
            <div class="font-semibold">Aye</div>
            <div class="mt-1" id="aye-${h.id}"></div>
          </div>
          <div>
            <div class="font-semibold">Nay</div>
            <div class="mt-1" id="nay-${h.id}"></div>
          </div>
        </div>`;
      hipsListEl.appendChild(card);

      const ayeEl = document.getElementById(`aye-${h.id}`);
      const nayEl = document.getElementById(`nay-${h.id}`);
      (h.aye || []).forEach(v => {
        const el = document.createElement("div");
        el.className = "text-sm";
        el.textContent = `${v.validator} · ${fmtNum(v.stake)}`;
        ayeEl.appendChild(el);
      });
      (h.nay || []).forEach(v => {
        const el = document.createElement("div");
        el.className = "text-sm";
        el.textContent = `${v.validator} · ${fmtNum(v.stake)}`;
        nayEl.appendChild(el);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();

