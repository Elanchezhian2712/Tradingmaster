import React from "react";

export function NewsFeed({ symbol }: { symbol: string }) {
  const news = [
    {
      id: 1,
      title: `${symbol}: Indian markets rally as foreign institutional investors turn net buyers`,
      source: "Reuters",
      time: "12m ago",
      sentiment: "bullish",
    },
    {
      id: 2,
      title: "RBI keeps repo rate unchanged at 6.5%, maintains 'withdrawal of accommodation' stance",
      source: "Economic Times",
      time: "45m ago",
      sentiment: "neutral",
    },
    {
      id: 3,
      title: "Nifty hits record intraday high led by banking and tech momentum",
      source: "Bloomberg",
      time: "2h ago",
      sentiment: "bullish",
    },
    {
      id: 4,
      title: "Global markets digest Fed interest rate path and crude oil volatility",
      source: "CNBC",
      time: "4h ago",
      sentiment: "neutral",
    },
  ];

  return (
    <div className="tv-panel-content news-panel">
      <div className="tv-panel-header">
        <h4>Top Headlines ({symbol})</h4>
      </div>
      <div className="tv-news-list">
        {news.map((item) => (
          <div key={item.id} className="tv-news-card">
            <div className="tv-news-meta">
              <span className="tv-news-source">{item.source}</span>
              <span className="tv-news-time">{item.time}</span>
            </div>
            <div className="tv-news-title">{item.title}</div>
            <div className={`tv-news-badge ${item.sentiment}`}>{item.sentiment.toUpperCase()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
