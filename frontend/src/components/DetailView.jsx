import React, { useState } from 'react';
import StatusBadge from './StatusBadge';
import ItemForm from './ItemForm';
import ConfirmDialog from './ConfirmDialog';

function formatValue(val) {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

function isDateField(key) {
  const dateKeys = ['createdAt', 'updatedAt', 'lastRun', 'nextRun', 'nextRetry', 'timestamp'];
  return dateKeys.includes(key);
}

function isStatusField(key) {
  return ['status', 'level', 'severity'].includes(key);
}

export default function DetailView({ item, fields, onEdit, onDelete, onClose }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!item) return null;

  if (editing) {
    return (
      <div className="detail-view">
        <ItemForm
          fields={fields}
          initialData={item}
          isEdit={true}
          onSave={(data) => {
            onEdit(item._id || item.id, data);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const displayKeys = Object.keys(item).filter(
    (k) => !['__v', 'password'].includes(k)
  );

  return (
    <div className="detail-view">
      <div className="detail-header">
        <h2 className="detail-title">{item.name || item.key || item.message || 'Item Details'}</h2>
        <button className="btn-close" onClick={onClose}>✕</button>
      </div>

      <div className="detail-fields">
        {displayKeys.map((key) => (
          <div key={key} className="detail-field">
            <label className="detail-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</label>
            <div className="detail-value">
              {isStatusField(key) ? (
                <StatusBadge status={item[key]} />
              ) : isDateField(key) && item[key] ? (
                new Date(item[key]).toLocaleString()
              ) : typeof item[key] === 'object' && item[key] !== null ? (
                <pre className="detail-json">{JSON.stringify(item[key], null, 2)}</pre>
              ) : (
                formatValue(item[key])
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="detail-actions">
        <button className="btn btn-primary" onClick={() => setEditing(true)}>
          ✏️ Edit
        </button>
        <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
          🗑️ Delete
        </button>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete Item"
        message="Are you sure you want to delete this item? This action cannot be undone."
        confirmLabel="Delete"
        danger={true}
        onConfirm={() => {
          onDelete(item._id || item.id);
          setConfirmDelete(false);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
