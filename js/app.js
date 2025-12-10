// js/app.js
(() => {
  // Direct API endpoints for static site (no backend)
  const API = {
    // Replace "hyperliquid" with the actual CoinGecko ID for HYPE if available.
    price: "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=hyperliquid&order=market_cap_desc&per_page=1&page=1&sparkline=false",

    // RSS feeds with CORS proxy (fallback to demo if fails)
    newsFeeds: [
      "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://www.reddit.com/r/Hyperliquid/.rss"),
      "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://cointelegraph.com/rss"),
      "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://www.theblock.co/rss")
    ],

    // Fallback demo news (for 2025, if RSS down)
    demoNews: [
      { title: "Hyperliquid launches HYPE staking v2.0", source: "CoinTelegraph" },
      { title: "HIP-5: New governance vote on fee reduction", source: "TheBlock" },
      { title: "Whales accumulate 1M HYPE amid bull run", source: "Reddit r/Hyperliquid" },
      { title: "Hyperliquid TVL hits $500M in December 2025", source: "Official Blog" },
      { title: "Integration with Aster for faster trades", source: "Twitter" }
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

  // Charts (placeholder - assume Chart.js loaded)
  let sentimentChart = null;
  let oiChart = null;
  // ... (zbytek chart vars stejný)

  // GIYP mock (text)
  function loadGiypMock() {
    const giypMock = {
      proposal: "HIP-3",
      effect: "+1% beHYPE yield",
      sentiment: "Positive",
      timestamp: new Date().toLocaleTimeString()
    };
    const el = document.getElementById("giypIndicator");
    if (el) {
      el.textContent = `${giypMock.proposal}: ${giypMock.effect} (${giypMock.sentiment})`;
    }
  }

  // CCLB mock (text)
  function loadCclbMock() {
    const cclbMock = {
      hyperliquid: "950ms",
      aster: "1150ms",
      lighter: "1200ms"
    };
    const el = document.getElementById("cclbIndicator");
    if (el) {
      el.textContent = `Hyperliquid: ${cclbMock.hyperliquid}ms | Aster: ${cclbMock.aster}ms | Lighter: ${cclbMock.lighter}ms`;
    }
  }

  // Fetch price (CoinGecko)
  async function fetchPrice() {
    try {
      const res = await fetch(API.price);
      const data = await res.json();
      const coin = data[0];
      if (hypePriceEl) hypePriceEl.textContent = fmtUSD(coin.current_price);
      if (hypeChangeEl) hypeChangeEl.textContent = coin.price_change_percentage_24h.toFixed(2) + "%";
      if (cardPriceEl) cardPriceEl.textContent = fmtUSD(coin.current_price);
      if (cardVolumeEl) cardVolumeEl.textContent = fmtUSD(coin.total_volume);
      if (cardMarketCapEl) cardMarketCapEl.textContent = fmtUSD(coin.market_cap);
      if (lastUpdatedEl) lastUpdatedEl.textContent = "Updated: " + new Date().toLocaleTimeString();
    } catch (e) {
      console.warn("Price fetch error:", e);
    }
  }

  // Fetch news with fallback demo
  async function fetchNews() {
    console.log("fetchNews started");
    if (!newsListEl) {
      console.error("newsListEl null");
      return;
    }
    newsListEl.innerHTML = '<div class="text-sm muted">Loading news...</div>';
    try {
      const feeds = API.newsFeeds;
      const responses = await Promise.all(feeds.map(url => fetch(url).then(r => r.ok ? r.text() : "").catch(() => "")));
      let items = [];
      let hasRealData = false;
      responses.forEach((xml, i) => {
        if (xml && xml.includes('<title>')) {
          hasRealData = true;
          const titles = [...xml.matchAll(/<title>([^<]+)<\/title>/g)].slice(1, 4).map(m => m[1].trim());
          items.push(...titles.map(title => ({ title, source: feeds[i].split('url=')[1]?.split('%')[0] || 'RSS' })));
        }
      });
      if (!hasRealData || items.length === 0) {
        console.log("Using demo news (RSS down)");
        items = API.demoNews.slice(0, 5);  // Fallback
      }
      items = items.slice(0, 8).reverse();
      newsListEl.innerHTML = "";
      items.forEach(item => {
        const el = document.createElement("div");
        el.className = "mb-2 p-2 glass rounded text-sm";
        el.innerHTML = `<a href="#" class="hover:underline">${item.title}</a><div class="muted text-xs mt-1">${item.source}</div>`;
        newsListEl.appendChild(el);
      });
      console.log("fetchNews done, items:", items.length);
    } catch (e) {
      console.error("fetchNews error:", e);
      // Fallback to demo
      const items = API.demoNews.slice(0, 5);
      newsListEl.innerHTML = "";
      items.forEach(item => {
        const el = document.createElement("div");
        el.className = "mb-2 p-2 glass rounded text-sm";
        el.innerHTML = `<a href="#" class="hover:underline">${item.title}</a><div class="muted text-xs mt-1">${item.source}</div>`;
        newsListEl.appendChild(el);
      });
      console.log("Fallback demo loaded");
    }
  }

  // Fetch sentiment (depends on news)
  async function fetchSentiment() {
    if (!newsListEl || !newsListEl.children.length) {
      console.warn("No news for sentiment, skipping");
      return;
    }
    const titles = Array.from(newsListEl.querySelectorAll("a")).map(a => a.textContent.toLowerCase());
    const positiveWords = ['bull', 'rise', 'gain', 'launch', 'positive', 'up', 'grow'];
    const negativeWords = ['ban', 'drop', 'fall', 'risk', 'down', 'crash', 'negative'];
    let score = 0;
    titles.forEach(title => {
      positiveWords.forEach(word => { if (title.includes(word)) score += 1; });
      negativeWords.forEach(word => { if (title.includes(word)) score -= 1; });
    });
    score = Math.max(-100, Math.min(100, score * 10));  // Scale to -100 to 100
    if (sentimentScoreEl) sentimentScoreEl.textContent = score + "%";
    // Update chart if exists
    if (sentimentChart) sentimentChart.data.datasets[0].data = [score];
    if (sentimentChart) sentimentChart.update();
    console.log("Sentiment score:", score);
  }

  // Fetch whales (demo)
  function fetchWhales() {
    if (!whaleListEl) return;
    whaleListEl.innerHTML = "";
    API.whalesDemo.forEach(whale => {
      const el = document.createElement("div");
      el.className = "mb-2 p-2 glass rounded text-sm";
      el.innerHTML = `<div>${whale.pair} - ${whale.side.toUpperCase()} $${fmtNum(whale.size_usd)} (${new Date(whale.time).toLocaleString()})</div>`;
      whaleListEl.appendChild(el);
    });
    console.log("Whales loaded (demo)");
  }

  // Fetch OI (demo)
  function fetchOI() {
    if (!oiLatestEl) return;
    const latest = API.oiDemo[API.oiDemo.length - 1];
    oiLatestEl.textContent = fmtUSD(latest.oi);
    // Update chart if exists
    console.log("OI loaded:", latest.oi);
  }

  // Fetch governance demo
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

  // Async fetchAll
  async function fetchAll() {
    console.log("fetchAll started");
    fetchPrice();
    await fetchNews();
    await fetchSentiment();
    fetchWhales();
    fetchOI();
    fetchGovernanceDemo();
    loadGiypMock();
    loadCclbMock();
    console.log("fetchAll done");
  }

  // Init charts (placeholder - load Chart.js if needed)
  function initCharts() {
    // Assume Chart.js is loaded - add your chart init here
    console.log("Charts inited (placeholder)");
  }

  // Init tabs (placeholder)
  function initTabs() {
    const btns = document.querySelectorAll(".tabBtn");
    btns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const t = btn.dataset.tab;
        document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
        document.getElementById(t).classList.remove("hidden");
        btns.forEach(b => b.classList.remove("bg-white/10"));
        btn.classList.add("bg-white/10");
      });
    });
    const first = document.querySelector(".tabBtn");
    if (first) first.click();
  }

  // Robust initMobileMenu (no errors on null)
  function initMobileMenu() {
    const mobileBtn = document.getElementById("mobileMenuBtn");
    const mobileMenu = document.getElementById("mobileMenu");
    const mobileClose = document.getElementById("mobileClose");
    if (!mobileBtn || !mobileMenu || !mobileClose) {
      console.log("Mobile menu missing - skipping");
      return;
    }
    try {
      mobileBtn.addEventListener("click", () => mobileMenu.classList.remove("hidden"));
      mobileClose.addEventListener("click", () => mobileMenu.classList.add("hidden"));
      mobileMenu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => mobileMenu.classList.add("hidden")));
      console.log("Mobile menu inited");
    } catch (e) {
      console.warn("Mobile menu init error:", e);
    }
  }

  // Theme toggle
  function initTheme() {
    const btn = document.getElementById("themeToggle");
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

  // Init
  function init() {
    console.log("App init started");
    initCharts();
    initTabs();
    initMobileMenu();
    initTheme();
    fetchAll();
    // Interval with clear
    setInterval(() => {
      if (newsListEl) newsListEl.innerHTML = "";
      if (sentimentScoreEl) sentimentScoreEl.innerHTML = "";
      if (whaleListEl) whaleListEl.innerHTML = "";
      console.log("Interval clear + fetchAll");
      fetchAll();
    }, 60 * 1000);
    console.log("App init done");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
