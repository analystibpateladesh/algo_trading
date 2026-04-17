# AlgoTrader Pro — Algorithmic Trading Dashboard

A full-stack backtesting platform. Runs 100% FREE using:
- **yfinance** — free stock data (Yahoo Finance)
- **FastAPI** — free Python web framework
- **SQLite** — free local database (no setup needed)
- **React + Recharts** — free frontend
- **Render / Railway** — free cloud deployment

---

## Project Structure

```
algo_trading/
├── backend/
│   ├── main.py            ← FastAPI app (all strategies + backtester)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx        ← Full React dashboard
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── data/
│   └── trades.db          ← Created automatically on first run
└── README.md
```

---

## STEP 1 — Install Python & Node.js (FREE)

### Python (if not installed)
Download from https://python.org/downloads — choose Python 3.11 only(not uper models)
During install, CHECK "Add Python to PATH"

### Node.js (if not installed)
Download from https://nodejs.org — choose "LTS" version

Verify both are installed:
```bash
python --version     # Should show 3.11.
node --version       # Should show 18+
```

---

## STEP 2 — Set up the Backend

Open a terminal (Command Prompt on Windows, Terminal on Mac/Linux):

```bash
# Go into the backend folder
cd algo_trading/backend

# Create a virtual environment (keeps things clean)
py -3.11 -m venv venv

# Activate it:
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

#then...
pip install --upgrade pip setuptools wheel
pip install pandas==2.2.2
# or
#Force pip to use binaries only:
pip install pandas==2.2.2 --only-binary :all:

pip install fastapi uvicorn yfinance pandas numpy
# Install all dependencies (all FREE)
pip install -r requirements.txt
```

This installs: FastAPI, uvicorn, yfinance, pandas, numpy — all free & open source.

---

## STEP 3 — Run the Backend

Still in the backend folder with venv activated:

```bash
python -m uvicorn main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

Open your browser and visit:
- http://localhost:8000        → should show {"message": "AlgoTrader Pro API is running"}
- http://localhost:8000/docs   → automatic interactive API docs (FREE, built into FastAPI!)

**Leave this terminal open.**

---

## STEP 4 — Set up & Run the Frontend

Open a NEW terminal window:

```bash
# Go into the frontend folder
cd algo_trading/frontend

# Install Node dependencies (all FREE)
npm install

# Start the dev server
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:3000/
```

Open http://localhost:3000 — your dashboard is live!

---

## STEP 5 — How to Use the Dashboard

1. **Select an asset** — AAPL, TSLA, NVDA, SPY, BTC-USD, etc.
2. **Select a strategy** — SMA Crossover, RSI, MACD, or Bollinger Bands
3. **Select a time period** — 1mo, 3mo, 6mo, 1y, 2y
4. **Enter starting capital** — default $10,000
5. Click **Run backtest**

You'll see:
- Total return, Sharpe ratio, Max drawdown, Win rate, Sortino, Profit factor
- Price chart with buy/sell signals
- P&L vs Buy & Hold comparison
- Drawdown curve
- Trade-by-trade log

Switch to **Compare** tab to run all 4 strategies side by side on the same asset.
Switch to **History** tab to see all your saved backtest runs.

---

## API Endpoints (for your resume/portfolio)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/price/{symbol} | Raw OHLCV price data |
| GET | /api/backtest/{symbol}?strategy=macd&period=6mo | Full backtest results |
| GET | /api/compare/{symbol} | Compare all 4 strategies |
| GET | /api/history | Saved backtest history |
| POST | /api/watchlist/{symbol} | Add to watchlist |
| GET | /docs | Interactive API explorer |

---

## FREE Deployment (show it live in interviews!)

### Option A — Render.com (100% Free)
1. Push your code to GitHub (free)
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Backend settings:
   - Root directory: `backend`
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Frontend: New → Static Site
   - Root directory: `frontend`
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`

### Option B — Railway.app (Free tier)
Similar process, even easier UI.

---

## What to Say in Interviews

**"I built a full-stack algorithmic trading backtesting platform."**

Key talking points:
- "It fetches real market data from Yahoo Finance using yfinance"
- "I implemented 4 strategies from scratch in Python: SMA crossover, RSI mean reversion, MACD momentum, and Bollinger Bands"
- "The backtester accounts for transaction costs (0.1% per trade) and position sizing"
- "I compute Sharpe ratio, Sortino ratio, max drawdown, win rate, and profit factor"
- "The REST API is built with FastAPI and results persist in SQLite"
- "The React frontend uses Recharts for interactive visualizations"

---

## Extending the Project (bonus points!)

1. **Add more strategies** — Pairs trading, mean reversion, momentum
2. **Add ML predictions** — scikit-learn price prediction layer
3. **Add portfolio optimization** — Markowitz efficient frontier
4. **Add real-time alerts** — WebSocket price alerts
5. **Add more data** — Fundamental data, news sentiment

---

## Technologies Used (all FREE)

| Layer | Technology | Cost |
|-------|-----------|------|
| Data | yfinance (Yahoo Finance) | FREE |
| Backend | FastAPI + Python | FREE |
| Database | SQLite | FREE |
| Frontend | React + Vite | FREE |
| Charts | Recharts | FREE |
| Deployment | Render / Railway | FREE |
| Version control | GitHub | FREE |
