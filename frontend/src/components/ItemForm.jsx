import React, { useState, useEffect } from 'react';

export default function ItemForm({ fields, initialData, onSave, onCancel, isEdit }) {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      const data = {};
      fields.forEach((f) => {
        data[f.key] = initialData[f.key] !== undefined ? initialData[f.key] : '';
      });
      setFormData(data);
    } else {
      const data = {};
      fields.forEach((f) => {
        data[f.key] = f.type === 'number' ? '' : '';
      });
      setFormData(data);
    }
  }, [initialData, fields]);

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = () => {
    const newErrors = {};
    fields.forEach((f) => {
      if (f.required && !formData[f.key] && formData[f.key] !== 0) {
        newErrors[f.key] = `${f.label} is required`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const cleaned = { ...formData };
    fields.forEach((f) => {
      if (f.type === 'number' && cleaned[f.key] !== '') {
        cleaned[f.key] = Number(cleaned[f.key]);
      }
    });
    onSave(cleaned);
  };

  return (
    <form className="item-form" onSubmit={handleSubmit}>
      <h2 className="form-title">{isEdit ? 'Edit Item' : 'Create New Item'}</h2>
      <div className="form-grid">
        {fields.map((field) => (
          <div key={field.key} className={`form-group ${field.type === 'textarea' ? 'form-group-full' : ''}`}>
            <label className="form-label">
              {field.label}
              {field.required && <span className="required-star"> *</span>}
            </label>
            {field.type === 'select' ? (
              <select
                className={`form-input ${errors[field.key] ? 'form-input-error' : ''}`}
                value={formData[field.key] || ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
              >
                <option value="">Select {field.label}</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                className={`form-input form-textarea ${errors[field.key] ? 'form-input-error' : ''}`}
                value={formData[field.key] || ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
                rows={3}
              />
            ) : (
              <input
                type={field.type || 'text'}
                className={`form-input ${errors[field.key] ? 'form-input-error' : ''}`}
                value={formData[field.key] || ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={`Enter ${field.label.toLowerCase()}`}
              />
            )}
            {errors[field.key] && <span className="form-error">{errors[field.key]}</span>}
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {isEdit ? 'Save Changes' : 'Create'}
        </button>
      </div>
    </form>
  );
}
