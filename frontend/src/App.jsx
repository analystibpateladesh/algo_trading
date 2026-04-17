import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from "recharts";

const API = "/api";

const ASSETS = ["AAPL", "TSLA", "NVDA", "MSFT", "SPY", "QQQ", "AMZN", "GOOGL", "BTC-USD", "ETH-USD"];
const STRATEGIES = {
  sma:  "SMA Crossover",
  rsi:  "RSI Mean Revesrsion",
  macd: "MACD Momentum",
  bb:   "Bollinger Bands",
};
const PERIODS = { "1mo": "1 month", "3mo": "3 months", "6mo": "6 months", "1y": "1 year", "2y": "2 years" };

const CHART_OPTIONS = [
  { id: 1, label: "Price" },
  { id: 2, label: "Equity" },
  { id: 3, label: "Buy & Hold" },
  { id: 4, label: "Drawdown" },
  { id: 5, label: "Signals" },
  { id: 6, label: "Returns" },
  { id: 7, label: "Candlestick" },
];

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, positive }) {
  const color =
    positive === true  ? "#1D9E75" :
    positive === false ? "#E24B4A" : "inherit";
  return (
    <div style={{
      background: "#0c1725", borderRadius: 12, padding: "14px 16px",
      minWidth: 0, border: "1px solid #1f2937",
      boxShadow: "none",
    }}>
      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#f8fafc" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ── Strategy badge ────────────────────────────────────────────────────────────
function StratBadge({ name }) {
  const colors = {
    sma:  { bg: "#E6F1FB", color: "#0C447C" },
    rsi:  { bg: "#EAF3DE", color: "#27500A" },
    macd: { bg: "#EEEDFE", color: "#3C3489" },
    bb:   { bg: "#FAEEDA", color: "#633806" },
  };
  const c = colors[name] || { bg: "#f0f0f0", color: "#333" };
  return (
    <span style={{
      background: c.bg, color: c.color,
      fontSize: 11, fontWeight: 500,
      padding: "2px 8px", borderRadius: 20,
    }}>
      {STRATEGIES[name]}
    </span>
  );
}

// ── Loading spinner ───────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ textAlign: "center", padding: "3rem", color: "#aaa", fontSize: 14 }}>
      Loading data...
    </div>
  );
}

// ── Tooltip for charts ────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff", border: "0.5px solid #e0e0e0",
      borderRadius: 8, padding: "8px 12px", fontSize: 12,
    }}>
      <div style={{ color: "#888", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 500 }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
        </div>
      ))}
    </div>
  );
};

function SignalDot({ cx, cy, payload }) {
  if (!payload || payload.signal === 0) return null;
  const isBuy = payload.signal === 1;
  const size = 6;
  if (isBuy) {
    const points = [
      [cx, cy - size],
      [cx + size, cy],
      [cx, cy + size],
      [cx - size, cy],
    ].map(point => point.join(",")).join(" ");
    return <polygon points={points} fill="#22c55e" stroke="#fff" strokeWidth={1} />;
  }
  const points = [
    [cx - size, cy - size],
    [cx + size, cy - size],
    [cx, cy + size],
  ].map(point => point.join(",")).join(" ");
  return <polygon points={points} fill="#ef4444" stroke="#fff" strokeWidth={1} />;
}

function CandleChart({ data }) {
  const [hovered, setHovered] = useState(null);
  if (!data || !data.length) return null;
  const width = 960;
  const height = 260;
  const margin = { top: 20, right: 18, bottom: 26, left: 42 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const values = data.flatMap(d => [d.high, d.low, d.open, d.close]);
  const minPrice = Math.min(...values);
  const maxPrice = Math.max(...values);
  const yScale = price => margin.top + plotHeight * (1 - (price - minPrice) / Math.max(1, maxPrice - minPrice));
  const xStep = plotWidth / Math.max(1, data.length - 1);
  const candleWidth = Math.max(2, Math.min(12, xStep * 0.7));

  const ticks = data.map((d, idx) => ({
    x: margin.left + idx * xStep,
    label: d.date,
    show: idx % Math.max(1, Math.round(data.length / 10)) === 0,
  }));

  return (
    <div style={{ width: "100%", overflowX: "auto", position: "relative" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: height }}>
        <rect x={0} y={0} width={width} height={height} fill="#0f172a" />
        {ticks.map(t => t.show && (
          <g key={t.x}>
            <line x1={t.x} y1={height - margin.bottom} x2={t.x} y2={height - margin.bottom + 6} stroke="#475569" />
            <text x={t.x} y={height - 4} textAnchor="middle" fontSize="10" fill="#94a3b8">{t.label}</text>
          </g>
        ))}
        {data.map((d, idx) => {
          const x = margin.left + idx * xStep;
          const yHigh = yScale(d.high);
          const yLow = yScale(d.low);
          const yOpen = yScale(d.open);
          const yClose = yScale(d.close);
          const candleTop = Math.min(yOpen, yClose);
          const candleBottom = Math.max(yOpen, yClose);
          const candleColor = d.close >= d.open ? "#22c55e" : "#ef4444";
          return (
            <g
              key={d.date}
              onMouseEnter={() => setHovered(d)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={candleColor} strokeWidth={1} />
              <rect
                x={x - candleWidth / 2}
                y={candleTop}
                width={candleWidth}
                height={Math.max(1, candleBottom - candleTop)}
                fill={candleColor}
                opacity={0.85}
              />
            </g>
          );
        })}
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotHeight} stroke="#1f2937" />
        <line x1={margin.left} y1={margin.top + plotHeight} x2={width - margin.right} y2={margin.top + plotHeight} stroke="#1f2937" />
        <text x={margin.left} y={margin.top - 2} fill="#94a3b8" fontSize="11">{`High: ${maxPrice.toFixed(2)}`}</text>
        <text x={width - margin.right} y={margin.top - 2} textAnchor="end" fill="#94a3b8" fontSize="11">{`Low: ${minPrice.toFixed(2)}`}</text>
      </svg>
      {hovered && (
        <div style={{
          position: "absolute", top: 14, right: 14,
          background: "rgba(3, 7, 18, 0.96)", border: "1px solid #334155",
          borderRadius: 12, padding: "10px 12px", color: "#f8fafc",
          fontSize: 12, minWidth: 160, boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
        }}>
          <div style={{ color: "#94a3b8", marginBottom: 6, fontSize: 11 }}>{hovered.date}</div>
          <div style={{ display: "grid", gap: 4 }}>
            <div><strong>Open:</strong> {hovered.open.toFixed(2)}</div>
            <div><strong>High:</strong> {hovered.high.toFixed(2)}</div>
            <div><strong>Low:</strong> {hovered.low.toFixed(2)}</div>
            <div><strong>Close:</strong> {hovered.close.toFixed(2)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [symbol,   setSymbol]   = useState("NVDA");
  const [strategy, setStrategy] = useState("macd");
  const [period,   setPeriod]   = useState("6mo");
  const [capital,  setCapital]  = useState(10000);
  const [chartMode, setChartMode] = useState(1);
  const [data,     setData]     = useState(null);
  const [compare,  setCompare]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [tab,      setTab]      = useState("backtest"); // backtest | compare | history
  const [history,  setHistory]  = useState([]);
  const [error,    setError]    = useState("");

  const runBacktest = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = `${API}/backtest/${symbol}?strategy=${strategy}&period=${period}&capital=${capital}&save=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError("Could not reach backend. Make sure FastAPI is running on port 8000.");
    }
    setLoading(false);
  }, [symbol, strategy, period, capital]);

  const runCompare = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/compare/${symbol}?period=${period}&capital=${capital}`);
      if (!res.ok) throw new Error(await res.text());
      setCompare(await res.json());
    } catch (e) {
      setError("Could not reach backend.");
    }
    setLoading(false);
  }, [symbol, period, capital]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API}/history`);
      setHistory((await res.json()).results || []);
    } catch {}
  }, []);

  useEffect(() => { runBacktest(); }, []);

  useEffect(() => {
    if (tab === "history") loadHistory();
    if (tab === "compare") runCompare();
  }, [tab]);

  // Build chart data
  const chartData = data
    ? data.dates.map((d, i) => ({
        date:     d.slice(5),   // MM-DD
        open:     data.open[i],
        high:     data.high[i],
        low:      data.low[i],
        close:    data.close[i],
        price:    data.close[i],
        strategy: parseFloat((data.equity[i] / capital * 100 - 100).toFixed(2)),
        buyhold:  parseFloat((data.bh_equity[i] / capital * 100 - 100).toFixed(2)),
        drawdown: data.drawdown[i],
        signal:   data.signals[i],
      }))
    : [];

  const returns = data
    ? data.equity.slice(1).map((value, index) =>
        parseFloat(((value / data.equity[index] - 1) * 100).toFixed(2))
      )
    : [];

  const signalData = chartData.filter(item => item.signal !== 0);
  const distributionData = [];
  if (returns.length > 0) {
    const boundaries = [-5, -3, -1, -0.5, 0, 0.5, 1, 2, 3, 5, 10];
    const bins = boundaries.map((boundary, idx) => ({
      label: idx === 0
        ? `< ${boundary}%`
        : idx === boundaries.length - 1
          ? `>= ${boundary}%`
          : `${boundaries[idx - 1]} to ${boundary}%`,
      count: 0,
    }));

    returns.forEach(r => {
      const idx = boundaries.findIndex(boundary => r < boundary);
      const bucketIndex = idx === -1 ? boundaries.length - 1 : idx;
      bins[bucketIndex].count += 1;
    });

    distributionData.push(...bins);
  }

  const signalCount = data ? data.signals.filter(s => s !== 0).length : 0;
  const buySignalCount = data ? data.signals.filter(s => s === 1).length : 0;
  const sellSignalCount = data ? data.signals.filter(s => s === -1).length : 0;
  const avgTradeDuration = data && data.trades.length ? Math.round(data.dates.length / data.trades.length) : 0;
  const tradeFrequency = data && data.dates.length ? Math.max(0, Math.round((data.trades.length / data.dates.length) * 30)) : 0;

  const inputStyle = {
    fontSize: 13,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#f8fafc",
    cursor: "pointer",
    outline: "none",
    minHeight: 38,
    boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.4)",
  };

  const chartLinkStyle = (active) => ({
    background: "transparent",
    border: "none",
    color: active ? "#f8fafc" : "#94a3b8",
    borderBottom: active ? "2px solid #22c55e" : "1px solid transparent",
    padding: "6px 0",
    cursor: "pointer",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 600,
  });

  const btnStyle = (active) => ({
    padding: "9px 16px",
    borderRadius: 8,
    border: active ? "1px solid #22c55e" : "1px solid #334155",
    background: active ? "#111827" : "#0f172a",
    color: active ? "#22c55e" : "#cbd5e1",
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.2,
    cursor: "pointer",
    minHeight: 38,
    transition: "all 120ms ease",
    boxShadow: "none",
  });

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", width: "100%", maxWidth: "100%", margin: "0 auto", padding: "1.5rem 1rem", background: "#050b18", minHeight: "100vh", color: "#cbd5e1", boxSizing: "border-box" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#22c55e" }} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc" }}>AlgoTrader Pro</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Live strategy dashboard</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["backtest", "compare", "history"].map(t => (
            <button key={t} style={btnStyle(tab === t)} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
        marginBottom: "1.5rem", padding: "18px 20px",
        background: "#0b1526", borderRadius: 14,
        border: "1px solid #1f2937",
      }}>
        <select value={symbol} onChange={e => setSymbol(e.target.value)} style={inputStyle}>
          {ASSETS.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={strategy} onChange={e => setStrategy(e.target.value)} style={inputStyle}>
          {Object.entries(STRATEGIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={period} onChange={e => setPeriod(e.target.value)} style={inputStyle}>
          {Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input
          type="number" value={capital} min={1000} step={1000}
          onChange={e => setCapital(Number(e.target.value))}
          style={{ ...inputStyle, width: 120 }}
          placeholder="Capital ($)"
        />
        <button
          onClick={tab === "compare" ? runCompare : runBacktest}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: loading ? "1px solid #22c55e" : "1px solid #fff",
            background: loading ? "#22c55e" : "#030712",
            color: loading ? "#030712" : "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            minHeight: 40,
            transition: "background 120ms ease, color 120ms ease, border 120ms ease",
          }}
        >
          {loading ? "Running..." : "Run backtest"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#2c1f24", color: "#fda4af", border: "1px solid #7f1d1d", padding: "10px 14px", borderRadius: 10, marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Backtest Tab ── */}
      {tab === "backtest" && (
        <>
          {loading ? <Spinner /> : data && (
            <>
              {/* Metric grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, marginBottom: "1.25rem" }}>
                <MetricCard label="Total return"  value={`${data.metrics.total_return > 0 ? "+" : ""}${data.metrics.total_return}%`} positive={data.metrics.total_return > 0} sub={`CAGR ${data.metrics.cagr}%`} />
                <MetricCard label="Sharpe ratio"  value={data.metrics.sharpe} sub="Annualised" />
                <MetricCard label="Max drawdown"  value={`${data.metrics.max_dd}%`} positive={false} sub="Worst peak→trough" />
                <MetricCard label="Win rate"      value={`${data.metrics.win_rate}%`} positive={data.metrics.win_rate >= 50} sub={`${data.metrics.n_trades} trades`} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, marginBottom: "1.5rem" }}>
                <MetricCard label="Sortino ratio"  value={data.metrics.sortino} />
                <MetricCard label="Profit factor"  value={data.metrics.profit_factor} positive={data.metrics.profit_factor >= 1} />
                <MetricCard label="Avg win"        value={`+${data.metrics.avg_win}%`} positive />
                <MetricCard label="Avg loss"       value={`${data.metrics.avg_loss}%`} positive={false} />
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: "1rem" }}>
                {CHART_OPTIONS.map(opt => (
                  <button key={opt.id} style={chartLinkStyle(chartMode === opt.id)} onClick={() => setChartMode(opt.id)}>
                    {opt.label}
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: 12, padding: "1rem" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", marginBottom: 10 }}>
                    {data.symbol} — {chartMode === 1 ? `price & ${STRATEGIES[strategy]} signals` : CHART_OPTIONS.find(opt => opt.id === chartMode)?.label + " chart"}
                  </div>
                  {chartMode === 1 && (
                    <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 10, color: "#94a3b8", fontSize: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 14, height: 2, background: "#378ADD", borderRadius: 2, display: "inline-block" }} />
                        price
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, background: "#22c55e", transform: "rotate(45deg)", display: "inline-block" }} />
                        buy
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, background: "#ef4444", clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)", display: "inline-block" }} />
                        sell
                      </div>
                    </div>
                  )}
                  {chartMode === 7 ? (
                    <CandleChart data={chartData} />
                  ) : chartMode === 4 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#aaa" }} interval={Math.floor(chartData.length / 7)} />
                        <YAxis tick={{ fontSize: 11, fill: "#aaa" }} tickFormatter={v => `${v}%`} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="drawdown" stroke="#A855F7" fill="#7C3AED" fillOpacity={0.16} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : chartMode === 5 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#aaa" }} interval={Math.floor(chartData.length / 8)} />
                        <YAxis tick={{ fontSize: 11, fill: "#aaa" }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="signal" fill="#22c55e" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : chartMode === 6 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={distributionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#aaa" }} interval={0} angle={-35} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11, fill: "#aaa" }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="count" fill="#8b5cf6" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : chartMode === 2 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#aaa" }} interval={Math.floor(chartData.length / 7)} />
                        <YAxis tick={{ fontSize: 11, fill: "#aaa" }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="strategy" stroke="#22c55e" dot={false} strokeWidth={1.5} name="Strategy %" />
                        <Line type="monotone" dataKey="buyhold" stroke="#888780" dot={false} strokeWidth={1.5} name="Buy & Hold %" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : chartMode === 3 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#aaa" }} interval={Math.floor(chartData.length / 7)} />
                        <YAxis tick={{ fontSize: 11, fill: "#aaa" }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="strategy" stroke="#38bdf8" dot={false} strokeWidth={1.5} name="Strategy %" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#aaa" }} interval={Math.floor(chartData.length / 7)} />
                        <YAxis tick={{ fontSize: 11, fill: "#aaa" }} tickFormatter={v => `$${v}`} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="price"
                          stroke="#378ADD"
                          dot={props => <SignalDot {...props} />}
                          strokeWidth={1.5}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>Strategy: <strong style={{ color: "#f8fafc" }}>{STRATEGIES[strategy]}</strong></span>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>Signal days: <strong style={{ color: "#22c55e" }}>{signalCount}</strong></span>
                  </div>
                </div>
                <div style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: 12, padding: "1rem" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", marginBottom: 12 }}>Algorithmic trading insights</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#f8fafc", fontSize: 13 }}>
                      <span>Total signals</span><strong>{signalCount}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#f8fafc", fontSize: 13 }}>
                      <span>Buy signals</span><strong>{buySignalCount}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#f8fafc", fontSize: 13 }}>
                      <span>Sell signals</span><strong>{sellSignalCount}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#f8fafc", fontSize: 13 }}>
                      <span>Avg trade duration</span><strong>{avgTradeDuration} days</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#f8fafc", fontSize: 13 }}>
                      <span>Trade frequency</span><strong>{tradeFrequency} / month</strong>
                    </div>
                    <div style={{ padding: "12px", border: "1px solid #1f2937", borderRadius: 10, background: "#07101f" }}>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Algorithmic trading features</div>
                      <ul style={{ margin: 0, paddingLeft: 18, color: "#cbd5e1", fontSize: 12, lineHeight: 1.7 }}>
                        <li>Automated entry/exit signal generation</li>
                        <li>Risk-aware performance metrics</li>
                        <li>Multi-strategy comparison</li>
                        <li>Adaptive capital allocation</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* P&L comparison + Drawdown */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: 12, padding: "1rem" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", marginBottom: 8 }}>Cumulative P&L vs Buy &amp; Hold (%)</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#aaa" }} interval={Math.floor(chartData.length / 5)} />
                      <YAxis tick={{ fontSize: 10, fill: "#aaa" }} tickFormatter={v => `${v}%`} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={0} stroke="#ddd" />
                      <Line type="monotone" dataKey="strategy" stroke="#378ADD" dot={false} strokeWidth={1.5} name="Strategy %" />
                      <Line type="monotone" dataKey="buyhold"  stroke="#888780" dot={false} strokeWidth={1.5} strokeDasharray="4 3" name="Buy & Hold %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: 12, padding: "1rem" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", marginBottom: 8 }}>Drawdown curve (%)</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#E24B4A" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#E24B4A" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#aaa" }} interval={Math.floor(chartData.length / 5)} />
                      <YAxis tick={{ fontSize: 10, fill: "#aaa" }} tickFormatter={v => `${v}%`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="drawdown" stroke="#E24B4A" fill="url(#ddGrad)" strokeWidth={1.5} name="Drawdown %" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: 12, padding: "1rem", marginBottom: "1rem" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", marginBottom: 8 }}>Daily return distribution (%)</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={distributionData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#aaa" }} interval={0} angle={-35} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 10, fill: "#aaa" }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" fill="#22c55e" name="Days" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Trades table */}
              <div style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: 12, padding: "1rem" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", marginBottom: 10 }}>Recent trades</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>{["Date", "Entry ($)", "Exit ($)", "P&L", "Result"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "6px 10px", color: "#94a3b8", fontWeight: 500, borderBottom: "0.5px solid #1f2937" }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {data.trades.slice().reverse().map((t, i) => (
                        <tr key={i}>
                          <td style={{ padding: "6px 10px", borderBottom: "0.5px solid #1f2937" }}>{t.date}</td>
                          <td style={{ padding: "6px 10px", borderBottom: "0.5px solid #1f2937" }}>${t.entry}</td>
                          <td style={{ padding: "6px 10px", borderBottom: "0.5px solid #1f2937" }}>${t.exit}</td>
                          <td style={{ padding: "6px 10px", borderBottom: "0.5px solid #1f2937", color: t.pnl_pct > 0 ? "#22c55e" : "#f97316", fontWeight: 500 }}>
                            {t.pnl_pct > 0 ? "+" : ""}{t.pnl_pct}%
                          </td>
                          <td style={{ padding: "6px 10px", borderBottom: "0.5px solid #1f2937" }}>
                            <span style={{
                              background: t.win ? "rgba(34, 197, 94, 0.16)" : "rgba(245, 71, 79, 0.16)",
                              color:      t.win ? "#22c55e" : "#f97316",
                              fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999,
                            }}>{t.win ? "WIN" : "LOSS"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Compare Tab ── */}
      {tab === "compare" && (
        <>
          {loading ? <Spinner /> : compare && (
            <>
              <div style={{ marginBottom: 12, fontSize: 13, color: "#888" }}>
                All 4 strategies on {compare.symbol} · {PERIODS[period]}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
                {Object.entries(compare.strategies).map(([name, m]) => (
                  <div key={name} style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: 12, padding: "1rem" }}>
                    <div style={{ marginBottom: 10 }}><StratBadge name={name} /></div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <MetricCard label="Return"   value={`${m.total_return > 0 ? "+" : ""}${m.total_return}%`} positive={m.total_return > 0} />
                      <MetricCard label="Sharpe"   value={m.sharpe} />
                      <MetricCard label="Max DD"   value={`${m.max_dd}%`} positive={false} />
                      <MetricCard label="Win rate" value={`${m.win_rate}%`} positive={m.win_rate >= 50} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── History Tab ── */}
      {tab === "history" && (
        <div style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: 12, padding: "1rem" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", marginBottom: 10 }}>Saved backtest results</div>
          {history.length === 0 ? (
            <p style={{ fontSize: 13, color: "#aaa" }}>No saved runs yet. Run a backtest — results save automatically.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>{["Symbol", "Strategy", "Period", "Return", "Sharpe", "Max DD", "Win rate", "Date"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 10px", color: "#94a3b8", fontWeight: 500, borderBottom: "0.5px solid #1f2937" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {history.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: "6px 10px", borderBottom: "0.5px solid #1f2937", fontWeight: 500 }}>{r.symbol}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "0.5px solid #1f2937" }}><StratBadge name={r.strategy} /></td>
                      <td style={{ padding: "6px 10px", borderBottom: "0.5px solid #1f2937" }}>{r.period}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "0.5px solid #1f2937", color: r.total_return > 0 ? "#22c55e" : "#f97316", fontWeight: 500 }}>{r.total_return > 0 ? "+" : ""}{r.total_return}%</td>
                      <td style={{ padding: "6px 10px", borderBottom: "0.5px solid #1f2937", color: "#f8fafc" }}>{r.sharpe}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "0.5px solid #1f2937", color: "#f97316" }}>{r.max_dd}%</td>
                      <td style={{ padding: "6px 10px", borderBottom: "0.5px solid #1f2937", color: "#f8fafc" }}>{r.win_rate}%</td>
                      <td style={{ padding: "6px 10px", borderBottom: "0.5px solid #1f2937", color: "#94a3b8" }}>{r.created_at?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
