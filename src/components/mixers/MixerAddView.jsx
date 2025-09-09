import React, {useEffect, useMemo, useState} from 'react';
import {MixerService} from '../../services/MixerService';
import {Mixer} from '../../config/models/mixers/Mixer';
import {AuthService} from '../../services/AuthService';
import './styles/MixerAddView.css';
import {usePreferences} from '../../app/context/PreferencesContext'
import {RegionService} from '../../services/RegionService'

function MixerAddView({plants, onClose, onMixerAdded}) {
    const {preferences} = usePreferences()
    const [truckNumber, setTruckNumber] = useState('');
    const [assignedPlant, setAssignedPlant] = useState('');
    const [status, setStatus] = useState('Active');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [regionPlantCodes, setRegionPlantCodes] = useState(null)

    useEffect(() => {
        async function loadMixers() {
            try {
                await MixerService.fetchMixers();
            } catch (error) {
            }
        }

        loadMixers();
    }, []);

    useEffect(() => {
        const code = preferences.selectedRegion?.code || ''
        let cancelled = false

        async function loadRegionPlants() {
            if (!code) {
                setRegionPlantCodes(null)
                return
            }
            try {
                const regionPlants = await RegionService.fetchRegionPlants(code)
                if (cancelled) return
                const codes = new Set(regionPlants.map(p => p.plantCode))
                setRegionPlantCodes(codes)
                if (assignedPlant && !codes.has(assignedPlant)) setAssignedPlant('')
            } catch {
                setRegionPlantCodes(new Set())
            }
        }

        loadRegionPlants()
        return () => {
            cancelled = true
        }
    }, [preferences.selectedRegion?.code, assignedPlant])

    const visiblePlants = useMemo(() => {
        const list = Array.isArray(plants) ? plants : []
        const filtered = !preferences.selectedRegion?.code || !regionPlantCodes ? list : list.filter(p => regionPlantCodes.has(p.plantCode))
        return filtered.slice().sort((a, b) => parseInt(a.plantCode?.replace(/\D/g, '') || '0') - parseInt(b.plantCode?.replace(/\D/g, '') || '0'))
    }, [plants, regionPlantCodes, preferences.selectedRegion?.code])

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (!truckNumber) return setError('Truck number is required');
        if (!assignedPlant) return setError('Plant is required');

        setIsSaving(true);
        try {
            const userId = AuthService.currentUser?.id || sessionStorage.getItem('userId');
            if (!userId) throw new Error('User ID not available. Please log in again.');

            const formatDateForDb = date => {
                if (!date) return null;
                const d = new Date(date);
                if (isNaN(d.getTime())) return null;
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}+00`;
            };

            const now = formatDateForDb(new Date());
            const newMixer = new Mixer({
                truck_number: truckNumber,
                assigned_plant: assignedPlant,
                assigned_operator: '0',
                cleanliness_rating: 5,
                status,
                created_at: now,
                updated_at: now,
                updated_by: userId,
                updated_last: now
            });

            const savedMixer = await MixerService.createMixer(newMixer, userId);
            if (!savedMixer) throw new Error('Failed to add mixer - no data returned from server');

            onMixerAdded(savedMixer);
            onClose();
        } catch (error) {
            setError(`Failed to add mixer: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="add-mixer-modal-backdrop">
            <div className="add-mixer-modal enhanced">
                <div className="add-mixer-header sticky">
                    <h2>Add New Mixer</h2>
                    <button className="ios-button close-btn" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="add-mixer-content-scrollable">
                    <div className="add-mixer-content">
                        {error && <div className="error-message">{error}</div>}
                        <form onSubmit={handleSubmit} autoComplete="off">
                            <div className="form-section">
                                <div className="form-row">
                                    <div className="form-group wide">
                                        <label htmlFor="truckNumber">Truck Number*</label>
                                        <input
                                            id="truckNumber"
                                            type="text"
                                            className="ios-input"
                                            value={truckNumber}
                                            onChange={e => setTruckNumber(e.target.value)}
                                            placeholder="Enter truck number"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="form-section">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="assignedPlant">Assigned Plant*</label>
                                        <select
                                            id="assignedPlant"
                                            className="ios-select"
                                            value={assignedPlant}
                                            onChange={e => setAssignedPlant(e.target.value)}
                                            required
                                        >
                                            <option value="">Select Plant</option>
                                            {visiblePlants?.length ? visiblePlants.map(plant => (
                                                <option key={plant.plantCode} value={plant.plantCode}>
                                                    ({plant.plantCode}) {plant.plantName}
                                                </option>
                                            )) : <option disabled>Loading plants...</option>}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="status">Status</label>
                                        <select
                                            id="status"
                                            className="ios-select"
                                            value={status}
                                            onChange={e => setStatus(e.target.value)}
                                        >
                                            <option value="Active">Active</option>
                                            <option value="Spare">Spare</option>
                                            <option value="In Shop">In Shop</option>
                                            <option value="Retired">Retired</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="ios-button-primary" disabled={isSaving}>
                                    {isSaving ? 'Adding...' : 'Add Mixer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MixerAddView;