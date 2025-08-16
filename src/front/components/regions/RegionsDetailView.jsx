import React, { useEffect, useState } from 'react'
import { RegionService } from '../../../services/RegionService'
import './styles/RegionsDetailView.css'
import '../mixers/styles/MixerDetailView.css'

function RegionsDetailView({ region, onClose, onDelete, onUpdate }) {
    const [regionName, setRegionName] = useState(region.region_name || region.regionName || '')
    const [plantCodes, setPlantCodes] = useState([])
    const [allPlants, setAllPlants] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        setLoading(true)
        async function fetchPlants() {
            let all = []
            let regionPlants = []
            try {
                all = await RegionService.fetchAllPlants()
            } catch {}
            try {
                regionPlants = await RegionService.fetchRegionPlants(region.region_code || region.regionCode)
            } catch {}
            setAllPlants(Array.isArray(all) ? all : [])
            setPlantCodes(Array.isArray(regionPlants) ? regionPlants.map(p => p.plant_code || p.plantCode) : [])
            setLoading(false)
        }
        fetchPlants()
    }, [region])

    const handleSave = async () => {
        setSaving(true)
        setMessage('')
        setError('')
        try {
            await RegionService.updateRegion(region.region_code || region.regionCode, regionName, plantCodes)
            setMessage('Changes saved')
            if (onUpdate) onUpdate(region.region_code || region.regionCode, regionName)
            setTimeout(() => setMessage(''), 2000)
        } catch (e) {
            setError('Error saving changes')
            setTimeout(() => setError(''), 2000)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        setError('')
        setIsDeleting(true)
        try {
            await RegionService.deleteRegion(region.region_code || region.regionCode)
            if (onDelete) onDelete(region.region_code || region.regionCode)
            else onClose()
        } catch (e) {
            setError('Failed to delete region')
        } finally {
            setIsDeleting(false)
        }
    }

    const allSelected = allPlants.length > 0 && plantCodes.length === allPlants.length
    const handleSelectAll = () => {
        if (allSelected) {
            setPlantCodes([])
        } else {
            setPlantCodes(allPlants.map(p => p.plant_code || p.plantCode))
        }
    }

    const handlePlantToggle = (code) => {
        if (plantCodes.includes(code)) {
            setPlantCodes(plantCodes.filter(c => c !== code))
        } else {
            setPlantCodes([...plantCodes, code])
        }
    }

    const visiblePlants = Array.isArray(allPlants) ? allPlants.filter(p => (p.plant_code || p.plantCode)) : []

    return (
        <div className="plant-detail-view">
            <div className="detail-header">
                <button className="back-button" onClick={onClose} aria-label="Back to regions">
                    <i className="fas fa-arrow-left"></i>
                    <span>Back</span>
                </button>
                <h1>Region Details</h1>
            </div>
            <div className="detail-content" style={{maxWidth: 600, margin: '0 auto', width: '100%'}}>
                {message && (
                    <div className="message success">
                        {message}
                    </div>
                )}
                {error && (
                    <div className="message error">
                        {error}
                    </div>
                )}
                <div className="detail-card">
                    <div className="card-header">
                        <h2>Region Information</h2>
                    </div>
                    <div className="form-group">
                        <label>Region Code</label>
                        <input
                            type="text"
                            className="form-control"
                            value={region.region_code || region.regionCode}
                            disabled
                        />
                    </div>
                    <div className="form-group">
                        <label>Region Name</label>
                        <input
                            type="text"
                            className="form-control"
                            value={regionName}
                            onChange={e => setRegionName(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Plants</label>
                        <div className="plants-chip-selector-list">
                            <div className="plants-chip-selector-header">
                                <span
                                    className={`plants-chip-select-all${allSelected ? ' selected' : ''}`}
                                    onClick={handleSelectAll}
                                    tabIndex={0}
                                    onKeyDown={e => {
                                        if (e.key === ' ' || e.key === 'Enter') handleSelectAll()
                                    }}
                                >
                                    {allSelected ? 'Unselect All' : 'Select All'}
                                </span>
                                <span className="plants-chip-select-count">
                                    {plantCodes.length} of {visiblePlants.length} selected
                                </span>
                            </div>
                            <div className="plants-chip-list">
                                {loading ? (
                                    <div className="plants-loading">Loading plants...</div>
                                ) : visiblePlants.length > 0 ? (
                                    visiblePlants.map(plant => {
                                        const code = plant.plant_code || plant.plantCode
                                        const selected = plantCodes.includes(code)
                                        return (
                                            <span
                                                key={code}
                                                className={`plant-chip${selected ? ' selected' : ''}`}
                                                onClick={() => handlePlantToggle(code)}
                                                tabIndex={0}
                                                onKeyDown={e => {
                                                    if (e.key === ' ' || e.key === 'Enter') handlePlantToggle(code)
                                                }}
                                            >
                                                <span className="plant-chip-code">{code}</span>
                                                <span className="plant-chip-name">{plant.plant_name || plant.plantName}</span>
                                                {selected && (
                                                    <span className="plant-chip-remove" title="Remove from region" onClick={e => {
                                                        e.stopPropagation()
                                                        handlePlantToggle(code)
                                                    }}>
                                                        ×
                                                    </span>
                                                )}
                                            </span>
                                        )
                                    })
                                ) : (
                                    <div className="no-plants">
                                        No plants available. Please add plants to the system.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="form-actions">
                        <button className="primary-button save-button" onClick={handleSave} disabled={saving || loading || isDeleting}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button className="cancel-button" onClick={onClose} disabled={saving || loading || isDeleting}>
                            Cancel
                        </button>
                        <button
                            className="cancel-button danger"
                            onClick={handleDelete}
                            disabled={saving || loading || isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RegionsDetailView
