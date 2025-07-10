import React, {useState} from 'react';
import supabase from '../../core/clients/SupabaseClient';

const EmergencyRepair = () => {
    const [tractorId, setTractorId] = useState('');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);

    const clearAllCache = () => {
        if (window.confirm('WARNING: This will clear ALL cached data. Continue?')) {
            localStorage.clear();
            setStatus('All cache cleared. Reload the page now.');
        }
    };

    const fixTractorById = async () => {
        if (!tractorId) {
            setStatus('Please enter a tractor ID');
            return;
        }

        setLoading(true);
        setStatus('Working...');

        try {
            // First check if the tractor exists
            const {data, error} = await supabase
                .from('tractors')
                .select('id, truck_number')
                .eq('id', tractorId);

            if (error) throw error;

            if (!data || data.length === 0) {
                setStatus(`Tractor with ID ${tractorId} not found in database. Cannot repair.`);
                setLoading(false);
                return;
            }

            // Remove from local cache
            const cachedTractors = localStorage.getItem('cachedTractors');
            if (cachedTractors) {
                try {
                    const tractors = JSON.parse(cachedTractors);
                    if (Array.isArray(tractors)) {
                        const newCache = tractors.filter(t => String(t.id) !== String(tractorId));
                        localStorage.setItem('cachedTractors', JSON.stringify(newCache));
                    }
                } catch (e) {
                    console.error('Error parsing cache:', e);
                    localStorage.removeItem('cachedTractors');
                }
            }

            setStatus(`Tractor ${data[0].truck_number} (${tractorId}) repaired. Cache has been updated.`);
        } catch (error) {
            console.error('Repair error:', error);
            setStatus(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            backgroundColor: '#ffebee',
            border: '2px solid #f44336',
            borderRadius: '8px',
            padding: '20px',
            margin: '20px',
            maxWidth: '500px'
        }}>
            <h2 style={{color: '#d32f2f', marginTop: 0}}>🚨 EMERGENCY REPAIR TOOL</h2>
            <p style={{fontWeight: 'bold'}}>
                Use this tool only when directed by support.
            </p>

            <div style={{marginBottom: '20px'}}>
                <button
                    onClick={clearAllCache}
                    style={{
                        backgroundColor: '#d32f2f',
                        color: 'white',
                        padding: '10px 15px',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    CLEAR ALL CACHE
                </button>
                <p style={{fontSize: '12px', marginTop: '5px'}}>
                    This will clear all locally stored data. You'll need to log in again.
                </p>
            </div>

            <div style={{marginBottom: '20px'}}>
                <h3 style={{marginBottom: '10px'}}>Fix Specific Tractor</h3>
                <input
                    type="text"
                    value={tractorId}
                    onChange={(e) => setTractorId(e.target.value)}
                    placeholder="Enter tractor ID"
                    style={{
                        padding: '8px',
                        width: '100%',
                        marginBottom: '10px',
                        boxSizing: 'border-box'
                    }}
                />
                <button
                    onClick={fixTractorById}
                    disabled={loading}
                    style={{
                        backgroundColor: '#4a148c',
                        color: 'white',
                        padding: '10px 15px',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1
                    }}
                >
                    {loading ? 'Working...' : 'Repair Tractor'}
                </button>
            </div>

            {status && (
                <div style={{
                    backgroundColor: 'white',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc'
                }}>
                    <strong>Status:</strong> {status}
                </div>
            )}

            <p style={{fontSize: '12px', color: '#666', marginTop: '20px'}}>
                After using this tool, you should reload the page for changes to take effect.
            </p>
        </div>
    );
};

export default EmergencyRepair;
