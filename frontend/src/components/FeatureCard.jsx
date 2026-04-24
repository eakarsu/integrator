import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function FeatureCard({ featureKey, icon, title, description, count }) {
  const navigate = useNavigate();

  return (
    <div className="feature-card" onClick={() => navigate(`/${featureKey}`)}>
      <div className="feature-card-icon">{icon}</div>
      <div className="feature-card-content">
        <h3 className="feature-card-title">{title}</h3>
        <p className="feature-card-description">{description}</p>
      </div>
      {count !== undefined && count !== null && (
        <div className="feature-card-count">{count}</div>
      )}
      <div className="feature-card-arrow">→</div>
    </div>
  );
}
