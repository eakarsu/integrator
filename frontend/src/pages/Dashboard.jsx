import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import FeatureCard from '../components/FeatureCard';
import featureConfig from '../api/featureConfig';
import api from '../api/axios';

export default function Dashboard() {
  const [counts, setCounts] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCounts = async () => {
      const entries = Object.entries(featureConfig);
      const results = {};
      await Promise.allSettled(
        entries.map(async ([key, config]) => {
          try {
            const res = await api.get(config.endpoint);
            const data = res.data;
            if (Array.isArray(data)) {
              results[key] = data.length;
            } else if (data && typeof data === 'object') {
              const arr = data.data || data.items || data.results || data[key];
              results[key] = Array.isArray(arr) ? arr.length : 0;
            }
          } catch {
            results[key] = null;
          }
        })
      );
      setCounts(results);
    };
    fetchCounts();
  }, []);

  return (
    <Layout>
      <div className="dashboard">
        <div className="dashboard-header">
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">Manage all your integrations in one place</p>
        </div>

        <div className="card-grid">
          {Object.entries(featureConfig).map(([key, config]) => (
            <FeatureCard
              key={key}
              featureKey={key}
              icon={config.icon}
              title={config.title}
              description={config.description}
              count={counts[key]}
            />
          ))}

          <div className="feature-card ai-card" onClick={() => navigate('/ai')}>
            <div className="feature-card-icon">🤖</div>
            <div className="feature-card-content">
              <h3 className="feature-card-title">AI Assistant</h3>
              <p className="feature-card-description">Generate mappings, analyze errors, and get suggestions</p>
            </div>
            <div className="feature-card-arrow">→</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
