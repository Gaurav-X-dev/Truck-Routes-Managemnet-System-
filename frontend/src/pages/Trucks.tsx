import React, { useState, useEffect, useMemo } from 'react';
import { Truck, RotateCcw, AlertCircle, Plus, Trash2, MapPin, Send, History, X, Route as RouteIcon, MoreHorizontal, ArrowLeft, Server } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

// Helper to get today's date string in YYYY-MM-DD
const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const parseCoordinates = (input: string): { lat: number, lng: number } | null => {
  const regex = /(-?\d+\.\d+)(?:,\s*|%2C\s*|\s+)(-?\d+\.\d+)/;
  const match = input.match(regex);
  if (match && match.length >= 3) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }
  return null;
};

export default function Trucks() {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [selectedTrucks, setSelectedTrucks] = useState<string[]>([]);
  
  // Modals state
  const [showAddTruckModal, setShowAddTruckModal] = useState(false);
  
  // Custom Confirm Modal
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void; isDestructive?: boolean}>({
    isOpen: false, title: '', message: '', onConfirm: () => {}
  });
  
  // Add Truck Form
  const [newTruckId, setNewTruckId] = useState('');
  const [newDriver, setNewDriver] = useState('');
  const [formErrors, setFormErrors] = useState<{truckId?: string; driver?: string}>({});
  const [toast, setToast] = useState<{msg: string; type: 'success'|'error'}|null>(null);

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTrucks = async () => {
    try {
      const res = await fetch(`${API_URL}/trucks`);
      const data = await res.json();
      setTrucks(data);
    } catch (err) {
      console.error("Failed to fetch trucks. Ensure backend is running.", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Midnight reset check on server load
    const doReset = async () => {
      try {
        await fetch(`${API_URL}/maintenance/midnight-reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ today: getTodayString() })
        });
        fetchTrucks();
      } catch (err) {
        console.error("Auto reset failed", err);
      }
    };
    doReset();
    
    // Check every hour
    const interval = setInterval(doReset, 60 * 60 * 1000); 
    return () => clearInterval(interval);
  }, []);

  const handleTrack = (id: string) => navigate(`/dashboard/map?truck=${id}`);

  const handleAddTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: {truckId?: string; driver?: string} = {};
    if (!newTruckId.trim()) errors.truckId = 'Vehicle license plate is required.';
    else if (newTruckId.trim().length < 4) errors.truckId = 'Enter a valid license plate (min 4 chars).';
    if (!newDriver.trim()) errors.driver = 'Driver name is required.';
    else if (newDriver.trim().length < 2) errors.driver = 'Enter a valid driver name.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    try {
      const res = await fetch(`${API_URL}/trucks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newTruckId.toUpperCase().trim(), driver: newDriver.trim() })
      });
      if (res.ok) {
        setShowAddTruckModal(false);
        setNewTruckId('');
        setNewDriver('');
        fetchTrucks();
        showToast(`✅ Truck "${newTruckId.toUpperCase().trim()}" registered successfully!`);
      } else {
        const data = await res.json();
        showToast(`❌ ${data.detail || 'Failed to register truck.'}`, 'error');
      }
    } catch(err) {
      showToast('❌ Network error. Please try again.', 'error');
    }
  };

  const openPlanner = (truck: any) => {
    navigate(`/dashboard/planner/${truck.id}`);
  };

  const completeTrip = async (truckId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Complete Trip',
      message: 'Archive this trip? It will be saved to History and the truck will reset for a new trip.',
      onConfirm: async () => {
        try {
          await fetch(`${API_URL}/trucks/${truckId}/complete`, { method: 'POST' });
          fetchTrucks();
          showToast(`✅ Trip completed for truck "${truckId}".`);
        } catch (err: any) {
          showToast(`❌ Error: ${err.message}`, 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const archiveTruck = async (truckId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Archive Truck',
      message: `Archive truck "${truckId}"? It will be removed from active routing but history will be preserved.`,
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_URL}/trucks/${truckId}/archive`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
          });
          if (!res.ok) throw new Error("Failed to archive truck");
          fetchTrucks();
          showToast(`🗑️ Truck "${truckId}" archived.`);
        } catch (err: any) {
          showToast(`❌ Error archiving truck: ${err.message}`, 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const unarchiveTruck = async (truckId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Unarchive Truck',
      message: `Restore truck "${truckId}" to the active fleet?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_URL}/trucks/${truckId}/unarchive`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
          });
          if (!res.ok) throw new Error("Failed to unarchive truck");
          fetchTrucks();
          showToast(`✅ Truck "${truckId}" unarchived.`);
        } catch (err: any) {
          showToast(`❌ Error unarchiving truck: ${err.message}`, 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const deleteTruck = async (truckId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Truck',
      message: `Permanently delete truck "${truckId}" and all its history? This action cannot be undone.`,
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_URL}/trucks/${truckId}`, { method: 'DELETE' });
          if (!res.ok) throw new Error("Failed to delete truck");
          fetchTrucks();
          showToast(`🗑️ Truck "${truckId}" permanently deleted.`);
        } catch (err: any) {
          showToast(`❌ Error deleting truck: ${err.message}`, 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const bulkDeleteTrucks = () => {
    if (selectedTrucks.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Selected Trucks',
      message: `Are you sure you want to delete ${selectedTrucks.length} trucks? This action cannot be undone.`,
      isDestructive: true,
      onConfirm: async () => {
        try {
          await Promise.all(selectedTrucks.map(id => fetch(`${API_URL}/trucks/${id}`, { method: 'DELETE' })));
          setSelectedTrucks([]);
          fetchTrucks();
          showToast(`🗑️ ${selectedTrucks.length} trucks permanently deleted.`);
        } catch (err: any) {
          showToast(`❌ Error during bulk delete: ${err.message}`, 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const shareToWhatsApp = (truckId: string, driverName: string) => {
    const link = `${window.location.origin}/driver/${truckId}`;
    const text = `Hello ${driverName},\nYour truck (${truckId}) has been assigned a new route.\n\nPlease click this link to view your delivery stops and Start GPS Duty:\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };



  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Loading Fleet Data from Server...</div>;

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
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
          maxWidth: '360px'
        }}>
          {toast.msg}
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="flex items-center gap-2">Logistics Fleet <span style={{ background: '#222', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Server size={10} className="text-success"/> Connected</span></h2>
          <p className="text-muted text-sm mt-1">Manage trucks, history, and optimize delivery routes.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div style={{ display: 'flex', background: '#111', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button onClick={() => setActiveTab('active')} style={{ background: activeTab === 'active' ? '#222' : 'transparent', color: activeTab === 'active' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, transition: 'all 0.2s ease' }}>Active Fleet</button>
            <button onClick={() => setActiveTab('archived')} style={{ background: activeTab === 'archived' ? '#222' : 'transparent', color: activeTab === 'archived' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, transition: 'all 0.2s ease' }}>Archived</button>
          </div>
          <button className="btn-primary" onClick={() => setShowAddTruckModal(true)}>
            <Plus size={16} /> Add Truck
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <input 
          type="text" 
          placeholder="Search by Vehicle ID or Driver Name..." 
          className="input-field" 
          style={{ maxWidth: '400px' }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select 
          className="input-field" 
          style={{ maxWidth: '200px' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="idle">Idle</option>
          <option value="loading">Loading</option>
          <option value="transit">In Transit</option>
          <option value="transit">In Transit</option>
        </select>
        {selectedTrucks.length > 0 && (
          <button 
            className="btn-secondary" 
            onClick={bulkDeleteTrucks} 
            style={{ color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            <Trash2 size={16} /> Delete Selected ({selectedTrucks.length})
          </button>
        )}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input 
                  type="checkbox" 
                  checked={trucks.filter(t => (activeTab === 'active' ? !t.is_archived : t.is_archived)).length > 0 && selectedTrucks.length === trucks.filter(t => (activeTab === 'active' ? !t.is_archived : t.is_archived)).length}
                  onChange={(e) => {
                    const filteredTrucks = trucks.filter(t => (activeTab === 'active' ? !t.is_archived : t.is_archived));
                    if (e.target.checked) setSelectedTrucks(filteredTrucks.map(t => t.id));
                    else setSelectedTrucks([]);
                  }}
                  style={{ cursor: 'pointer', accentColor: '#10b981' }}
                />
              </th>
              <th>Vehicle ID</th>
              <th>Driver Name</th>
              <th>Active Load</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(activeTab === 'active' ? trucks.filter(t => t.is_archived === false) : trucks.filter(t => t.is_archived === true))
              .filter(t => t.id.toLowerCase().includes(searchQuery.toLowerCase()) || t.driver.toLowerCase().includes(searchQuery.toLowerCase()))
              .filter(t => statusFilter === 'All' || t.status === statusFilter)
              .map(truck => (
              <tr key={truck.id} onMouseLeave={() => setOpenDropdownId(null)}>
                <td>
                  <input 
                    type="checkbox" 
                    checked={selectedTrucks.includes(truck.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedTrucks(prev => [...prev, truck.id]);
                      else setSelectedTrucks(prev => prev.filter(id => id !== truck.id));
                    }}
                    style={{ cursor: 'pointer', accentColor: '#10b981' }}
                  />
                </td>
                <td style={{ fontWeight: 500, letterSpacing: '0.02em' }}>{truck.id}</td>
                <td className="text-muted">{truck.driver}</td>
                <td>
                  {truck.route_status === 'DRAFT' ? (
                    <span style={{ 
                      background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.2)',
                      padding: '0.125rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600
                    }}>
                      Draft Trip
                    </span>
                  ) : truck.assignedBills > 0 ? (
                    <div className="flex flex-col gap-1">
                      <span style={{ 
                        background: 'var(--success-bg)', color: 'var(--success)', display: 'inline-block',
                        padding: '0.125rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, width: 'fit-content'
                      }}>
                        {truck.assignedBills} Bills
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        Assigned: {truck.tripDate || "Today"}
                      </span>
                    </div>
                  ) : (
                    <span style={{ 
                      background: '#222', color: '#888',
                      padding: '0.125rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600
                    }}>
                      Empty
                    </span>
                  )}
                </td>
                <td>
                  <span className={`status-badge status-${truck.status}`}>
                    {truck.status === 'idle' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', marginRight: 6 }}></span>}
                    {truck.status === 'transit' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', marginRight: 6 }}></span>}
                    {truck.status === 'loading' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', marginRight: 6 }}></span>}
                    {truck.status}
                  </span>
                </td>
                <td style={{ position: 'relative' }}>
                  <div className="flex items-center gap-2" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn-secondary" onClick={() => setOpenDropdownId(openDropdownId === truck.id ? null : truck.id)} style={{ padding: '0.4rem', border: 'none', background: 'transparent' }}>
                      <MoreHorizontal size={20} />
                    </button>
                    {openDropdownId === truck.id && (
                      <div 
                        style={{ 
                          position: 'absolute', right: '40px', top: '100%',
                          background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', 
                          padding: '0.5rem', zIndex: 50, display: 'flex', flexDirection: 'column', gap: '0.25rem', 
                          boxShadow: '0 4px 12px rgba(0,0,0,0.5)', minWidth: '150px'
                        }}
                      >
                        <button className="btn-secondary" onClick={() => { handleTrack(truck.id); setOpenDropdownId(null); }} style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent' }}>
                          <MapPin size={14} /> Live Track
                        </button>
                        <button className="btn-secondary" onClick={() => { navigate(`/dashboard/history/${truck.id}`); setOpenDropdownId(null); }} style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent' }}>
                          <History size={14} /> Trip History
                        </button>
                        
                        {activeTab === 'active' && (
                          <>
                            <button className="btn-secondary" onClick={() => { openPlanner(truck); setOpenDropdownId(null); }} style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent' }}>
                              <RouteIcon size={14} /> {truck.assignedBills > 0 ? 'Edit Route' : 'Plan Route'}
                            </button>
                            
                            {truck.assignedBills > 0 && (
                              <>
                                <button className="btn-secondary" onClick={() => { shareToWhatsApp(truck.id, truck.driver); setOpenDropdownId(null); }} style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', color: '#25D366' }}>
                                  <Send size={14} /> WhatsApp Driver
                                </button>
                                <button className="btn-secondary" onClick={() => { completeTrip(truck.id); setOpenDropdownId(null); }} style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', color: 'var(--success)' }}>
                                  <RotateCcw size={14} /> Force Complete
                                </button>
                              </>
                            )}
                            <button className="btn-secondary" onClick={() => { archiveTruck(truck.id); setOpenDropdownId(null); }} style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', color: 'var(--error)' }}>
                              <Trash2 size={14} /> Archive Truck
                            </button>
                          </>
                        )}
                        {activeTab === 'archived' && (
                          <button className="btn-secondary" onClick={() => { unarchiveTruck(truck.id); setOpenDropdownId(null); }} style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', color: 'var(--success)' }}>
                            <RotateCcw size={14} /> Unarchive Truck
                          </button>
                        )}
                        <button className="btn-secondary" onClick={() => { deleteTruck(truck.id); setOpenDropdownId(null); }} style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', color: 'var(--error)' }}>
                          <Trash2 size={14} /> Permanently Delete
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddTruckModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="flex justify-between items-center mb-6">
              <h3>Register Vehicle</h3>
              <button onClick={() => setShowAddTruckModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddTruck} noValidate>
              <div className="input-group">
                <label>Vehicle License Plate <span style={{color:'#ef4444'}}>*</span></label>
                <input
                  type="text"
                  className="input-field"
                  value={newTruckId}
                  onChange={(e) => { setNewTruckId(e.target.value); setFormErrors(p => ({...p, truckId: ''})); }}
                  placeholder="e.g. UP78 AB 6677"
                  style={{ borderColor: formErrors.truckId ? '#ef4444' : undefined }}
                />
                {formErrors.truckId && (
                  <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.35rem', display:'flex', alignItems:'center', gap:'0.3rem' }}>
                    <span>⚠</span> {formErrors.truckId}
                  </div>
                )}
              </div>
              <div className="input-group">
                <label>Assigned Driver <span style={{color:'#ef4444'}}>*</span></label>
                <input
                  type="text"
                  className="input-field"
                  value={newDriver}
                  onChange={(e) => { setNewDriver(e.target.value); setFormErrors(p => ({...p, driver: ''})); }}
                  placeholder="Driver full name"
                  style={{ borderColor: formErrors.driver ? '#ef4444' : undefined }}
                />
                {formErrors.driver && (
                  <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.35rem', display:'flex', alignItems:'center', gap:'0.3rem' }}>
                    <span>⚠</span> {formErrors.driver}
                  </div>
                )}
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                Register Truck
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ color: confirmModal.isDestructive ? 'var(--error)' : 'var(--text-primary)' }}>
                {confirmModal.title}
              </h3>
              <button onClick={() => setConfirmModal(prev => ({...prev, isOpen: false}))} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              {confirmModal.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setConfirmModal(prev => ({...prev, isOpen: false}))}>
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={confirmModal.onConfirm}
                style={confirmModal.isDestructive ? { background: 'var(--error)', color: 'white', borderColor: 'var(--error)' } : {}}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
