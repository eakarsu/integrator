import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const emptyConnection = { name: '', baseUrl: '', authMode: 'none', bearerToken: '', apiKey: '', apiKeyHeader: 'X-API-Key' };
const emptyWorkflow = { name: '', description: '', connectionId: '', path: '/', method: 'POST' };

function Status({ value }) {
  return <span className={`status-pill status-${value}`}>{value.replace('_', ' ')}</span>;
}

function readableError(error) {
  return error.response?.data?.error || error.message || 'Request failed';
}

export default function Dashboard() {
  const { user } = useAuth();
  const [connections, setConnections] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [runs, setRuns] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState('');
  const [connectionForm, setConnectionForm] = useState(emptyConnection);
  const [workflowForm, setWorkflowForm] = useState(emptyWorkflow);
  const [editingWorkflowId, setEditingWorkflowId] = useState('');
  const [runInput, setRunInput] = useState('{"customerId":"example"}');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const refresh = useCallback(async () => {
    const [connectionsResponse, workflowsResponse] = await Promise.all([
      api.get('/connections'),
      api.get('/workflows'),
    ]);
    setConnections(connectionsResponse.data);
    setWorkflows(workflowsResponse.data);
    if (!selectedWorkflow && workflowsResponse.data[0]) setSelectedWorkflow(workflowsResponse.data[0].id);
  }, [selectedWorkflow]);

  const refreshRuns = useCallback(async () => {
    if (!selectedWorkflow) return setRuns([]);
    const response = await api.get(`/workflows/${selectedWorkflow}/runs`);
    setRuns(response.data);
  }, [selectedWorkflow]);

  useEffect(() => {
    refresh().catch((error) => setNotice({ type: 'error', text: readableError(error) }));
  }, [refresh]);

  useEffect(() => {
    refreshRuns().catch((error) => setNotice({ type: 'error', text: readableError(error) }));
  }, [refreshRuns]);

  const selected = useMemo(
    () => workflows.find((workflow) => workflow.id === selectedWorkflow),
    [selectedWorkflow, workflows],
  );
  const canEdit = user?.role === 'admin' || user?.role === 'editor';

  async function perform(action, successText) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      await refresh();
      await refreshRuns();
      setNotice({ type: 'success', text: successText });
    } catch (error) {
      setNotice({ type: 'error', text: readableError(error) });
    } finally {
      setBusy(false);
    }
  }

  function createConnection(event) {
    event.preventDefault();
    perform(async () => {
      let credentials = {};
      if (connectionForm.authMode === 'bearer') credentials = { bearerToken: connectionForm.bearerToken };
      if (connectionForm.authMode === 'apiKey') credentials = {
        apiKey: connectionForm.apiKey,
        apiKeyHeader: connectionForm.apiKeyHeader,
      };
      await api.post('/connections', {
        name: connectionForm.name,
        baseUrl: connectionForm.baseUrl,
        connectorType: 'http',
        credentials,
      });
      setConnectionForm(emptyConnection);
    }, 'Connection saved.');
  }

  function createWorkflow(event) {
    event.preventDefault();
    perform(async () => {
      const payload = {
        name: workflowForm.name,
        description: workflowForm.description,
        maxAttempts: 3,
        retryDelayMs: 1000,
        definition: {
          steps: [{
            name: 'Deliver payload',
            connectionId: workflowForm.connectionId,
            method: workflowForm.method,
            path: workflowForm.path,
          }],
        },
      };
      const response = editingWorkflowId
        ? await api.put(`/workflows/${editingWorkflowId}`, payload)
        : await api.post('/workflows', payload);
      setSelectedWorkflow(response.data.id);
      setWorkflowForm(emptyWorkflow);
      setEditingWorkflowId('');
    }, editingWorkflowId ? 'Workflow revision saved.' : 'Draft workflow created. Activate it when the configuration is ready.');
  }

  function beginEdit(workflow) {
    if (workflow.definition.steps.length !== 1) {
      setNotice({ type: 'error', text: 'This browser editor supports one-step workflows; use the versioned API for multi-step revisions.' });
      return;
    }
    const step = workflow.definition.steps[0];
    setWorkflowForm({
      name: workflow.name,
      description: workflow.description,
      connectionId: step.connectionId,
      path: step.path,
      method: step.method,
    });
    setEditingWorkflowId(workflow.id);
    window.scrollTo({ top: 350, behavior: 'smooth' });
  }

  function changeState(workflow, status) {
    perform(() => api.post(`/workflows/${workflow.id}/state`, { status }), `Workflow moved to ${status}.`);
  }

  function queueRun(event) {
    event.preventDefault();
    perform(async () => {
      let input;
      try {
        input = JSON.parse(runInput);
      } catch {
        throw new Error('Run input must be valid JSON.');
      }
      await api.post(`/workflows/${selectedWorkflow}/runs`, { input }, {
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
    }, 'Run queued. The worker will claim it once.');
  }

  function runAction(run, action) {
    perform(
      () => api.post(`/workflows/runs/${run.id}/${action}`),
      action === 'retry' ? 'Dead-letter run queued with the current workflow revision.' : 'Queued run cancelled.',
    );
  }

  return (
    <Layout>
      <div className="operations-shell">
        <section className="operations-heading">
          <div>
            <p className="eyebrow">Integration operations</p>
            <h2>Build, activate, and observe durable data flows</h2>
            <p>Every run is idempotent, tenant-scoped, retried with a lease, and recorded in an immutable audit chain.</p>
          </div>
          <button className="btn btn-secondary" disabled={busy} onClick={() => perform(refresh, 'Data refreshed.')}>Refresh</button>
        </section>

        {notice && <div className={`notice notice-${notice.type}`}>{notice.text}</div>}

        <section className="metric-row">
          <article><strong>{connections.length}</strong><span>Connections</span></article>
          <article><strong>{workflows.filter((item) => item.status === 'active').length}</strong><span>Active workflows</span></article>
          <article><strong>{runs.filter((item) => item.status === 'dead_letter').length}</strong><span>Dead letters</span></article>
        </section>

        <div className="operations-grid">
          <section className="ops-panel">
            <div className="panel-heading"><div><span>01</span><h3>Connections</h3></div><p>Approved HTTP origins; credentials are encrypted by the API.</p></div>
            {canEdit ? <form className="compact-form" onSubmit={createConnection}>
              <label>Name<input required maxLength="120" value={connectionForm.name} onChange={(event) => setConnectionForm({ ...connectionForm, name: event.target.value })} placeholder="Order service" /></label>
              <label>Base URL<input required type="url" value={connectionForm.baseUrl} onChange={(event) => setConnectionForm({ ...connectionForm, baseUrl: event.target.value })} placeholder="https://api.example.com" /></label>
              <label>Authentication<select value={connectionForm.authMode} onChange={(event) => setConnectionForm({ ...connectionForm, authMode: event.target.value })}><option value="none">None</option><option value="bearer">Bearer token</option><option value="apiKey">API key</option></select></label>
              {connectionForm.authMode === 'bearer' && <label>Bearer token<input required type="password" autoComplete="off" value={connectionForm.bearerToken} onChange={(event) => setConnectionForm({ ...connectionForm, bearerToken: event.target.value })} /></label>}
              {connectionForm.authMode === 'apiKey' && <div className="inline-fields"><label>Header<input required value={connectionForm.apiKeyHeader} onChange={(event) => setConnectionForm({ ...connectionForm, apiKeyHeader: event.target.value })} /></label><label>API key<input required type="password" autoComplete="off" value={connectionForm.apiKey} onChange={(event) => setConnectionForm({ ...connectionForm, apiKey: event.target.value })} /></label></div>}
              <button className="btn btn-primary" disabled={busy}>Add connection</button>
            </form> : <p className="empty-copy">Viewer access is read-only.</p>}
            <div className="resource-list">
              {connections.map((connection) => (
                <article key={connection.id}>
                  <div><strong>{connection.name}</strong><code>{connection.baseUrl} · {connection.credentialsConfigured ? 'credentials encrypted' : 'no credentials'}</code></div>
                  <Status value={connection.status} />
                </article>
              ))}
              {!connections.length && <p className="empty-copy">Create the first approved destination before defining a workflow.</p>}
            </div>
          </section>

          <section className="ops-panel">
            <div className="panel-heading"><div><span>02</span><h3>{editingWorkflowId ? 'Workflow revision' : 'Workflow draft'}</h3></div><p>Define a concrete outbound delivery step.</p></div>
            {canEdit ? <form className="compact-form" onSubmit={createWorkflow}>
              <label>Name<input required maxLength="120" value={workflowForm.name} onChange={(event) => setWorkflowForm({ ...workflowForm, name: event.target.value })} placeholder="Deliver new order" /></label>
              <label>Connection<select required value={workflowForm.connectionId} onChange={(event) => setWorkflowForm({ ...workflowForm, connectionId: event.target.value })}><option value="">Select…</option>{connections.filter((item) => item.status === 'active').map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
              <div className="inline-fields">
                <label>Method<select value={workflowForm.method} onChange={(event) => setWorkflowForm({ ...workflowForm, method: event.target.value })}>{['POST', 'PUT', 'PATCH', 'GET', 'DELETE'].map((method) => <option key={method}>{method}</option>)}</select></label>
                <label>Path<input required value={workflowForm.path} onChange={(event) => setWorkflowForm({ ...workflowForm, path: event.target.value })} /></label>
              </div>
              <label>Description<textarea maxLength="2000" value={workflowForm.description} onChange={(event) => setWorkflowForm({ ...workflowForm, description: event.target.value })} /></label>
              <div className="form-actions"><button className="btn btn-primary" disabled={busy || !connections.length}>{editingWorkflowId ? 'Save revision' : 'Create draft'}</button>{editingWorkflowId && <button type="button" className="btn btn-secondary" onClick={() => { setEditingWorkflowId(''); setWorkflowForm(emptyWorkflow); }}>Cancel edit</button>}</div>
            </form> : <p className="empty-copy">An editor or administrator creates workflow revisions.</p>}
          </section>
        </div>

        <section className="ops-panel wide-panel">
          <div className="panel-heading"><div><span>03</span><h3>Run operations</h3></div><p>Explicit lifecycle transitions prevent unsafe direct status edits.</p></div>
          <div className="workflow-selector">
            <label>Workflow<select value={selectedWorkflow} onChange={(event) => setSelectedWorkflow(event.target.value)}><option value="">Select…</option>{workflows.map((workflow) => <option value={workflow.id} key={workflow.id}>{workflow.name} · {workflow.status}</option>)}</select></label>
            {selected && <div className="state-actions"><Status value={selected.status} />{canEdit && ['draft', 'paused'].includes(selected.status) && selected.definition.steps.length === 1 && <button className="btn btn-secondary" disabled={busy} onClick={() => beginEdit(selected)}>Edit</button>}{canEdit && selected.status === 'draft' && <button className="btn btn-primary" disabled={busy} onClick={() => changeState(selected, 'active')}>Activate</button>}{canEdit && selected.status === 'active' && <button className="btn btn-secondary" disabled={busy} onClick={() => changeState(selected, 'paused')}>Pause</button>}{canEdit && selected.status === 'paused' && <button className="btn btn-primary" disabled={busy} onClick={() => changeState(selected, 'active')}>Reactivate</button>}</div>}
          </div>
          {canEdit && selected?.status === 'active' && <form className="run-form" onSubmit={queueRun}><label>JSON input<textarea rows="4" value={runInput} onChange={(event) => setRunInput(event.target.value)} /></label><button className="btn btn-primary" disabled={busy}>Queue run</button></form>}
          <div className="runs-table" role="region" aria-label="Workflow runs">
            <div className="runs-header"><span>Status</span><span>Attempts</span><span>Created</span><span>Outcome</span><span>Action</span></div>
            {runs.map((run) => <div className="runs-row" key={run.id}><Status value={run.status} /><span>{run.attempts}</span><time>{new Date(run.createdAt).toLocaleString()}</time><span>{run.error?.message || (run.output ? 'Delivered' : 'Pending')}</span><span className="run-actions">{canEdit && run.status === 'dead_letter' && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => runAction(run, 'retry')}>Retry</button>}{canEdit && ['queued', 'retry_scheduled'].includes(run.status) && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => runAction(run, 'cancel')}>Cancel</button>}</span></div>)}
            {!runs.length && <p className="empty-copy">No runs for this workflow.</p>}
          </div>
        </section>
      </div>
    </Layout>
  );
}
