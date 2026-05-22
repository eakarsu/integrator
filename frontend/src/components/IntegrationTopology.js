import React, { useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import api from '../api/axios';

const KIND_COLORS = {
  hub: '#7c3aed',
  crm: '#2563eb',
  payments: '#059669',
  ecommerce: '#d97706',
  erp: '#dc2626',
  messaging: '#0891b2',
  warehouse: '#1d4ed8',
  storage: '#475569',
  database: '#0f766e',
};

function layoutNodes(nodes) {
  // Place the "hub" at the centre, everything else around it on a circle.
  const hub = nodes.find((n) => n.kind === 'hub') || nodes[0];
  const peers = nodes.filter((n) => n.id !== hub.id);
  const radius = 240;
  const cx = 360;
  const cy = 240;
  const positioned = peers.map((n, i) => {
    const a = (2 * Math.PI * i) / peers.length;
    return {
      id: n.id,
      position: { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) },
      data: { label: `${n.name}\n(${n.kind})` },
      style: {
        background: KIND_COLORS[n.kind] || '#334155',
        color: 'white',
        border: '1px solid #1e293b',
        borderRadius: 8,
        padding: 8,
        fontSize: 12,
        whiteSpace: 'pre-line',
        textAlign: 'center',
      },
    };
  });
  positioned.unshift({
    id: hub.id,
    position: { x: cx, y: cy },
    data: { label: `${hub.name}\n(hub)` },
    style: {
      background: KIND_COLORS.hub,
      color: 'white',
      border: '2px solid #f5f3ff',
      borderRadius: '50%',
      padding: 16,
      fontSize: 13,
      whiteSpace: 'pre-line',
      textAlign: 'center',
    },
  });
  return positioned;
}

export default function IntegrationTopology() {
  const [topology, setTopology] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/custom-views/topology')
      .then((r) => setTopology(r.data))
      .catch((e) => setError(e.message || 'Failed to load topology'));
  }, []);

  const nodes = useMemo(() => (topology ? layoutNodes(topology.nodes) : []), [topology]);
  const edges = useMemo(
    () =>
      topology
        ? topology.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
            animated: e.active,
            style: { stroke: e.active ? '#10b981' : '#cbd5e1', strokeWidth: 2 },
            labelStyle: { fontSize: 10, fill: '#334155' },
          }))
        : [],
    [topology]
  );

  return (
    <div data-testid="integration-topology" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
      <h3 style={{ margin: '0 0 8px 0' }}>Integration Topology</h3>
      {error && <div style={{ color: '#dc2626' }}>{error}</div>}
      <div style={{ height: 480 }}>
        {topology && (
          <ReactFlow nodes={nodes} edges={edges} fitView>
            <Background />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        )}
        {!topology && !error && <div>Loading topology...</div>}
      </div>
    </div>
  );
}
