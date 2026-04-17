"""
AlgoTrader Pro — FastAPI Backend
Free stack: yfinance (free data) + SQLite (free DB) + FastAPI (free server)
Run: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sqlite3, json, os
from datetime import datetime, timedelta

import yfinance as yf
import pandas as pd
import numpy as np

app = FastAPI(title="AlgoTrader Pro API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # In production, set to your frontend URL
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "../data/trades.db")

# Create data directory if it doesn't exist
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

# ── Database setup ────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS backtest_results (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol      TEXT NOT NULL,
            strategy    TEXT NOT NULL,
            period      TEXT NOT NULL,
            total_return REAL,
            sharpe      REAL,
            max_dd      REAL,
            win_rate    REAL,
            n_trades    INTEGER,
            params      TEXT,
            created_at  TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS watchlist (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol  TEXT UNIQUE NOT NULL,
            added   TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    conn.close()

init_db()

# ── Strategy implementations ──────────────────────────────────────────────────

def strategy_sma_crossover(df: pd.DataFrame, short=20, long=50) -> pd.DataFrame:
    """Buy when short SMA crosses above long SMA, sell on cross below."""
    df = df.copy()
    df["sma_short"] = df["Close"].rolling(short).mean()
    df["sma_long"]  = df["Close"].rolling(long).mean()
    df["signal"] = 0
    df.loc[
        (df["sma_short"] > df["sma_long"]) &
        (df["sma_short"].shift(1) <= df["sma_long"].shift(1)),
        "signal"
    ] = 1
    df.loc[
        (df["sma_short"] < df["sma_long"]) &
        (df["sma_short"].shift(1) >= df["sma_long"].shift(1)),
        "signal"
    ] = -1
    return df

def strategy_rsi(df: pd.DataFrame, period=14, oversold=30, overbought=70) -> pd.DataFrame:
    """Buy on RSI < oversold, sell on RSI > overbought."""
    df = df.copy()
    delta = df["Close"].diff()
    gain  = delta.clip(lower=0).rolling(period).mean()
    loss  = (-delta.clip(upper=0)).rolling(period).mean()
    rs    = gain / loss.replace(0, np.nan)
    df["rsi"] = 100 - 100 / (1 + rs)
    df["signal"] = 0
    df.loc[df["rsi"] < oversold,  "signal"] = 1
    df.loc[df["rsi"] > overbought, "signal"] = -1
    return df

def strategy_macd(df: pd.DataFrame, fast=12, slow=26, signal_period=9) -> pd.DataFrame:
    """Buy when MACD line crosses above signal line."""
    df = df.copy()
    ema_fast = df["Close"].ewm(span=fast, adjust=False).mean()
    ema_slow = df["Close"].ewm(span=slow, adjust=False).mean()
    df["macd"]   = ema_fast - ema_slow
    df["macd_signal"] = df["macd"].ewm(span=signal_period, adjust=False).mean()
    df["signal"] = 0
    df.loc[
        (df["macd"] > df["macd_signal"]) &
        (df["macd"].shift(1) <= df["macd_signal"].shift(1)),
        "signal"
    ] = 1
    df.loc[
        (df["macd"] < df["macd_signal"]) &
        (df["macd"].shift(1) >= df["macd_signal"].shift(1)),
        "signal"
    ] = -1
    return df

def strategy_bollinger(df: pd.DataFrame, period=20, std_dev=2.0) -> pd.DataFrame:
    """Buy below lower band, sell above upper band."""
    df = df.copy()
    df["bb_mid"]   = df["Close"].rolling(period).mean()
    df["bb_std"]   = df["Close"].rolling(period).std()
    df["bb_upper"] = df["bb_mid"] + std_dev * df["bb_std"]
    df["bb_lower"] = df["bb_mid"] - std_dev * df["bb_std"]
    df["signal"] = 0
    df.loc[df["Close"] < df["bb_lower"], "signal"] = 1
    df.loc[df["Close"] > df["bb_upper"], "signal"] = -1
    return df

STRATEGIES = {
    "sma":  strategy_sma_crossover,
    "rsi":  strategy_rsi,
    "macd": strategy_macd,
    "bb":   strategy_bollinger,
}

# ── Backtesting engine ────────────────────────────────────────────────────────

def run_backtest_engine(df: pd.DataFrame, initial_capital: float = 10000.0):
    """
    Event-driven backtester with:
    - Transaction costs (0.1% per trade)
    - Position sizing (100% of capital per trade)
    - Trade log
    """
    capital   = initial_capital
    position  = 0.0
    entry_px  = 0.0
    trades    = []
    equity    = []
    cost_pct  = 0.001  # 0.1% commission

    for i, row in df.iterrows():
        price = float(row["Close"])
        sig   = int(row["signal"])

        if sig == 1 and position == 0:
            shares    = (capital * (1 - cost_pct)) / price
            position  = shares
            entry_px  = price
            capital   = 0.0

        elif sig == -1 and position > 0:
            proceeds  = position * price * (1 - cost_pct)
            pnl_pct   = (price - entry_px) / entry_px * 100
            trades.append({
                "date":       str(i.date()),
                "entry":      round(entry_px, 2),
                "exit":       round(price, 2),
                "pnl_pct":    round(pnl_pct, 2),
                "win":        pnl_pct > 0,
            })
            capital   = proceeds
            position  = 0.0

        equity.append(capital + position * price)

    # Close open position at last price
    if position > 0:
        last_price = float(df["Close"].iloc[-1])
        capital    = position * last_price * (1 - cost_pct)
        equity[-1] = capital

    return equity, trades

def compute_metrics(equity: list, trades: list, risk_free: float = 0.05):
    """Compute Sharpe, Sortino, Max Drawdown, CAGR, Win Rate."""
    eq  = np.array(equity)
    ret = np.diff(eq) / eq[:-1]

    total_return = (eq[-1] - eq[0]) / eq[0] * 100
    n_days       = len(eq)
    cagr         = ((eq[-1] / eq[0]) ** (252 / max(n_days, 1)) - 1) * 100

    daily_rf  = risk_free / 252
    excess    = ret - daily_rf
    sharpe    = (excess.mean() / excess.std() * np.sqrt(252)) if excess.std() > 0 else 0

    downside = ret[ret < 0]
    sortino  = (excess.mean() / downside.std() * np.sqrt(252)) if len(downside) > 0 and downside.std() > 0 else 0

    peak   = np.maximum.accumulate(eq)
    dd     = (eq - peak) / peak * 100
    max_dd = float(dd.min())

    win_rate  = (sum(1 for t in trades if t["win"]) / len(trades) * 100) if trades else 0
    avg_win   = np.mean([t["pnl_pct"] for t in trades if t["win"]])  if any(t["win"] for t in trades) else 0
    avg_loss  = np.mean([t["pnl_pct"] for t in trades if not t["win"]]) if any(not t["win"] for t in trades) else 0

    return {
        "total_return": round(total_return, 2),
        "cagr":         round(cagr, 2),
        "sharpe":       round(sharpe, 2),
        "sortino":      round(sortino, 2),
        "max_dd":       round(max_dd, 2),
        "win_rate":     round(win_rate, 1),
        "n_trades":     len(trades),
        "avg_win":      round(avg_win, 2),
        "avg_loss":     round(avg_loss, 2),
        "profit_factor": round(-avg_win / avg_loss, 2) if avg_loss != 0 else 0,
        "final_equity": round(float(eq[-1]), 2),
    }

# ── API Routes ────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "AlgoTrader Pro API is running", "docs": "/docs"}

def generate_mock_data(symbol: str, days: int = 180):
    """Generate realistic mock OHLCV data for testing."""
    np.random.seed(hash(symbol) % 2**32)
    dates = pd.date_range(end=datetime.now(), periods=days, freq='D')
    
    # Start with a base price
    base_price = {"AAPL": 150, "TSLA": 250, "NVDA": 900, "MSFT": 380, "SPY": 450, "QQQ": 380}.get(symbol.upper(), 100)
    
    # Generate realistic price movement
    returns = np.random.normal(0.0005, 0.02, days)
    prices = base_price * np.exp(np.cumsum(returns))
    
    df = pd.DataFrame({
        "Open": prices * (1 + np.random.uniform(-0.01, 0.01, days)),
        "High": prices * (1 + np.random.uniform(0, 0.02, days)),
        "Low": prices * (1 + np.random.uniform(-0.02, 0, days)),
        "Close": prices,
        "Volume": np.random.randint(1000000, 100000000, days),
    }, index=dates)
    
    return df[["Open", "High", "Low", "Close", "Volume"]].dropna()

# ── API Routes ────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "AlgoTrader Pro API is running", "docs": "/docs"}

@app.get("/api/price/{symbol}")
def get_price_data(symbol: str, period: str = "6mo"):
    """Fetch OHLCV data from Yahoo Finance (FREE)."""
    valid_periods = ["1mo", "3mo", "6mo", "1y", "2y"]
    if period not in valid_periods:
        raise HTTPException(400, f"Period must be one of {valid_periods}")
    
    df = None
    try:
        ticker = yf.Ticker(symbol.upper())
        df     = ticker.history(period=period)
        if df.empty:
            raise Exception("No data from Yahoo Finance")
        df = df[["Open", "High", "Low", "Close", "Volume"]].dropna()
    except Exception as e:
        print(f"Yahoo Finance failed ({e}), using mock data for {symbol}")
        period_days = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730}
        df = generate_mock_data(symbol, period_days.get(period, 180))
    
    return {
        "symbol":  symbol.upper(),
        "period":  period,
        "dates":   [str(d.date()) for d in df.index],
        "open":    [round(v, 2) for v in df["Open"]],
        "high":    [round(v, 2) for v in df["High"]],
        "low":     [round(v, 2) for v in df["Low"]],
        "close":   [round(v, 2) for v in df["Close"]],
        "volume":  [int(v) for v in df["Volume"]],
    }

@app.get("/api/backtest/{symbol}")
def backtest(
    symbol:   str,
    strategy: str = Query("macd", enum=["sma", "rsi", "macd", "bb"]),
    period:   str = Query("6mo"),
    capital:  float = Query(10000.0),
    save:     bool  = Query(False),
):
    """Run backtest and return full results."""
    df = None
    try:
        ticker = yf.Ticker(symbol.upper())
        df     = ticker.history(period=period)
        if df.empty:
            raise Exception("No data from Yahoo Finance")
        df = df[["Open", "High", "Low", "Close", "Volume"]].dropna()
    except Exception as e:
        print(f"Yahoo Finance failed ({e}), using mock data for {symbol}")
        period_days = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730}
        df = generate_mock_data(symbol, period_days.get(period, 180))

    strat_fn = STRATEGIES.get(strategy)
    if not strat_fn:
        raise HTTPException(400, f"Unknown strategy: {strategy}")

    df_sig         = strat_fn(df)
    equity, trades = run_backtest_engine(df_sig, capital)
    m              = compute_metrics(equity, trades)

    # Buy & hold comparison
    bh_equity = [capital * (p / float(df["Close"].iloc[0])) for p in df["Close"]]

    # Drawdown series
    eq_arr = np.array(equity)
    peak   = np.maximum.accumulate(eq_arr)
    dd_arr = ((eq_arr - peak) / peak * 100).tolist()

    if save:
        conn = get_db()
        conn.execute(
            """INSERT INTO backtest_results
               (symbol, strategy, period, total_return, sharpe, max_dd, win_rate, n_trades)
               VALUES (?,?,?,?,?,?,?,?)""",
            (symbol.upper(), strategy, period,
             m["total_return"], m["sharpe"], m["max_dd"], m["win_rate"], m["n_trades"])
        )
        conn.commit()
        conn.close()

    return {
        "symbol":    symbol.upper(),
        "strategy":  strategy,
        "period":    period,
        "metrics":   m,
        "dates":     [str(d.date()) for d in df.index],
        "open":      [round(v, 2) for v in df["Open"]],
        "high":      [round(v, 2) for v in df["High"]],
        "low":       [round(v, 2) for v in df["Low"]],
        "close":     [round(v, 2) for v in df["Close"]],
        "equity":    [round(v, 2) for v in equity],
        "bh_equity": [round(v, 2) for v in bh_equity],
        "drawdown":  [round(v, 2) for v in dd_arr],
        "signals":   [int(v) for v in df_sig["signal"]],
        "trades":    trades[-50:],   # last 50 trades
    }

@app.get("/api/compare/{symbol}")
def compare_strategies(symbol: str, period: str = Query("6mo"), capital: float = Query(10000.0)):
    """Compare all 4 strategies on the same asset."""
    df = None
    try:
        ticker = yf.Ticker(symbol.upper())
        df     = ticker.history(period=period)
        if df.empty:
            raise Exception("No data from Yahoo Finance")
        df = df[["Open", "High", "Low", "Close", "Volume"]].dropna()
    except Exception as e:
        print(f"Yahoo Finance failed ({e}), using mock data for {symbol}")
        period_days = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730}
        df = generate_mock_data(symbol, period_days.get(period, 180))

    results = {}
    for name, fn in STRATEGIES.items():
        df_sig         = fn(df)
        equity, trades = run_backtest_engine(df_sig, capital)
        results[name]  = compute_metrics(equity, trades)

    return {"symbol": symbol.upper(), "period": period, "strategies": results}

@app.get("/api/history")
def get_backtest_history(limit: int = 20):
    """Get saved backtest results from the database."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM backtest_results ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return {"results": [dict(r) for r in rows]}

@app.post("/api/watchlist/{symbol}")
def add_to_watchlist(symbol: str):
    conn = get_db()
    try:
        conn.execute("INSERT OR IGNORE INTO watchlist (symbol) VALUES (?)", (symbol.upper(),))
        conn.commit()
    finally:
        conn.close()
    return {"message": f"{symbol.upper()} added to watchlist"}

@app.get("/api/watchlist")
def get_watchlist():
    conn = get_db()
    rows = conn.execute("SELECT * FROM watchlist ORDER BY added DESC").fetchall()
    conn.close()
    return {"watchlist": [dict(r) for r in rows]}
