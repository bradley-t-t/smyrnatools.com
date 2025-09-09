import React, {useState} from 'react'
import {PickupTruckService} from '../../services/PickupTruckService'
import {AuthService} from '../../services/AuthService'
import '../mixers/styles/MixerAddView.css'
import './styles/PickupTrucksAddView.css'

function PickupTrucksAddView({onClose, onAdded}) {
    const [vin, setVin] = useState('')
    const [make, setMake] = useState('')
    const [model, setModel] = useState('')
    const [year, setYear] = useState('')
    const [assigned, setAssigned] = useState('')
    const [mileage, setMileage] = useState('')
    const [comments, setComments] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setIsSaving(true)
        try {
            const userId = AuthService.currentUser?.id || sessionStorage.getItem('userId')
            if (!userId) throw new Error('User ID not available. Please log in again.')
            const payload = {
                vin: vin || null,
                make: make || null,
                model: model || null,
                year: year || null,
                assigned: assigned || null,
                mileage: mileage === '' ? null : Number(mileage),
                comments: comments || null
            }
            const saved = await PickupTruckService.create(payload, userId)
            onAdded?.(saved)
            onClose?.()
        } catch (err) {
            setError(err?.message || 'Failed to add pickup truck')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="add-mixer-modal-backdrop">
            <div className="add-mixer-modal enhanced pickup-trucks-add">
                <div className="add-mixer-header sticky">
                    <h2>Add Pickup Truck</h2>
                    <button className="ios-button close-btn" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="add-mixer-content-scrollable">
                    <div className="add-mixer-content">
                        {error && <div className="error-message">{error}</div>}
                        <form onSubmit={handleSubmit} autoComplete="off">
                            <div className="form-section">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>VIN</label>
                                        <input type="text" className="ios-input" value={vin}
                                               onChange={e => setVin(e.target.value)} placeholder="Enter VIN"/>
                                    </div>
                                    <div className="form-group">
                                        <label>Year</label>
                                        <input type="text" className="ios-input" value={year}
                                               onChange={e => setYear(e.target.value)} placeholder="Enter year"/>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Make</label>
                                        <input type="text" className="ios-input" value={make}
                                               onChange={e => setMake(e.target.value)} placeholder="Enter make"/>
                                    </div>
                                    <div className="form-group">
                                        <label>Model</label>
                                        <input type="text" className="ios-input" value={model}
                                               onChange={e => setModel(e.target.value)} placeholder="Enter model"/>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Assigned</label>
                                        <input type="text" className="ios-input" value={assigned}
                                               onChange={e => setAssigned(e.target.value)} placeholder="Enter name"/>
                                    </div>
                                    <div className="form-group">
                                        <label>Mileage</label>
                                        <input type="number" className="ios-input" value={mileage}
                                               onChange={e => setMileage(e.target.value)} placeholder="Enter mileage"/>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group wide">
                                        <label>Comments</label>
                                        <textarea className="ios-input" rows={3} value={comments}
                                                  onChange={e => setComments(e.target.value)} placeholder="Notes"/>
                                    </div>
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="ios-button-primary"
                                        disabled={isSaving}>{isSaving ? 'Adding...' : 'Add Pickup'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PickupTrucksAddView
