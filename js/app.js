// js/app.js - FINÁLNÍ FIX 2025: Demo data, no errors, no růst
(() => {
  // API - demo only (RSS down in 2025)
  const API = {
    price: "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=hyperliquid&order=market_cap_desc&per_page=1&page=1&sparkline=false",
    demoNews: [
      { title: "Hyperliquid API outage due to traffic spike (no hack)", source: "CoinSpeaker, Jul 2025" },
      { title: "Hyperliquid Strategies announces $30M stock buyback", source: "StockTitan, Dec 2025" },
      { title: "HIP-6 vote passes: Fee burn for HYPE holders", source: "TheBlock" },
      { title: "Whales load 2M HYPE on Aster integration", source: "r/hyperliquid1" },
      { title: "beHYPE staking yields hit 15% APY amid bull run", source: "Official Blog" }
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
      { id: "HIP-1", title: "Increase beHYPE staking rewards", status: "active", proposer: "0xabc", aye: [{ validator: "val1", stake: 12000 }, { validator: "val2", stake: 8000 }], nay: [{ validator: "val3", stake: 2000 }] },
      { id: "HIP-2", title: "Adjust fee structure", status: "closed", proposer: "0xdef", aye: [{ validator: "val2", stake: 5000 }], nay: [{ validator: "val1", stake: 3000 }, { validator: "val4", stake: 1000 }] }
    ]
  };

  // Utilities
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

  // Load demo news (instant, no fetch)
  function loadNewsDemo() {
    if (!newsListEl) {
      console.warn("newsListEl null - check HTML");
      return;
    }
    newsListEl.innerHTML = "";  // Clear loading
    const items = API.demoNews.slice(0, 5);
    items.forEach(item => {
      const el = document.createElement("div");
      el.className = "mb-2 p-2 glass rounded text-sm";
      el.innerHTML = `<a href="#" class="hover:underline">${item.title}</a><div class="muted text-xs mt-1">${item.source}</div>`;
      newsListEl.appendChild(el);
    });
    console.log("Demo news loaded:", items.length, "items");
  }

  // Demo sentiment
  function loadSentimentDemo() {
    if (!sentimentScoreEl) return;
    const score = 75;  // Positive
    sentimentScoreEl.textContent = score + "%";
    console.log("Sentiment loaded:", score + "%");
  }

  // Demo whales
  function loadWhalesDemo() {
    if (!whaleListEl) return;
    whaleListEl.innerHTML = "";
    API.whalesDemo.forEach(whale => {
      const el = document.createElement("div");
      el.className = "mb-2 p-2 glass rounded text-sm";
      el.innerHTML = `<div>${whale.pair} - ${whale.side.toUpperCase()} $${fmtNum(whale.size_usd)} (${new Date(whale.time).toLocaleString()})</div>`;
      whaleListEl.appendChild(el);
    });
    console.log("Whales loaded");
  }

  // Demo OI
  function loadOIDemo() {
    if (!oiLatestEl) return;
    const latest = API.oiDemo[API.oiDemo.length - 1];
    oiLatestEl.textContent = fmtUSD(latest.oi);
    console.log("OI loaded");
  }

  // Demo governance
  function loadGovernanceDemo() {
    if (!govSnapshotEl) return;
    const hips = API.governanceDemo;
    govSnapshotEl.innerHTML = "";
    const hipsListEl = document.getElementById("hipsList");
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
    console.log("Governance loaded");
  }

  // Price fetch (async)
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
      console.log("Price loaded");
    } catch (e) {
      console.warn("Price error:", e);
    }
  }

  // Load all (demo + price)
  async function loadAll() {
    console.log("loadAll started");
    loadNewsDemo();
    loadSentimentDemo();
    loadWhalesDemo();
    loadOIDemo();
    loadGovernanceDemo();
    await fetchPrice();
    console.log("loadAll done");
  }

  // Safe init functions
  function initCharts() {
    console.log("Charts OK");
  }

  function initTabs() {
    try {
      const btns = document.querySelectorAll(".tabBtn");
      if (btns.length > 0) {
        btns.forEach(btn => btn.addEventListener("click", e => {
          const t = btn.dataset.tab;
          document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
          document.getElementById(t).classList.remove("hidden");
          btns.forEach(b => b.classList.remove("bg-white/10"));
          btn.classList.add("bg-white/10");
        }));
        btns[0].click();
      }
    } catch (e) {
      console.warn("Tabs error:", e);
    }
  }

  function initMobileMenu() {
    try {
      const mobileBtn = document.getElementById("mobileMenuBtn");
      const mobileMenu = document.getElementById("mobileMenu");
      const mobileClose = document.getElementById("mobileClose");
      if (!mobileBtn || !mobileMenu || !mobileClose) return;
      mobileBtn.addEventListener("click", () => mobileMenu.classList.remove("hidden"));
      mobileClose.addEventListener("click", () => mobileMenu.classList.add("hidden"));
      mobileMenu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => mobileMenu.classList.add("hidden")));
    } catch (e) {
      console.warn("Mobile menu error:", e);
    }
  }

  function initTheme() {
    try {
      const btn = document.getElementById("themeToggle");
      if (!btn) return;
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
        html.classList.toggle("light");
        localStorage.setItem("hyperhub-theme", html.classList.contains("light") ? "light" : "dark");
        btn.textContent = html.classList.contains("light") ? "Light" : "Dark";
      });
    } catch (e) {
      console.warn("Theme error:", e);
    }
  }

  // Main init with full try-catch
  function init() {
    try {
      console.log("Init started");
      initCharts();
      initTabs();
      initMobileMenu();
      initTheme();
      loadAll();
      setInterval(() => {
        if (newsListEl) newsListEl.innerHTML = "";
        if (sentimentScoreEl) sentimentScoreEl.innerHTML = "";
        if (whaleListEl) whaleListEl.innerHTML = "";
        console.log("Interval clear");
        loadAll();
      }, 60000);
      console.log("Init OK - dashboard ready!");
    } catch (e) {
      console.error("Init error:", e);
      // Emergency fallback
      loadNewsDemo();
      loadSentimentDemo();
      console.log("Emergency fallback loaded");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
