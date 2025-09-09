import React, {useEffect, useState} from 'react'
import {PickupTruckService} from '../../services/PickupTruckService'
import '../mixers/styles/MixerDetailView.css'
import LoadingScreen from '../common/LoadingScreen'
import {PlantService} from '../../services/PlantService'

function PickupTrucksDetailView({pickupId, onClose}) {
    const [pickup, setPickup] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [vin, setVin] = useState('')
    const [make, setMake] = useState('')
    const [model, setModel] = useState('')
    const [year, setYear] = useState('')
    const [assigned, setAssigned] = useState('')
    const [assignedPlant, setAssignedPlant] = useState('')
    const [status, setStatus] = useState('')
    const [mileage, setMileage] = useState('')
    const [comments, setComments] = useState('')
    const [plants, setPlants] = useState([])

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true)
            try {
                const data = await PickupTruckService.getById(pickupId)
                setPickup(data)
                setVin(data?.vin || '')
                setMake(data?.make || '')
                setModel(data?.model || '')
                setYear(data?.year || '')
                setAssigned(data?.assigned || '')
                setAssignedPlant(data?.assignedPlant || '')
                setStatus(data?.status || '')
                setMileage(data?.mileage ?? '')
                setComments(data?.comments || '')
            } catch {
                setPickup(null)
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [pickupId])

    useEffect(() => {
        async function loadPlants() {
            try {
                const data = await PlantService.fetchPlants()
                setPlants(Array.isArray(data) ? data : [])
            } catch {
                setPlants([])
            }
        }
        loadPlants()
    }, [])

    async function handleSave() {
        if (!pickup?.id) return
        setIsSaving(true)
        try {
            const payload = {
                vin: vin || null,
                make: make || null,
                model: model || null,
                year: year || null,
                assigned: assigned || null,
                assignedPlant: assignedPlant || null,
                status: status || null,
                mileage: mileage === '' ? null : Number(mileage),
                comments: comments || null
            }
            const updated = await PickupTruckService.update(pickup.id, payload)
            setPickup(updated)
            setMessage('Changes saved')
            setTimeout(() => setMessage(''), 3000)
        } catch (e) {
            setMessage(e?.message || 'Error saving changes')
            setTimeout(() => setMessage(''), 4000)
        } finally {
            setIsSaving(false)
        }
    }

    async function handleDelete() {
        if (!pickup?.id) return
        try {
            await PickupTruckService.remove(pickup.id)
            onClose?.()
        } catch {}
    }

    function handleExportEmail() {
        if (!pickup) return
        const summary = `Pickup Truck Summary\n\nBasic Information\nAssigned: ${assigned || ''}\nAssigned Plant: ${assignedPlant || ''}\nStatus: ${status || ''}\nVIN: ${vin || ''}\nMake: ${make || ''}\nModel: ${model || ''}\nYear: ${year || ''}\nMileage: ${mileage || ''}\n\nComments\n${comments || 'No comments.'}\n`
        const subject = encodeURIComponent('Pickup Truck Summary')
        const body = encodeURIComponent(summary)
        window.location.href = `mailto:?subject=${subject}&body=${body}`
    }

    if (isLoading) {
        return (
            <div className="mixer-detail-view">
                <div className="detail-header" style={{backgroundColor: 'var(--detail-header-bg)', color: 'var(--text-primary)'}}>
                    <button className="back-button" onClick={onClose}><i className="fas fa-arrow-left"></i></button>
                    <h1>Pickup Details</h1>
                    <div style={{width: '36px'}}></div>
                </div>
                <div className="detail-content">
                    <LoadingScreen message="Loading pickup details..." inline={true}/>
                </div>
            </div>
        )
    }

    if (!pickup) {
        return (
            <div className="mixer-detail-view">
                <div className="detail-header" style={{backgroundColor: 'var(--detail-header-bg)', color: 'var(--text-primary)'}}>
                    <button className="back-button" onClick={onClose}><i className="fas fa-arrow-left"></i></button>
                    <h1>Pickup Not Found</h1>
                </div>
                <div className="error-message">
                    <p>Could not find the requested pickup.</p>
                    <button className="primary-button" onClick={onClose}>Return</button>
                </div>
            </div>
        )
    }

    return (
        <div className="mixer-detail-view">
            {isSaving && (
                <div className="saving-overlay"><div className="saving-indicator"></div></div>
            )}
            <div className="detail-header" style={{backgroundColor: 'var(--detail-header-bg)', color: 'var(--text-primary)'}}>
                <div className="header-left">
                    <button className="back-button" onClick={onClose} aria-label="Back"><i className="fas fa-arrow-left"></i><span>Back</span></button>
                </div>
                <h1>Pickup {assigned ? `- ${assigned}` : ''}</h1>
                <div className="header-actions">
                    <button className="issues-button" style={{marginRight: 0}} onClick={handleExportEmail}><i className="fas fa-envelope"></i> Email</button>
                </div>
            </div>
            <div className="detail-content" style={{maxWidth: '1000px', margin: '0 auto', overflow: 'visible'}}>
                {message && (<div className={`message ${message.toLowerCase().includes('error') ? 'error' : 'success'}`}>{message}</div>)}
                <div className="detail-card">
                    <div className="card-header"><h2>Pickup Information</h2></div>
                    <p className="edit-instructions">You can make changes below. Remember to save your changes.</p>
                    <div className="form-sections" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20}}>
                        <div className="form-section basic-info">
                            <h3>Basic Information</h3>
                            <div className="form-group"><label>Assigned Plant</label><select value={assignedPlant} onChange={e => setAssignedPlant(e.target.value)} className="form-control"><option value="">Select Plant</option>{plants.map(p => (<option key={p.plantCode || p.plant_code} value={p.plantCode || p.plant_code}>{(p.plantCode || p.plant_code) + ' ' + (p.plantName || p.plant_name)}</option>))}</select></div>
                            <div className="form-group"><label>Status</label><select value={status} onChange={e => setStatus(e.target.value)} className="form-control"><option value="">Select Status</option><option value="Active">Active</option><option value="Spare">Spare</option><option value="In Shop">In Shop</option><option value="Retired">Retired</option></select></div>
                            <div className="form-group"><label>Assigned</label><input type="text" value={assigned} onChange={e => setAssigned(e.target.value)} className="form-control"/></div>
                            <div className="form-group"><label>Mileage</label><input type="number" value={mileage} onChange={e => setMileage(e.target.value)} className="form-control"/></div>
                        </div>
                        <div className="form-section vehicle-info">
                            <h3>Asset Details</h3>
                            <div className="form-group"><label>VIN</label><input type="text" value={vin} onChange={e => setVin(e.target.value)} className="form-control"/></div>
                            <div className="form-group"><label>Make</label><input type="text" value={make} onChange={e => setMake(e.target.value)} className="form-control"/></div>
                            <div className="form-group"><label>Model</label><input type="text" value={model} onChange={e => setModel(e.target.value)} className="form-control"/></div>
                            <div className="form-group"><label>Year</label><input type="text" value={year} onChange={e => setYear(e.target.value)} className="form-control"/></div>
                            <div className="form-group"><label>Comments</label><textarea value={comments} onChange={e => setComments(e.target.value)} className="form-control" rows={3}/></div>
                        </div>
                    </div>
                </div>
                <div className="form-actions">
                    <button className="primary-button save-button" onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
                    <button className="danger-button" onClick={handleDelete} disabled={isSaving}>Delete Pickup</button>
                </div>
            </div>
        </div>
    )
}

export default PickupTrucksDetailView
