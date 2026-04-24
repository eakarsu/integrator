import React from 'react';
import StatusBadge from './StatusBadge';

function formatDate(val) {
  if (!val) return '-';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleString();
  } catch {
    return val;
  }
}

function formatCell(value, col) {
  if (value === null || value === undefined) return '-';
  if (col.isStatus) return <StatusBadge status={value} />;
  if (col.isDate) return formatDate(value);
  if (typeof value === 'object') return JSON.stringify(value);
  const str = String(value);
  return str.length > 80 ? str.slice(0, 80) + '...' : str;
}

export default function DataTable({ columns, data, onRowClick, emptyMessage }) {
  if (!data || data.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📭</div>
        <p>{emptyMessage || 'No items found'}</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row._id || row.id || i}
              onClick={() => onRowClick && onRowClick(row)}
              className="table-row-clickable"
            >
              {columns.map((col) => (
                <td key={col.key}>{formatCell(row[col.key], col)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
