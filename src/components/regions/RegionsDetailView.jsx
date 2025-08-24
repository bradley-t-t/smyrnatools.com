import React, {useEffect, useState} from 'react'
import {RegionService} from '../../services/RegionService'
import {PlantService} from '../../services/PlantService'
import './styles/RegionsDetailView.css'
import '../mixers/styles/MixerDetailView.css'

function RegionsDetailView({region, onClose, onDelete, onUpdate}) {
    const [regionName, setRegionName] = useState(region.region_name || region.regionName || '')
    const [plantCodes, setPlantCodes] = useState([])
    const [allPlants, setAllPlants] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    const [plantQuery, setPlantQuery] = useState('')

    useEffect(() => {
        setLoading(true)

        async function fetchPlants() {
            let normalizedAll = []
            let regionPlants
            try {
                const rawPlants = await PlantService.fetchAllPlants()
                const arr = Array.isArray(rawPlants) ? rawPlants : []
                const tmp = arr.map(p => {
                    const code = String((p.plant_code ?? p.plantCode ?? '')).trim()
                    const name = String((p.plant_name ?? p.plantName ?? '')).trim()
                    return code && name ? {plant_code: code, plant_name: name} : null
                }).filter(Boolean)
                const seen = new Set()
                normalizedAll = tmp.filter(p => {
                    if (seen.has(p.plant_code)) return false
                    seen.add(p.plant_code)
                    return true
                })
            } catch {
                normalizedAll = []
            }
            try {
                regionPlants = await RegionService.fetchRegionPlants(region.region_code || region.regionCode)
            } catch {
                regionPlants = []
            }
            setAllPlants(normalizedAll)
            setPlantCodes(
                Array.isArray(regionPlants)
                    ? regionPlants
                        .map(p => p.plant_code || p.plantCode)
                        .filter(code => !!code && normalizedAll.some(ap => ap.plant_code === code))
                    : []
            )
            setPlantQuery('')
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

    const visiblePlants = Array.isArray(allPlants) ? allPlants : []

    const filteredPlants = visiblePlants.filter(p => {
        const q = plantQuery.trim().toLowerCase()
        if (!q) return true
        return p.plant_code.toLowerCase().includes(q) || (p.plant_name || '').toLowerCase().includes(q)
    })

    const togglePlant = (code) => {
        setPlantCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])
    }

    const selectAllFiltered = () => {
        if (!filteredPlants.length) return
        const codes = filteredPlants.map(p => p.plant_code)
        setPlantCodes(prev => Array.from(new Set([...prev, ...codes])))
    }

    const clearAllSelected = () => {
        if (!plantCodes.length) return
        setPlantCodes([])
    }

    const removeChip = (code) => {
        setPlantCodes(prev => prev.filter(c => c !== code))
    }

    const noPlantsAvailable = !loading && visiblePlants.length === 0

    return (
        <div className="region-detail-view">
            <div className="detail-header">
                <button className="back-button" onClick={onClose} aria-label="Back to regions">
                    <i className="fas fa-arrow-left"></i>
                    <span>Back</span>
                </button>
                <h1>Region Details</h1>
            </div>
            <div className="detail-content" style={{maxWidth: 900, margin: '0 auto', width: '100%'}}>
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
                        {loading ? (
                            <div className="plants-loading">Loading plants...</div>
                        ) : noPlantsAvailable ? (
                            <div className="no-plants">No plants available. Please add plants to the system.</div>
                        ) : (
                            <div className="plant-picker">
                                {plantCodes.length > 0 && (
                                    <div className="plant-picker-chips" aria-label="Selected plants">
                                        {plantCodes.map(code => {
                                            const plant = visiblePlants.find(p => p.plant_code === code)
                                            return (
                                                <span key={code} className="plant-chip">
                                                    <span className="plant-chip-code">{code}</span>
                                                    <span className="plant-chip-name">{plant?.plant_name || ''}</span>
                                                    <button type="button" className="plant-chip-remove" aria-label={`Remove ${code}`} onClick={() => removeChip(code)}>×</button>
                                                </span>
                                            )
                                        })}
                                        <button type="button" className="cancel-button chip-clear-all" onClick={clearAllSelected}>Clear All</button>
                                    </div>
                                )}
                                <div className="plant-picker-actions">
                                    <input
                                        type="text"
                                        className="form-control plant-picker-search"
                                        placeholder="Search by code or name"
                                        value={plantQuery}
                                        onChange={e => setPlantQuery(e.target.value)}
                                        aria-label="Search plants"
                                    />
                                    <div className="plant-picker-meta">
                                        <span className="plant-picker-count">{filteredPlants.length} results</span>
                                        <button type="button" className="primary-button" onClick={selectAllFiltered} disabled={!filteredPlants.length}>Select All Visible</button>
                                    </div>
                                </div>
                                <div className="plant-picker-list" role="listbox" aria-label="All plants">
                                    {filteredPlants.map(p => (
                                        <label key={p.plant_code} className={`plant-item${plantCodes.includes(p.plant_code) ? ' selected' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={plantCodes.includes(p.plant_code)}
                                                onChange={() => togglePlant(p.plant_code)}
                                                aria-label={`Toggle ${p.plant_code}`}
                                            />
                                            <span className="plant-item-code">{p.plant_code}</span>
                                            <span className="plant-item-name">{p.plant_name}</span>
                                        </label>
                                    ))}
                                    {!filteredPlants.length && (
                                        <div className="shuttle-empty">No matches</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="form-actions">
                        <button className="primary-button save-button" onClick={handleSave}
                                disabled={saving || loading || isDeleting}>
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
