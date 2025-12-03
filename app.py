# app.py
import os
import time
import json
from datetime import datetime, timezone
from flask import Flask, render_template, jsonify, request
import requests
import xml.etree.ElementTree as ET

app = Flask(__name__, static_folder='static', template_folder='templates')

# Configuration / placeholders
COINGECKO_API = "https://api.coingecko.com/api/v3"
# Example endpoints for other services (placeholders)
COINGLASS_API = "https://api.coinglass.com/api/pro/v1"  # placeholder
DUNE_API = "https://api.dune.com/api/v1"  # placeholder
HYPERLIQUID_BLOG_RSS = "https://hyperliquid.gitbook.io/rss.xml"  # placeholder
COINTELEGRAPH_RSS = "https://cointelegraph.com/rss"  # placeholder
THEBLOCK_RSS = "https://www.theblock.co/rss"  # placeholder
REDDIT_RSS = "https://www.reddit.com/r/Hyperliquid/.rss"  # placeholder

# Optional: set environment variables for API keys if you have them
COINGLASS_KEY = os.environ.get("COINGLASS_KEY", "")
DUNE_KEY = os.environ.get("DUNE_KEY", "")

HEADERS = {
    "User-Agent": "HyperHub/1.0 (+https://hyperhub.xyz)"
}

def safe_get(url, params=None, headers=None, timeout=12):
    headers = headers or HEADERS
    try:
        r = requests.get(url, params=params, headers=headers, timeout=timeout)
        r.raise_for_status()
        return r
    except Exception as e:
        app.logger.warning(f"safe_get error for {url}: {e}")
        return None

@app.route("/")
def index():
    return render_template("index.html")

# 1) Realtime Dashboard: HYPE price from CoinGecko
@app.route("/api/price")
def api_price():
    # CoinGecko: /coins/markets?vs_currency=usd&ids=...
    # Replace 'hyperliquid' with the actual CoinGecko id for HYPE token if available.
    coin_id = request.args.get("id", "hyperliquid")  # placeholder id
    url = f"{COINGECKO_API}/coins/markets"
    params = {"vs_currency": "usd", "ids": coin_id, "order": "market_cap_desc", "per_page": 1, "page": 1, "sparkline": False}
    r = safe_get(url, params=params)
    if not r:
        return jsonify({"error": "failed_fetch"}), 502
    data = r.json()
    if not data:
        return jsonify({"error": "no_data"}), 404
    item = data[0]
    result = {
        "id": item.get("id"),
        "symbol": item.get("symbol"),
        "name": item.get("name"),
        "price": item.get("current_price"),
        "change_24h": item.get("price_change_percentage_24h"),
        "volume_24h": item.get("total_volume"),
        "market_cap": item.get("market_cap"),
        "last_updated": item.get("last_updated")
    }
    return jsonify(result)

# 2) News aggregator: fetch RSS from multiple sources and merge
@app.route("/api/news")
def api_news():
    sources = [
        {"name": "CoinTelegraph", "url": COINTELEGRAPH_RSS},
        {"name": "TheBlock", "url": THEBLOCK_RSS},
        {"name": "Hyperliquid", "url": HYPERLIQUID_BLOG_RSS},
        {"name": "Reddit", "url": REDDIT_RSS}
    ]
    items = []
    for s in sources:
        r = safe_get(s["url"])
        if not r:
            continue
        try:
            root = ET.fromstring(r.content)
            # RSS feed: channel/item or feed/entry
            for item in root.findall(".//item") + root.findall(".//entry"):
                title = item.findtext("title") or item.findtext("{http://www.w3.org/2005/Atom}title")
                link = item.findtext("link") or item.findtext("{http://www.w3.org/2005/Atom}link")
                pub = item.findtext("pubDate") or item.findtext("published") or item.findtext("updated")
                desc = item.findtext("description") or item.findtext("summary")
                # link may be an element with href
                if link is None:
                    link_el = item.find("{http://www.w3.org/2005/Atom}link")
                    if link_el is not None:
                        link = link_el.attrib.get("href")
                items.append({
                    "source": s["name"],
                    "title": title or "(no title)",
                    "link": link or "",
                    "pubDate": pub or "",
                    "description": (desc or "")[:400]
                })
        except Exception as e:
            app.logger.warning(f"Failed parse RSS {s['url']}: {e}")
            continue
    # sort by pubDate if available (best-effort)
    def parse_time(t):
        try:
            return datetime.fromisoformat(t.replace("Z", "+00:00"))
        except:
            return datetime.now(timezone.utc)
    items = sorted(items, key=lambda x: parse_time(x.get("pubDate","")), reverse=True)
    return jsonify({"items": items[:50], "fetched_at": datetime.now(timezone.utc).isoformat()})

# 3) Sentiment analysis: simple dictionary-based on headlines + reddit titles
@app.route("/api/sentiment")
def api_sentiment():
    # Fetch news headlines from /api/news (internal)
    news_resp = api_news()
    news_json = news_resp.get_json() if isinstance(news_resp, (dict,)) else news_resp.get_json()
    headlines = [i.get("title","") for i in news_json.get("items", [])]

    # Fetch reddit RSS separately for more titles
    r = safe_get(REDDIT_RSS)
    reddit_titles = []
    if r:
        try:
            root = ET.fromstring(r.content)
            for entry in root.findall(".//entry") + root.findall(".//item"):
                t = entry.findtext("title")
                if t:
                    reddit_titles.append(t)
        except:
            pass

    texts = headlines + reddit_titles

    # Simple sentiment dictionary
    positive = set(["gain","bull","bullish","surge","rally","up","moon","pump","positive","beat","record","growth","increase","win"])
    negative = set(["drop","down","bear","bearish","dump","crash","loss","decline","sell","negative","risk","liquidation","fall","slump"])

    score = 0
    pos_count = 0
    neg_count = 0
    for t in texts:
        t_low = t.lower()
        for p in positive:
            if p in t_low:
                score += 1
                pos_count += 1
        for n in negative:
            if n in t_low:
                score -= 1
                neg_count += 1

    # Normalize to 0-100 CBBI-like component for sentiment
    total = pos_count + neg_count
    if total == 0:
        sentiment_index = 50
    else:
        sentiment_index = int(50 + (score / total) * 50)
        sentiment_index = max(0, min(100, sentiment_index))

    return jsonify({
        "sentiment_score": sentiment_index,
        "pos_count": pos_count,
        "neg_count": neg_count,
        "sample_headlines": headlines[:10],
        "fetched_at": datetime.now(timezone.utc).isoformat()
    })

# 4) Whale activity monitor (placeholder using Dune or public endpoints)
@app.route("/api/whales")
def api_whales():
    # Placeholder: attempt to fetch from a public Dune query or Coinalyze endpoint
    # For demo, we return simulated data
    try:
        # If you have a Dune query endpoint, call it here and parse results
        # Example placeholder simulated whales:
        whales = [
            {"tx_hash": "0xabc123", "pair": "HYPE/USDC", "side": "long", "size_usd": 250000, "time": datetime.now(timezone.utc).isoformat()},
            {"tx_hash": "0xdef456", "pair": "HYPE/ETH", "side": "short", "size_usd": 180000, "time": datetime.now(timezone.utc).isoformat()},
            {"tx_hash": "0xghi789", "pair": "BTC/USDC", "side": "long", "size_usd": 500000, "time": datetime.now(timezone.utc).isoformat()}
        ]
        # compute summary
        total_whale_volume = sum(w["size_usd"] for w in whales)
        return jsonify({"whales": whales, "total_whale_volume": total_whale_volume, "fetched_at": datetime.now(timezone.utc).isoformat()})
    except Exception as e:
        app.logger.warning(f"whales error: {e}")
        return jsonify({"whales": [], "error": "failed"}), 500

# 5) Open Interest tracker (placeholder using CoinGlass or Coinalyze)
@app.route("/api/oi")
def api_oi():
    # Placeholder: simulate longs/shorts ratio and OI time series
    try:
        # Simulated time series for last 12 points (12 hours/days)
        now = int(time.time())
        series = []
        for i in range(12):
            t = now - (11 - i) * 3600
            longs = 1000000 + (i * 20000) + (i % 3) * 50000
            shorts = 800000 + (i * 15000) + ((i+1) % 4) * 30000
            oi = longs + shorts
            ratio = longs / max(1, shorts)
            series.append({"ts": t, "longs": longs, "shorts": shorts, "oi": oi, "long_short_ratio": round(ratio, 3)})
        # current summary
        latest = series[-1]
        return jsonify({"series": series, "latest": latest, "fetched_at": datetime.now(timezone.utc).isoformat()})
    except Exception as e:
        app.logger.warning(f"oi error: {e}")
        return jsonify({"series": [], "error": "failed"}), 500

# 6) Governance tracker (HIPs + votes) - placeholder using subgraph or Chainstack
@app.route("/api/governance")
def api_governance():
    # Placeholder: simulated HIPs
    hip_list = [
        {"id": "HIP-1", "title": "Increase beHYPE staking rewards", "status": "active", "proposer": "0xabc", "aye": [{"validator":"val1","stake":12000},{"validator":"val2","stake":8000}], "nay": [{"validator":"val3","stake":2000}]},
        {"id": "HIP-2", "title": "Adjust fee structure", "status": "closed", "proposer": "0xdef", "aye": [{"validator":"val2","stake":5000}], "nay": [{"validator":"val1","stake":3000},{"validator":"val4","stake":1000}]}
    ]
    return jsonify({"hips": hip_list, "fetched_at": datetime.now(timezone.utc).isoformat()})

# Simple health endpoint
@app.route("/api/health")
def api_health():
    return jsonify({"status": "ok", "time": datetime.now(timezone.utc).isoformat()})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)

