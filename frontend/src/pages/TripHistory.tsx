import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, CheckCircle, Navigation } from 'lucide-react';

const API_URL = '/api/v1';

export default function TripHistory() {
  const { truckId } = useParams();
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTripId, setExpandedTripId] = useState<number | null>(null);

  useEffect(() => {
    fetchHistory();
  }, [truckId]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/trucks/${truckId}/history`);
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      setHistory(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleTrip = (tripId: number) => {
    setExpandedTripId(prev => prev === tripId ? null : tripId);
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return 'Time unknown';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatDate = (isoString: string) => {
    if (!isoString) return 'Unknown Date';
    const d = new Date(isoString);
    return d.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={() => navigate('/dashboard/trucks')}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.5rem' }}
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Trip History</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, marginTop: '0.25rem' }}>Detailed past routes for <span style={{ color: 'var(--primary)', color: '#3b82f6' }}>{truckId}</span></p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div style={{ color: '#3b82f6' }}><Clock size={32} /></div>
        </div>
      ) : error ? (
        <div style={{ padding: '1.5rem', borderRadius: '8px', background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error)' }}>
          <p>Error: {error}</p>
        </div>
      ) : history.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <Navigation size={48} style={{ margin: '0 auto 1rem', opacity: 0.5, color: 'var(--text-secondary)' }} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No History Found</h3>
          <p style={{ color: 'var(--text-secondary)' }}>This truck hasn't completed any trips yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {history.map(trip => {
            const isExpanded = expandedTripId === trip.id;
            return (
              <div key={trip.id} style={{ borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div 
                  onClick={() => toggleTrip(trip.id)}
                  style={{ 
                    padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    cursor: 'pointer', borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                      <CheckCircle size={24} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        Trip #{trip.id}
                      </h3>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, marginTop: '0.25rem' }}>
                        {formatDate(trip.date)} &bull; {trip.stops.length} Stops
                      </p>
                    </div>
                  </div>
                  <button style={{ 
                    background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', 
                    padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.875rem', cursor: 'pointer' 
                  }}>
                    {isExpanded ? 'Hide Details' : 'View Details'}
                  </button>
                </div>

                {isExpanded && (
                  <div style={{ padding: '1.5rem', background: '#050505' }}>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                      Timeline
                    </h4>
                    
                    <div style={{ position: 'relative', paddingLeft: '1.5rem', paddingBottom: '1rem' }}>
                      {/* Vertical line connector */}
                      <div style={{ position: 'absolute', left: '0.45rem', top: '1rem', bottom: '2rem', width: '2px', background: 'var(--border-color)' }}></div>
                      
                      {trip.stops.map((stop: any, index: number) => (
                        <div key={index} style={{ position: 'relative', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
                          
                          {/* Timeline node */}
                          <div style={{ 
                            position: 'absolute', left: '-1.5rem', top: '0.25rem',
                            width: '24px', height: '24px', borderRadius: '50%', 
                            background: stop.status === 'COMPLETED' ? 'var(--success-bg)' : '#111', 
                            border: `2px solid ${stop.status === 'COMPLETED' ? 'var(--success)' : 'var(--border-color)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 10
                          }}>
                            {stop.status === 'COMPLETED' ? (
                              <CheckCircle size={12} style={{ color: 'var(--success)' }} />
                            ) : (
                              <MapPin size={12} style={{ color: 'var(--text-secondary)' }} />
                            )}
                          </div>
                          
                          {/* Stop Info Card */}
                          <div style={{ 
                            flex: 1, padding: '1rem', borderRadius: '8px', 
                            background: 'var(--bg-card)', border: '1px solid var(--border-color)' 
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                              <h5 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{stop.name}</h5>
                              <span style={{ 
                                fontSize: '0.75rem', fontWeight: 500, padding: '0.125rem 0.5rem', 
                                borderRadius: '9999px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' 
                              }}>
                                Stop {index + 1}
                              </span>
                            </div>
                            
                            {stop.address && (
                              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, marginBottom: '0.75rem' }}>
                                {stop.address}
                              </p>
                            )}
                            
                            <div style={{ 
                              display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem',
                              color: stop.status === 'COMPLETED' ? 'var(--success)' : 'var(--text-secondary)' 
                            }}>
                              <Clock size={14} />
                              <span>
                                {stop.status === 'COMPLETED'
                                  ? (stop.completed_at ? `Marked complete at ${formatTime(stop.completed_at)}` : 'Completed') 
                                  : (stop.status === 'SKIPPED' ? 'Skipped' : 'Not completed')}
                              </span>
                            </div>
                          </div>
                          
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
