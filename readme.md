# HyperHub — made by Ruby Nodes

**HyperHub** is a dark-mode, responsive dashboard for the Hyperliquid community.
Slogan: “Unlock Hyperliquid Insights: Track, Govern, Thrive.”
Tagline: Made by Ruby Nodes  
Domain mention: https://hyperhub.app

This repository contains a small Flask backend that proxies public data sources and a single-page frontend built with Tailwind CSS and Chart.js.

---

## Features implemented (lightweight, free-data-first)
- **Realtime Dashboard**: HYPE price, 24h change, volume, market cap (CoinGecko).
- **News Aggregator**: RSS from CoinTelegraph, TheBlock, Hyperliquid blog, Reddit r/Hyperliquid (placeholders).
- **Sentiment Analysis**: Simple dictionary-based sentiment from headlines and Reddit titles.
- **Whale Activity Monitor**: Placeholder simulated whale data (replace with Dune/Coinalyze queries).
- **Open Interest Tracker**: Simulated OI series (replace with CoinGlass/Coinalyze).
- **Optimized RPC Offering**: Subtle promotional card linking to rubynodes.io.
- **Education**: Static cards for onboarding content.
- **HSI Index**: Hyperliquid sentiment index combining sentiment, whales, and OI.
- **Governance Tracker**: HIPs with aye/nay lists (simulated placeholders).
- **Responsive**: Mobile-first, sidebar/hamburger, dark mode.

---

## Quick start (local)

1. **Clone or copy files** into a folder (e.g., `hyperhub/`).

2. **Create virtualenv** (recommended):

```bash
python -m venv venv
source venv/bin/activate   # macOS / Linux
venv\Scripts\activate      # Windows

