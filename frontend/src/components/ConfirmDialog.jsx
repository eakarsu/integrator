import React from 'react';

export default function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, confirmLabel, danger }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon" style={{ color: danger ? '#ef4444' : '#6366f1' }}>
          {danger ? '⚠️' : 'ℹ️'}
        </div>
        <h3 className="confirm-title">{title || 'Confirm Action'}</h3>
        <p className="confirm-message">{message || 'Are you sure you want to proceed?'}</p>
        <div className="confirm-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
