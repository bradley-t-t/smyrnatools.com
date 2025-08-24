import React, {useState} from 'react'
import {PlantService} from '../../services/PlantService'
import './styles/PlantsAddView.css'

function PlantsAddView({onClose, onPlantAdded}) {
    const [plantCode, setPlantCode] = useState('')
    const [plantName, setPlantName] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        if (!plantCode) return setError('Plant code is required')
        if (!plantName) return setError('Plant name is required')
        setIsSaving(true)
        try {
            await PlantService.createPlant(plantCode, plantName)
            const allPlants = await PlantService.fetchPlants()
            const newPlant = allPlants.find(
                p =>
                    (p.plant_code || p.plantCode) === plantCode.trim()
            )
            if (newPlant) {
                onPlantAdded(newPlant)
            } else {
                onPlantAdded({
                    plant_code: plantCode.trim(),
                    plant_name: plantName.trim()
                })
            }
            onClose()
        } catch (err) {
            if (err?.message && (err.message.includes('duplicate key value') || (err.details && err.details.includes('duplicate key value')))) {
                setError('A plant with this code already exists, or there was a database error. Please check for leading/trailing spaces or try a different code.')
            } else {
                setError(`Failed to add plant: ${err.message || 'Unknown error'}`)
            }
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="add-plant-modal-backdrop">
            <div className="add-plant-modal enhanced">
                <div className="add-plant-header sticky">
                    <h2>Add New Plant</h2>
                    <button className="ios-button close-btn" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="add-plant-content-scrollable">
                    <div className="add-plant-content">
                        {error && <div className="error-message">{error}</div>}
                        <form onSubmit={handleSubmit} autoComplete="off">
                            <div className="form-section">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="plantCode">Plant Code*</label>
                                        <input
                                            id="plantCode"
                                            type="text"
                                            className="ios-input"
                                            value={plantCode}
                                            onChange={e => setPlantCode(e.target.value)}
                                            placeholder="Enter plant code"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="plantName">Plant Name*</label>
                                        <input
                                            id="plantName"
                                            type="text"
                                            className="ios-input"
                                            value={plantName}
                                            onChange={e => setPlantName(e.target.value)}
                                            placeholder="Enter plant name"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="ios-button-primary" disabled={isSaving}>
                                    {isSaving ? 'Adding...' : 'Add Plant'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PlantsAddView
