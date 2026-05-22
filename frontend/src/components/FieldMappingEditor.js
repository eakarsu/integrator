import React, { useState } from 'react';
import api from '../api/axios';

const DEFAULT_SOURCE_FIELDS = ['account.id', 'account.name', 'account.email', 'account.phone', 'account.created_at'];
const DEFAULT_TARGET_FIELDS = ['contact_id', 'full_name', 'email_address', 'phone_number', 'created_on'];

export default function FieldMappingEditor() {
  const [sourceSystem, setSourceSystem] = useState('salesforce');
  const [targetSystem, setTargetSystem] = useState('hubspot');
  const [sourceFields] = useState(DEFAULT_SOURCE_FIELDS);
  const [targetFields] = useState(DEFAULT_TARGET_FIELDS);
  const [mapping, setMapping] = useState({}); // { targetField: sourceField }
  const [dragField, setDragField] = useState(null);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');

  const onDragStart = (field) => (e) => {
    setDragField(field);
    e.dataTransfer.setData('text/plain', field);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const onDrop = (target) => (e) => {
    e.preventDefault();
    const src = e.dataTransfer.getData('text/plain') || dragField;
    if (!src) return;
    setMapping((m) => ({ ...m, [target]: src }));
    setDragField(null);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const clearTarget = (target) => {
    setMapping((m) => {
      const next = { ...m };
      delete next[target];
      return next;
    });
  };

  const save = async () => {
    setError('');
    const pairs = Object.entries(mapping).map(([target, source]) => ({ source, target }));
    if (!pairs.length) {
      setError('Map at least one field before saving.');
      return;
    }
    try {
      const r = await api.post('/custom-views/mappings', { sourceSystem, targetSystem, pairs });
      setSaved(r.data.mapping);
    } catch (e) {
      setError(e.message || 'save failed');
    }
  };

  const mappingJson = JSON.stringify(
    { sourceSystem, targetSystem, pairs: Object.entries(mapping).map(([target, source]) => ({ source, target })) },
    null,
    2
  );

  return (
    <div data-testid="field-mapping-editor" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
      <h3 style={{ margin: '0 0 8px 0' }}>Field Mapping Editor</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, fontSize: 12 }}>
        <label>
          Source:{' '}
          <input value={sourceSystem} onChange={(e) => setSourceSystem(e.target.value)} style={{ padding: 4 }} />
        </label>
        <label>
          Target:{' '}
          <input value={targetSystem} onChange={(e) => setTargetSystem(e.target.value)} style={{ padding: 4 }} />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <h4 style={{ margin: '0 0 6px 0', fontSize: 13 }}>Source fields ({sourceSystem})</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {sourceFields.map((f) => (
              <li
                key={f}
                draggable
                onDragStart={onDragStart(f)}
                style={{
                  padding: 6,
                  marginBottom: 4,
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 4,
                  cursor: 'grab',
                  fontFamily: 'monospace',
                  fontSize: 12,
                }}
              >
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 style={{ margin: '0 0 6px 0', fontSize: 13 }}>Target fields ({targetSystem})</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {targetFields.map((f) => (
              <li
                key={f}
                onDrop={onDrop(f)}
                onDragOver={onDragOver}
                style={{
                  padding: 6,
                  marginBottom: 4,
                  background: mapping[f] ? '#dcfce7' : '#f1f5f9',
                  border: '1px dashed ' + (mapping[f] ? '#22c55e' : '#94a3b8'),
                  borderRadius: 4,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  {f}
                  {mapping[f] && <span style={{ color: '#475569' }}> ← {mapping[f]}</span>}
                </span>
                {mapping[f] && (
                  <button onClick={() => clearTarget(f)} style={{ fontSize: 10, padding: '2px 6px' }}>
                    clear
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={save} style={{ padding: '6px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4 }}>
          Save mapping
        </button>
        {error && <span style={{ color: '#dc2626', marginLeft: 8 }}>{error}</span>}
        {saved && <span style={{ color: '#059669', marginLeft: 8 }}>Saved as {saved.id}</span>}
      </div>

      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12 }}>Mapping JSON</summary>
        <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 8, borderRadius: 4, fontSize: 11, overflow: 'auto' }}>{mappingJson}</pre>
      </details>
    </div>
  );
}
