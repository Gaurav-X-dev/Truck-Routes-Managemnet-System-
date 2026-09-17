import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Upload, Download, Trash2, Store, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const API_URL = '/api/v1';
const PAGE_SIZE_OPTIONS = [25, 50, 100];

export default function Shops() {
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [beatFilter, setBeatFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [selectedShops, setSelectedShops] = useState<number[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Form State
  const [name, setName] = useState('');
  const [hulCode, setHulCode] = useState('');
  const [beatName, setBeatName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchShops = async () => {
    try {
      const res = await fetch(`${API_URL}/shops`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setShops(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch shops", err);
      setShops([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShops();
  }, []);

  // Reset to page 1 on search/filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, beatFilter, pageSize]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [shopFormErrors, setShopFormErrors] = useState<{name?: string; latitude?: string; longitude?: string}>({});

  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: {name?: string; latitude?: string; longitude?: string} = {};
    if (!name.trim()) errors.name = 'Shop name is required.';
    if (!latitude.trim() || isNaN(parseFloat(latitude))) errors.latitude = 'Valid latitude is required (e.g. 26.45).';
    if (!longitude.trim() || isNaN(parseFloat(longitude))) errors.longitude = 'Valid longitude is required (e.g. 80.32).';
    if (Object.keys(errors).length > 0) { setShopFormErrors(errors); return; }
    setShopFormErrors({});
    try {
      const payload = {
        name: name.trim(),
        hul_code: hulCode.trim() || null,
        beat_name: beatName.trim() || null,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      };
      const res = await fetch(`${API_URL}/shops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowAddModal(false);
        setName(''); setHulCode(''); setBeatName(''); setLatitude(''); setLongitude('');
        fetchShops();
        showToast(`✅ "${name.trim()}" added successfully!`);
      } else {
        showToast('❌ Failed to add shop.', 'error');
      }
    } catch (err) {
      showToast('❌ Error adding shop.', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this shop?")) {
      try {
        await fetch(`${API_URL}/shops/${id}`, { method: 'DELETE' });
        fetchShops();
        showToast('🗑️ Shop deleted.');
      } catch (err) {
        showToast('❌ Failed to delete.', 'error');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedShops.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedShops.length} shops?`)) {
      try {
        await Promise.all(selectedShops.map(id => fetch(`${API_URL}/shops/${id}`, { method: 'DELETE' })));
        setSelectedShops([]);
        fetchShops();
        showToast(`🗑️ ${selectedShops.length} shops deleted.`);
      } catch (err) {
        showToast('❌ Failed to bulk delete.', 'error');
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_URL}/shops/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        showToast(`✅ ${data.message}`);
        fetchShops();
      } else {
        showToast(`❌ Upload failed: ${data.detail || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      showToast('❌ Failed to upload file.', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Unique beats for filter dropdown
  const uniqueBeats = Array.from(new Set(shops.map(s => s.beat_name).filter(Boolean))).sort();

  // Filtered list
  const filteredShops = shops.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.hul_code && s.hul_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.beat_name && s.beat_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesBeat = beatFilter ? s.beat_name === beatFilter : true;
    return matchesSearch && matchesBeat;
  });

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredShops.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, filteredShops.length);
  const pageShops = filteredShops.slice(startIdx, endIdx);

  const goToPage = (p: number) => setCurrentPage(Math.max(1, Math.min(p, totalPages)));

  // Page numbers to show (window of 5)
  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('...');
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Loading Shops...</div>;

  return (
    <div style={{ paddingBottom: '2rem', position: 'relative' }}>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
          background: toast.type === 'success' ? '#0f2a1a' : '#2a0f0f',
          border: `1px solid ${toast.type === 'success' ? '#10b981' : '#ef4444'}`,
          color: toast.type === 'success' ? '#34d399' : '#f87171',
          padding: '0.75rem 1.25rem', borderRadius: '10px',
          fontSize: '0.9rem', fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s ease',
          maxWidth: '360px'
        }}>
          {toast.msg}
        </div>
      )}
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="flex items-center gap-2">
            <Store className="text-primary" size={24} /> Shops & Customers
          </h2>
          <p className="text-muted text-sm mt-1">
            <span style={{ color: '#10b981', fontWeight: 600 }}>{shops.length}</span> total shops — showing <strong>{filteredShops.length}</strong> results
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept=".xlsx,.xls" />
          <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            <Upload size={16} /> {isUploading ? 'Uploading...' : 'Import Excel'}
          </button>
          <a href={`/api/v1/shops/export`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <button className="btn-secondary"><Download size={16} /> Export CSV</button>
          </a>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add Shop
          </button>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
          <input
            type="text"
            placeholder="Search Name, HUL Code, Beat..."
            className="input-field"
            style={{ paddingLeft: '2.4rem' }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="input-field"
          style={{ maxWidth: '180px' }}
          value={beatFilter}
          onChange={e => setBeatFilter(e.target.value)}
        >
          <option value="">All Beats</option>
          {uniqueBeats.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        
        {selectedShops.length > 0 && (
          <button 
            className="btn-secondary" 
            onClick={handleBulkDelete} 
            style={{ color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            <Trash2 size={16} /> Delete Selected ({selectedShops.length})
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.8rem', color: '#888' }}>Rows per page:</span>
          <select
            className="input-field"
            style={{ width: '75px', padding: '0.4rem 0.6rem' }}
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px', color: '#555' }}>
                <input 
                  type="checkbox" 
                  checked={pageShops.length > 0 && selectedShops.length === pageShops.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedShops(pageShops.map((s: any) => s.id));
                    else setSelectedShops([]);
                  }}
                  style={{ cursor: 'pointer', accentColor: '#10b981' }}
                />
              </th>
              <th>HUL Code</th>
              <th>Shop Name</th>
              <th>Beat Name</th>
              <th>Coordinates</th>
              <th style={{ textAlign: 'right' }}>Delete</th>
            </tr>
          </thead>
          <tbody>
            {pageShops.map((shop, idx) => (
              <tr key={shop.id}>
                <td>
                  <input 
                    type="checkbox" 
                    checked={selectedShops.includes(shop.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedShops(prev => [...prev, shop.id]);
                      else setSelectedShops(prev => prev.filter(id => id !== shop.id));
                    }}
                    style={{ cursor: 'pointer', accentColor: '#10b981' }}
                  />
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{shop.hul_code || '-'}</td>
                <td style={{ fontWeight: 500, color: '#fff' }}>{shop.name}</td>
                <td>
                  {shop.beat_name ? (
                    <span style={{ background: '#1a2a1a', color: '#4ade80', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid #2a3a2a' }}>
                      {shop.beat_name}
                    </span>
                  ) : <span style={{ color: '#444' }}>-</span>}
                </td>
                <td>
                  <span style={{ background: '#111', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontFamily: 'monospace', color: '#666' }}>
                    {shop.latitude.toFixed(4)}, {shop.longitude.toFixed(4)}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => handleDelete(shop.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.4rem', opacity: 0.7 }}
                    onMouseOver={e => (e.currentTarget.style.opacity = '1')}
                    onMouseOut={e => (e.currentTarget.style.opacity = '0.7')}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredShops.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#555' }}>
                  No shops found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#666' }}>
            Showing <strong style={{ color: '#aaa' }}>{startIdx + 1}–{endIdx}</strong> of <strong style={{ color: '#aaa' }}>{filteredShops.length}</strong> shops
          </span>

          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            {/* First */}
            <button onClick={() => goToPage(1)} disabled={safePage === 1} style={{ background: 'none', border: '1px solid #333', borderRadius: '6px', color: safePage === 1 ? '#444' : '#888', cursor: safePage === 1 ? 'not-allowed' : 'pointer', padding: '0.35rem 0.5rem', display: 'flex', alignItems: 'center' }}>
              <ChevronsLeft size={14} />
            </button>
            {/* Prev */}
            <button onClick={() => goToPage(safePage - 1)} disabled={safePage === 1} style={{ background: 'none', border: '1px solid #333', borderRadius: '6px', color: safePage === 1 ? '#444' : '#888', cursor: safePage === 1 ? 'not-allowed' : 'pointer', padding: '0.35rem 0.5rem', display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={14} />
            </button>

            {getPageNumbers().map((p, i) =>
              p === '...'
                ? <span key={`dots-${i}`} style={{ color: '#555', padding: '0 0.3rem' }}>…</span>
                : <button
                    key={p}
                    onClick={() => goToPage(p as number)}
                    style={{
                      background: safePage === p ? '#fff' : 'none',
                      border: '1px solid ' + (safePage === p ? '#fff' : '#333'),
                      borderRadius: '6px',
                      color: safePage === p ? '#000' : '#888',
                      cursor: 'pointer',
                      padding: '0.35rem 0.65rem',
                      fontWeight: safePage === p ? 700 : 400,
                      fontSize: '0.82rem',
                      minWidth: '34px'
                    }}
                  >
                    {p}
                  </button>
            )}

            {/* Next */}
            <button onClick={() => goToPage(safePage + 1)} disabled={safePage === totalPages} style={{ background: 'none', border: '1px solid #333', borderRadius: '6px', color: safePage === totalPages ? '#444' : '#888', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', padding: '0.35rem 0.5rem', display: 'flex', alignItems: 'center' }}>
              <ChevronRight size={14} />
            </button>
            {/* Last */}
            <button onClick={() => goToPage(totalPages)} disabled={safePage === totalPages} style={{ background: 'none', border: '1px solid #333', borderRadius: '6px', color: safePage === totalPages ? '#444' : '#888', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', padding: '0.35rem 0.5rem', display: 'flex', alignItems: 'center' }}>
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Add Shop Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="flex justify-between items-center mb-6">
              <h3>Add New Shop</h3>
              <button onClick={() => { setShowAddModal(false); setShopFormErrors({}); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddShop} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label>Shop Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Sharma Ji Kirana Store"
                  value={name}
                  onChange={e => { setName(e.target.value); setShopFormErrors(p => ({...p, name: ''})); }}
                  style={{ borderColor: shopFormErrors.name ? '#ef4444' : undefined }}
                />
                {shopFormErrors.name && (
                  <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span>⚠</span> {shopFormErrors.name}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group" style={{ margin: 0 }}>
                  <label>HUL Code</label>
                  <input type="text" className="input-field" placeholder="e.g. HUL-1A4A344P..." value={hulCode} onChange={e => setHulCode(e.target.value)} />
                </div>
                <div className="input-group" style={{ margin: 0 }}>
                  <label>Beat Name</label>
                  <input type="text" className="input-field" placeholder="e.g. BILHAUR" value={beatName} onChange={e => setBeatName(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group" style={{ margin: 0 }}>
                  <label>Latitude <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. 26.4499"
                    value={latitude}
                    onChange={e => { setLatitude(e.target.value); setShopFormErrors(p => ({...p, latitude: ''})); }}
                    style={{ borderColor: shopFormErrors.latitude ? '#ef4444' : undefined }}
                  />
                  {shopFormErrors.latitude && (
                    <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.3rem' }}>⚠ {shopFormErrors.latitude}</div>
                  )}
                </div>
                <div className="input-group" style={{ margin: 0 }}>
                  <label>Longitude <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. 80.3319"
                    value={longitude}
                    onChange={e => { setLongitude(e.target.value); setShopFormErrors(p => ({...p, longitude: ''})); }}
                    style={{ borderColor: shopFormErrors.longitude ? '#ef4444' : undefined }}
                  />
                  {shopFormErrors.longitude && (
                    <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.3rem' }}>⚠ {shopFormErrors.longitude}</div>
                  )}
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                Save Shop
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

