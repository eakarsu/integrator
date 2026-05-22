import React, { useEffect, useState } from 'react';
import api from '../api/axios';

const STEPS = ['Pick system', 'Enter credentials', 'Test connection', 'Enable'];

export default function NewIntegrationWizard() {
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState([]);
  const [systemId, setSystemId] = useState('');
  const [name, setName] = useState('');
  const [credentials, setCredentials] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [enabled, setEnabled] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/custom-views/wizard/catalog')
      .then((r) => setCatalog(r.data.systems || []))
      .catch((e) => setError(e.message || 'catalog load failed'));
  }, []);

  const selected = catalog.find((s) => s.id === systemId);

  const credFieldsFor = (sys) => {
    if (!sys) return [];
    if (sys.auth === 'oauth2') return ['clientId', 'clientSecret'];
    if (sys.auth === 'oauth1') return sys.fields || ['accountId', 'consumerKey', 'consumerSecret'];
    if (sys.auth === 'api_key') return sys.fields || ['apiKey'];
    if (sys.auth === 'basic') return sys.fields || ['username', 'password'];
    return ['token'];
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const runTest = async () => {
    setBusy(true);
    setError('');
    setTestResult(null);
    try {
      const r = await api.post('/custom-views/wizard/test', { systemId, credentials });
      setTestResult(r.data);
    } catch (e) {
      setError(e.message || 'test failed');
    } finally {
      setBusy(false);
    }
  };

  const enable = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/custom-views/wizard/enable', { systemId, name: name || selected?.name, credentials });
      setEnabled(r.data);
    } catch (e) {
      setError(e.message || 'enable failed');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep(0);
    setSystemId('');
    setName('');
    setCredentials({});
    setTestResult(null);
    setEnabled(null);
    setError('');
  };

  return (
    <div data-testid="new-integration-wizard" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
      <h3 style={{ margin: '0 0 8px 0' }}>New Integration Wizard</h3>

      {/* Stepper */}
      <ol style={{ display: 'flex', gap: 8, padding: 0, listStyle: 'none', marginBottom: 12, fontSize: 12 }}>
        {STEPS.map((label, i) => (
          <li
            key={label}
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: i === step ? '#2563eb' : i < step ? '#10b981' : '#e2e8f0',
              color: i <= step ? 'white' : '#475569',
            }}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {error && <div style={{ color: '#dc2626', marginBottom: 8 }}>{error}</div>}

      {step === 0 && (
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>System</label>
          <select
            value={systemId}
            onChange={(e) => {
              setSystemId(e.target.value);
              setCredentials({});
              setTestResult(null);
            }}
            style={{ padding: 6, width: '100%', marginBottom: 8 }}
          >
            <option value="">Select a system...</option>
            {catalog.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.auth})
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Integration name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: 6, width: '100%', marginBottom: 8 }}
          />
          <button disabled={!systemId} onClick={next} style={{ padding: '6px 12px' }}>
            Next
          </button>
        </div>
      )}

      {step === 1 && selected && (
        <div>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>
            Auth: <b>{selected.auth}</b>
          </div>
          {credFieldsFor(selected).map((f) => (
            <div key={f} style={{ marginBottom: 6 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#475569' }}>{f}</label>
              <input
                type={f.toLowerCase().includes('secret') || f.toLowerCase().includes('password') ? 'password' : 'text'}
                value={credentials[f] || ''}
                onChange={(e) => setCredentials({ ...credentials, [f]: e.target.value })}
                style={{ padding: 6, width: '100%' }}
              />
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <button onClick={back} style={{ padding: '6px 12px', marginRight: 8 }}>
              Back
            </button>
            <button onClick={next} style={{ padding: '6px 12px' }}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <button onClick={runTest} disabled={busy} style={{ padding: '6px 12px' }}>
            {busy ? 'Testing...' : 'Test connection'}
          </button>
          {testResult && (
            <div style={{ marginTop: 8, padding: 8, background: testResult.ok ? '#dcfce7' : '#fee2e2', borderRadius: 4 }}>
              {testResult.ok ? `OK — ${testResult.message} (latency ${testResult.latencyMs}ms)` : `Failed — ${testResult.message}`}
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <button onClick={back} style={{ padding: '6px 12px', marginRight: 8 }}>
              Back
            </button>
            <button onClick={next} disabled={!testResult?.ok} style={{ padding: '6px 12px' }}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          {!enabled ? (
            <button onClick={enable} disabled={busy} style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: 4 }}>
              {busy ? 'Enabling...' : 'Enable integration'}
            </button>
          ) : (
            <div style={{ padding: 8, background: '#dcfce7', borderRadius: 4 }}>
              Enabled <b>{enabled.integration.name}</b> ({enabled.integration.systemId}) — id {enabled.integration.id}
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <button onClick={back} style={{ padding: '6px 12px', marginRight: 8 }}>
              Back
            </button>
            <button onClick={reset} style={{ padding: '6px 12px' }}>
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
