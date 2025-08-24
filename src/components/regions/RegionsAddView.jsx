import React, {useState} from 'react';
import {RegionService} from '../../services/RegionService';
import './styles/RegionsAddView.css';

function RegionsAddView({onClose, onRegionAdded}) {
    const [regionCode, setRegionCode] = useState('');
    const [regionName, setRegionName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (!regionCode) return setError('Region code is required');
        if (!regionName) return setError('Region name is required');
        setIsSaving(true);
        try {
            await RegionService.createRegion(regionCode, regionName);
            const allRegions = await RegionService.fetchRegions();
            const newRegion = allRegions.find(
                r => (r.region_code || r.regionCode) === regionCode.trim()
            );
            if (newRegion) {
                onRegionAdded(newRegion);
            } else {
                onRegionAdded({
                    region_code: regionCode.trim(),
                    region_name: regionName.trim()
                });
            }
            onClose();
        } catch (err) {
            if (err?.message && (err.message.includes('duplicate key value') || (err.details && err.details.includes('duplicate key value')))) {
                setError('A region with this code already exists, or there was a database error. Please check for leading/trailing spaces or try a different code.');
            } else {
                setError(`Failed to add region: ${err.message || 'Unknown error'}`);
            }
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="add-region-modal-backdrop">
            <div className="add-region-modal enhanced">
                <div className="add-region-header sticky">
                    <h2>Add New Region</h2>
                    <button className="ios-button close-btn" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="add-region-content-scrollable">
                    <div className="add-region-content">
                        {error && <div className="error-message">{error}</div>}
                        <form onSubmit={handleSubmit} autoComplete="off">
                            <div className="form-section">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="regionCode">Region Code*</label>
                                        <input
                                            id="regionCode"
                                            type="text"
                                            className="ios-input"
                                            value={regionCode}
                                            onChange={e => setRegionCode(e.target.value)}
                                            placeholder="Enter region code"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="regionName">Region Name*</label>
                                        <input
                                            id="regionName"
                                            type="text"
                                            className="ios-input"
                                            value={regionName}
                                            onChange={e => setRegionName(e.target.value)}
                                            placeholder="Enter region name"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="ios-button-primary" disabled={isSaving}>
                                    {isSaving ? 'Adding...' : 'Add Region'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RegionsAddView;