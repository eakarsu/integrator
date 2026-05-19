import React from 'react';
import Layout from '../components/Layout';
import IntegrationTopology from '../components/IntegrationTopology';
import ConnectionHealth from '../components/ConnectionHealth';
import NewIntegrationWizard from '../components/NewIntegrationWizard';
import FieldMappingEditor from '../components/FieldMappingEditor';

export default function CustomViewsPage() {
  return (
    <Layout>
      <div style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Integration Views</h2>
        <p style={{ color: '#475569', marginTop: 0 }}>
          Four integration-platform tools: topology graph, connection health, new-integration wizard, and field-mapping editor.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <IntegrationTopology />
          <ConnectionHealth />
          <NewIntegrationWizard />
          <FieldMappingEditor />
        </div>
      </div>
    </Layout>
  );
}
