import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import DetailView from '../components/DetailView';
import ItemForm from '../components/ItemForm';
import SearchBar from '../components/SearchBar';
import featureConfig from '../api/featureConfig';
import api from '../api/axios';

export default function FeaturePage() {
  const { feature } = useParams();
  const navigate = useNavigate();
  const config = featureConfig[feature];

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotify = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchItems = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(config.endpoint);
      const data = res.data;
      if (Array.isArray(data)) {
        setItems(data);
      } else if (data && typeof data === 'object') {
        const arr = data.data || data.items || data.results || data[feature] || [];
        setItems(Array.isArray(arr) ? arr : []);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [config, feature]);

  useEffect(() => {
    fetchItems();
    setSelectedItem(null);
    setShowCreate(false);
    setSearchQuery('');
  }, [feature, fetchItems]);

  if (!config) {
    return (
      <Layout>
        <div className="page-container">
          <div className="empty-state">
            <div className="empty-icon">❓</div>
            <p>Feature "{feature}" not found</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Dashboard</button>
          </div>
        </div>
      </Layout>
    );
  }

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(item).some((val) =>
      val !== null && val !== undefined && String(val).toLowerCase().includes(q)
    );
  });

  const handleCreate = async (data) => {
    try {
      await api.post(config.endpoint, data);
      showNotify('Item created successfully');
      setShowCreate(false);
      fetchItems();
    } catch (err) {
      showNotify(err.response?.data?.error || err.response?.data?.message || 'Failed to create item', 'error');
    }
  };

  const handleEdit = async (id, data) => {
    try {
      await api.put(`${config.endpoint}/${id}`, data);
      showNotify('Item updated successfully');
      setSelectedItem(null);
      fetchItems();
    } catch (err) {
      showNotify(err.response?.data?.error || err.response?.data?.message || 'Failed to update item', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`${config.endpoint}/${id}`);
      showNotify('Item deleted successfully');
      setSelectedItem(null);
      fetchItems();
    } catch (err) {
      showNotify(err.response?.data?.error || err.response?.data?.message || 'Failed to delete item', 'error');
    }
  };

  return (
    <Layout>
      <div className="page-container">
        {notification && (
          <div className={`notification notification-${notification.type}`}>
            {notification.type === 'success' ? '✅' : '❌'} {notification.message}
          </div>
        )}

        <div className="page-header">
          <div className="page-header-left">
            <button className="btn-back" onClick={() => navigate('/')}>
              ← Back
            </button>
            <div>
              <h2 className="page-title">
                <span className="page-icon">{config.icon}</span> {config.title}
              </h2>
              <p className="page-subtitle">{config.description}</p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => { setShowCreate(true); setSelectedItem(null); }}>
            + New Item
          </button>
        </div>

        {showCreate && (
          <div className="modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <ItemForm
                fields={config.fields}
                onSave={handleCreate}
                onCancel={() => setShowCreate(false)}
              />
            </div>
          </div>
        )}

        {selectedItem && (
          <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
            <div className="modal-content modal-content-detail" onClick={(e) => e.stopPropagation()}>
              <DetailView
                item={selectedItem}
                fields={config.fields}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onClose={() => setSelectedItem(null)}
              />
            </div>
          </div>
        )}

        <div className="page-toolbar">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={`Search ${config.title.toLowerCase()}...`}
          />
          <span className="item-count">
            {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner-large" />
            <p>Loading {config.title.toLowerCase()}...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <div className="empty-icon">⚠️</div>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={fetchItems}>Retry</button>
          </div>
        ) : (
          <DataTable
            columns={config.columns}
            data={filteredItems}
            onRowClick={(item) => setSelectedItem(item)}
            emptyMessage={`No ${config.title.toLowerCase()} found. Create one to get started.`}
          />
        )}
      </div>
    </Layout>
  );
}
