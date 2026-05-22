import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from 'recharts';
import api from '../api/axios';

export default function ConnectionHealth() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/custom-views/health')
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message || 'Failed to load health data'));
  }, []);

  // Recharts wants rows-per-day, with one bar per integration.
  // Pivot the API series into that shape.
  let chartRows = [];
  let integrationKeys = [];
  if (data && data.series) {
    integrationKeys = data.series.map((s) => s.integrationId);
    const dates = data.series[0]?.days.map((d) => d.date) || [];
    chartRows = dates.map((date, i) => {
      const row = { date };
      data.series.forEach((s) => {
        row[s.integrationId] = s.days[i].uptime;
      });
      return row;
    });
  }

  // Distinct colors for each integration
  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#475569', '#d946ef', '#22d3ee'];

  return (
    <div data-testid="connection-health" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
      <h3 style={{ margin: '0 0 8px 0' }}>Connection Health — last 7 days (uptime %)</h3>
      {error && <div style={{ color: '#dc2626' }}>{error}</div>}
      {data && (
        <>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis domain={[80, 100]} fontSize={11} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {integrationKeys.map((k, i) => (
                  <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table style={{ width: '100%', marginTop: 12, fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: 4 }}>Integration</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #e2e8f0', padding: 4 }}>7-day Avg</th>
              </tr>
            </thead>
            <tbody>
              {data.series.map((s) => (
                <tr key={s.integrationId}>
                  <td style={{ padding: 4 }}>{s.label} <span style={{ color: '#64748b' }}>({s.integrationId})</span></td>
                  <td style={{ padding: 4, textAlign: 'right' }}>{s.average}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {!data && !error && <div>Loading...</div>}
    </div>
  );
}
