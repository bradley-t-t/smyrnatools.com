import React, {useState} from 'react'
import {PlantService} from '../../../services/PlantService'
import './styles/PlantsDetailView.css'
import '../mixers/styles/MixerDetailView.css'

function PlantsDetailView({plant, onClose, onDelete}) {
    const [plantName, setPlantName] = useState(plant.plant_name || plant.plantName || '')
    const [plantCode, setPlantCode] = useState(plant.plant_code || plant.plantCode || '')
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState('')

    async function handleSave() {
        setIsSaving(true)
        setMessage('')
        try {
            await PlantService.updatePlant(plantCode, plantName)
            setMessage('Changes saved')
            setTimeout(() => setMessage(''), 2000)
        } catch (e) {
            setMessage('Error saving changes')
            setTimeout(() => setMessage(''), 2000)
        } finally {
            setIsSaving(false)
        }
    }

    async function handleDelete() {
        setDeleteError('')
        setIsDeleting(true)
        try {
            await PlantService.deletePlant(plant.plant_code || plant.plantCode)
            if (onDelete) {
                onDelete(plant.plant_code || plant.plantCode)
            } else {
                onClose()
            }
        } catch (e) {
            setDeleteError('Failed to delete plant')
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="plant-detail-view">
            <div className="detail-header">
                <button className="back-button" onClick={onClose} aria-label="Back to plants">
                    <i className="fas fa-arrow-left"></i>
                    <span>Back</span>
                </button>
                <h1>Plant Details</h1>
            </div>
            <div className="detail-content" style={{maxWidth: 600, margin: '0 auto', width: '100%'}}>
                {message && (
                    <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                        {message}
                    </div>
                )}
                {deleteError && (
                    <div className="message error">
                        {deleteError}
                    </div>
                )}
                <div className="detail-card">
                    <div className="card-header">
                        <h2>Plant Information</h2>
                    </div>
                    <div className="form-group">
                        <label>Plant Code</label>
                        <input
                            type="text"
                            className="form-control"
                            value={plantCode}
                            onChange={e => setPlantCode(e.target.value)}
                            disabled
                        />
                    </div>
                    <div className="form-group">
                        <label>Plant Name</label>
                        <input
                            type="text"
                            className="form-control"
                            value={plantName}
                            onChange={e => setPlantName(e.target.value)}
                        />
                    </div>
                    <div className="form-actions" style={{marginTop: 24, gap: 12}}>
                        <button className="primary-button save-button" onClick={handleSave}
                                disabled={isSaving || isDeleting}>
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button className="cancel-button" onClick={onClose} disabled={isSaving || isDeleting}>
                            Cancel
                        </button>
                        <button
                            className="cancel-button"
                            style={{background: 'var(--danger)', color: 'var(--text-light)'}}
                            onClick={handleDelete}
                            disabled={isSaving || isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PlantsDetailView
