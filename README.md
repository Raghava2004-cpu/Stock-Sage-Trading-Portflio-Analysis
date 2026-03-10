# 📈 StockSage — Portfolio Analytics Dashboard

A full-stack portfolio analytics platform for Global stock market (NSE/BSE) investors. Upload your Zerodha trade history and get deep insights into your portfolio — P&L, XIRR, tax classification, anomaly detection, and more.

🔗 **Live Demo:** [stock-sage-trading-portflio-analysi.vercel.app](https://stock-sage-trading-portflio-analysi.vercel.app)

---

## 🚀 Features

### 📊 Portfolio Overview
- Total invested, current value, overall P&L
- Best & worst performing stocks by XIRR
- Tax classification summary (LTCG / STCG / F&O)
- Portfolio allocation pie chart
- P&L bar chart (top 10 stocks)

### 📈 Portfolio History
- Track portfolio value over time across multiple uploads
- Line chart showing growth across snapshots
- Timestamps in IST

### 🔬 Analysis Tab
- **XIRR % per stock** — annualized return bar chart (color-coded: green > 12%, blue 0–12%, red negative)
- **Conviction Score per stock** — 0–100 score based on holding duration, trade frequency & return consistency
- Reference lines at 75 (High) and 50 (Mid) conviction thresholds

### 🗺️ Sector Heatmap
- Stocks grouped by sector (Energy, Banking, IT, Finance, Auto, FMCG, Pharma, Metal, Infra, Telecom)
- Color-coded tiles by P&L percentage (dark green → dark red)
- Tile size proportional to position size

### 🔍 Anomaly Detection
- **Panic Sell** — stocks held far shorter than your average
- **Overtrading** — stocks with 2.5x your average trade count
- **Concentration Risk** — single stock > 30% of portfolio
- **Big Bet, Low Conviction** — large position with low conviction score
- **Sold Your Best Performer** — exited a top XIRR stock
- **Held a Loser Too Long** — negative XIRR stock held above average duration
- **Missed Opportunity** — low volatility winner that was undersized

### 💰 Tax Optimizer
- LTCG & STCG gain calculation
- Tax-loss harvesting suggestions
- Estimated tax savings per stock
- Based on Budget 2024 rules (LTCG exempt ₹1.25L, 12.5% above; STCG 20%)

### 📄 PDF Export
- One-click portfolio scorecard download
- Includes summary, all stocks table, top gainers/losers, conviction leaderboard

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Charts | Recharts |
| HTTP Client | Axios |
| Backend | FastAPI (Python) |
| Database | PostgreSQL (Render) |
| ORM | SQLAlchemy |
| Auth | JWT (python-jose) |
| Analytics | Pandas, NumPy |
| Live Prices | yfinance |
| Frontend Deploy | Vercel |
| Backend Deploy | Render |

---

## 📁 Project Structure

```
StockSage/
├── backend/
│   ├── api.py                  # FastAPI routes
│   ├── auth.py                 # JWT authentication
│   ├── database.py             # SQLAlchemy models
│   ├── prices.py               # Live price fetching
│   ├── config.py               # Broker schemas & constants
│   ├── requirements.txt
│   └── pipeline/
│       ├── ingestor.py         # CSV ingestion
│       ├── cleaner.py          # Data cleaning & F&O parsing
│       └── analytics.py        # P&L, XIRR, conviction scoring
└── frontend/
    ├── public/
    ├── src/
    │   ├── components/
    │   │   ├── Dashboard.jsx   # Main dashboard (6 tabs)
    │   │   ├── HistoryChart.jsx
    │   │   ├── LivePnLBar.jsx
    │   │   ├── TaxOptimizer.jsx
    │   │   ├── Landing.jsx
    │   │   ├── AuthPage.jsx
    │   │   └── UploadPage.jsx
    │   ├── constants.js        # API URL, colors, styles
    │   └── main.jsx
    └── index.html
```

---

## ⚙️ Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Zerodha tradebook CSVs (equity, F&O, holdings)

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn api:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Update `frontend/src/constants.js`:
```js
export const API = "http://127.0.0.1:8000";
```

---

## 📤 CSV Format (Zerodha)

Upload 3 files from your Zerodha Console:

| File | Download From |
|------|--------------|
| `zerodha_tradebook_equity.csv` | Console → Reports → Tradebook → Equity |
| `zerodha_tradebook_fno.csv` | Console → Reports → Tradebook → F&O |
| `zerodha_holdings.csv` | Console → Portfolio → Holdings |

---

## 🌐 Deployment

### Backend — Render
- **Runtime:** Python 3.11
- **Start Command:** `uvicorn api:app --host 0.0.0.0 --port $PORT`
- **Root Directory:** `backend`
- **Environment Variables:**
  - `DATABASE_URL` — PostgreSQL connection string
  - `JWT_SECRET` — secret key for token signing
  - `PYTHON_VERSION` — `3.11.8`

### Frontend — Vercel
- **Framework:** Vite
- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

---

## 📊 Analytics Engine

### XIRR Calculation
Pure Python Newton-Raphson implementation — no scipy dependency. Computes annualized return for each stock using actual buy/sell cashflows and current market value.

### Conviction Score (0–100)
Composite score based on:
- Holding duration vs your personal average
- Trade frequency consistency
- Return vs volatility ratio
- Position sizing relative to portfolio

### Anomaly Detection
Compares each stock against your **own** baseline — not generic benchmarks. Flags statistically significant deviations in holding behaviour, trade frequency, position sizing, and return patterns.

---

## 🔒 Security
- Passwords hashed with bcrypt
- JWT tokens with configurable expiry
- All API routes protected with Bearer token auth
- Auto-logout on 401 response

---

## 📸 Screenshots

> Overview Tab · Analysis Tab · Sector Heatmap · Anomaly Detection · Tax Optimizer

---

## 🤝 Contributing

Pull requests welcome! For major changes, please open an issue first.

---

## 📜 License

MIT License — free to use, modify and distribute.

---

*Built with ❤️ for Global retail investors*
