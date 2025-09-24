import React, {useEffect, useMemo, useState} from 'react'
import {MixerService} from '../../services/MixerService'
import {PlantService} from '../../services/PlantService'
import {OperatorService} from '../../services/OperatorService'
import {UserService} from '../../services/UserService'
import {usePreferences} from '../../app/context/PreferencesContext'
import MixerHistoryView from './MixerHistoryView'
import MixerCommentModal from './MixerCommentModal'
import MixerIssueModal from './MixerIssueModal'
import OperatorSelectModal from './OperatorSelectModal'
import './styles/MixerDetailView.css'
import MixerUtility from '../../utils/MixerUtility'
import {Mixer} from "../../config/models/mixers/Mixer"
import LoadingScreen from "../common/LoadingScreen"
import {RegionService} from '../../services/RegionService'

function MixerDetailView({mixerId, onClose}) {
    const {preferences} = usePreferences()
    const [mixer, setMixer] = useState(null)
    const [operators, setOperators] = useState([])
    const [plants, setPlants] = useState([])
    const [mixers, setMixers] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [showHistory, setShowHistory] = useState(false)
    const [showComments, setShowComments] = useState(false)
    const [showIssues, setShowIssues] = useState(false)
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [updatedByEmail, setUpdatedByEmail] = useState(null)
    const [message, setMessage] = useState('')
    const [showOperatorModal, setShowOperatorModal] = useState(false)
    const [canEditMixer, setCanEditMixer] = useState(true)
    const [plantRestrictionReason, setPlantRestrictionReason] = useState('')
    const [originalValues, setOriginalValues] = useState({})
    const [truckNumber, setTruckNumber] = useState('')
    const [assignedOperator, setAssignedOperator] = useState('')
    const [assignedPlant, setAssignedPlant] = useState('')
    const [status, setStatus] = useState('')
    const [cleanlinessRating, setCleanlinessRating] = useState(0)
    const [lastServiceDate, setLastServiceDate] = useState(null)
    const [lastChipDate, setLastChipDate] = useState(null)
    const [vin, setVin] = useState('')
    const [make, setMake] = useState('')
    const [model, setModel] = useState('')
    const [year, setYear] = useState('')
    const [operatorModalOperators, setOperatorModalOperators] = useState([])
    const [lastUnassignedOperatorId, setLastUnassignedOperatorId] = useState(null)
    const [comments, setComments] = useState([])
    const [issues, setIssues] = useState([])
    const [regionPlantCodes, setRegionPlantCodes] = useState(new Set())
    const [showMissingFieldsModal, setShowMissingFieldsModal] = useState(false)
    const [missingFields, setMissingFields] = useState([])

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true)
            try {
                const [mixerData, operatorsData, plantsData, allMixers] = await Promise.all([
                    MixerService.fetchMixerById(mixerId),
                    OperatorService.fetchOperators(),
                    PlantService.fetchPlants(),
                    MixerService.getAllMixers()
                ])
                setMixer(mixerData)
                setOperators(operatorsData)
                setPlants(plantsData)
                setMixers(allMixers)
                setTruckNumber(mixerData.truckNumber || '')
                setAssignedOperator(mixerData.assignedOperator || '')
                setAssignedPlant(mixerData.assignedPlant || '')
                setStatus(mixerData.status || '')
                setCleanlinessRating(mixerData.cleanlinessRating || 0)
                setLastServiceDate(mixerData.lastServiceDate ? new Date(mixerData.lastServiceDate) : null)
                setLastChipDate(mixerData.lastChipDate ? new Date(mixerData.lastChipDate) : null)
                setVin(mixerData.vin || '')
                setMake(mixerData.make || '')
                setModel(mixerData.model || '')
                setYear(mixerData.year || '')
                setOriginalValues({
                    truckNumber: mixerData.truckNumber || '',
                    assignedOperator: mixerData.assignedOperator || '',
                    assignedPlant: mixerData.assignedPlant || '',
                    status: mixerData.status || '',
                    cleanlinessRating: mixerData.cleanlinessRating || 0,
                    lastServiceDate: mixerData.lastServiceDate ? new Date(mixerData.lastServiceDate) : null,
                    lastChipDate: mixerData.lastChipDate ? new Date(mixerData.lastChipDate) : null,
                    vin: mixerData.vin || '',
                    make: mixerData.make || '',
                    model: mixerData.model || '',
                    year: mixerData.year || ''
                })
                document.documentElement.style.setProperty('--rating-value', mixerData.cleanlinessRating || 0)
                if (mixerData.updatedBy) {
                    try {
                        const userName = await UserService.getUserDisplayName(mixerData.updatedBy)
                        setUpdatedByEmail(userName)
                    } catch {
                        setUpdatedByEmail('Unknown User')
                    }
                }
            } catch (error) {
            } finally {
                setIsLoading(false)
                setHasUnsavedChanges(false)
            }
        }

        fetchData()
    }, [mixerId])

    useEffect(() => {
        let cancelled = false

        async function loadAllowedPlants() {
            let regionCode = preferences.selectedRegion?.code || ''
            try {
                if (!regionCode) {
                    const user = await UserService.getCurrentUser()
                    const uid = user?.id || ''
                    if (uid) {
                        const profilePlant = await UserService.getUserPlant(uid)
                        const plantCode = typeof profilePlant === 'string' ? profilePlant : (profilePlant?.plant_code || profilePlant?.plantCode || '')
                        if (plantCode) {
                            const regions = await RegionService.fetchRegionsByPlantCode(plantCode)
                            const r = Array.isArray(regions) && regions.length ? regions[0] : null
                            regionCode = r ? (r.regionCode || r.region_code || '') : ''
                        }
                    }
                }
                if (!regionCode) {
                    if (!cancelled) setRegionPlantCodes(new Set())
                    return
                }
                const regionPlants = await RegionService.fetchRegionPlants(regionCode)
                if (cancelled) return
                const codes = new Set(regionPlants.map(p => String(p.plantCode || p.plant_code || '').trim().toUpperCase()).filter(Boolean))
                setRegionPlantCodes(codes)
            } catch {
                if (!cancelled) setRegionPlantCodes(new Set())
            }
        }

        loadAllowedPlants()
        return () => {
            cancelled = true
        }
    }, [preferences.selectedRegion?.code])

    const filteredPlants = useMemo(() => {
        if (!regionPlantCodes || regionPlantCodes.size === 0) return []
        return plants.filter(p => regionPlantCodes.has(String(p.plantCode || p.plant_code || '').trim().toUpperCase()))
    }, [plants, regionPlantCodes])

    useEffect(() => {
        async function checkPlantRestriction() {
            if (isLoading || !mixer) return
            try {
                const user = await UserService.getCurrentUser()
                const userId = typeof user === 'object' && user?.id ? user.id : user
                if (!userId) return
                const {allowed, reason} = await UserService.canEditMixerForPlant(userId, mixer.assignedPlant)
                setCanEditMixer(!!allowed)
                setPlantRestrictionReason(reason || '')
            } catch (error) {
            }
        }

        checkPlantRestriction()
    }, [mixer, isLoading])

    useEffect(() => {
        if (!originalValues.truckNumber || isLoading) return
        const formatDateForComparison = date => date ? (date instanceof Date ? date.toISOString() : date) : ''
        const hasChanges =
            truckNumber !== originalValues.truckNumber ||
            assignedPlant !== originalValues.assignedPlant ||
            status !== originalValues.status ||
            cleanlinessRating !== originalValues.cleanlinessRating ||
            formatDateForComparison(lastServiceDate) !== formatDateForComparison(originalValues.lastServiceDate) ||
            formatDateForComparison(lastChipDate) !== formatDateForComparison(originalValues.lastChipDate) ||
            vin !== originalValues.vin ||
            make !== originalValues.make ||
            model !== originalValues.model ||
            year !== originalValues.year
        setHasUnsavedChanges(hasChanges)
    }, [truckNumber, assignedPlant, status, cleanlinessRating, lastServiceDate, lastChipDate, vin, make, model, year, originalValues, isLoading])

    async function handleSave(overrideValues = {}) {
        if (!mixer?.id) {
            alert('Error: Cannot save mixer with undefined ID')
            return
        }
        setIsSaving(true)
        try {
            let userObj = await UserService.getCurrentUser()
            let userId = typeof userObj === 'object' && userObj !== null ? userObj.id : userObj
            const formatDate = date => {
                if (!date) return null
                const parsedDate = date instanceof Date ? date : new Date(date)
                if (isNaN(parsedDate.getTime())) return null
                return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')} ${String(parsedDate.getHours()).padStart(2, '0')}:${String(parsedDate.getMinutes()).padStart(2, '0')}:${String(parsedDate.getSeconds()).padStart(2, '0')}+00`
            }
            let assignedOperatorValue = Object.prototype.hasOwnProperty.call(overrideValues, 'assignedOperator')
                ? overrideValues.assignedOperator
                : assignedOperator
            let statusValue = Object.prototype.hasOwnProperty.call(overrideValues, 'status')
                ? overrideValues.status
                : status
            if (originalValues.status === 'Active' && statusValue !== 'Active' && assignedOperatorValue) {
                assignedOperatorValue = null
            }
            if (assignedOperatorValue && statusValue !== 'Active') {
                statusValue = 'Active'
            }
            if ((!assignedOperatorValue || assignedOperatorValue === '' || assignedOperatorValue === null) && statusValue === 'Active') {
                statusValue = 'Spare'
            }
            let mixerForHistory = {
                ...mixer,
                assignedOperator: Object.prototype.hasOwnProperty.call(overrideValues, 'prevAssignedOperator')
                    ? overrideValues.prevAssignedOperator
                    : mixer.assignedOperator
            }
            const updatedMixer = {
                ...mixer,
                id: mixer.id,
                truckNumber: overrideValues.truckNumber ?? truckNumber,
                assignedOperator: assignedOperatorValue || null,
                assignedPlant: overrideValues.assignedPlant ?? assignedPlant,
                status: statusValue,
                cleanlinessRating: (overrideValues.cleanlinessRating ?? cleanlinessRating) || null,
                lastServiceDate: formatDate(overrideValues.lastServiceDate ?? lastServiceDate),
                lastChipDate: formatDate(overrideValues.lastChipDate ?? lastChipDate),
                vin: overrideValues.vin ?? vin,
                make: overrideValues.make ?? make,
                model: overrideValues.model ?? model,
                year: overrideValues.year ?? year,
                updatedAt: new Date().toISOString(),
                updatedBy: userId,
                updatedLast: mixer.updatedLast
            }
            await MixerService.updateMixer(
                updatedMixer.id,
                updatedMixer,
                undefined,
                mixerForHistory
            )
            setMixer(updatedMixer)
            setMessage('Changes saved successfully! Mixer needs verification.')
            setTimeout(() => setMessage(''), 5000)
            setOriginalValues({
                truckNumber: updatedMixer.truckNumber,
                assignedOperator: updatedMixer.assignedOperator,
                assignedPlant: updatedMixer.assignedPlant,
                status: updatedMixer.status,
                cleanlinessRating: updatedMixer.cleanlinessRating,
                lastServiceDate: updatedMixer.lastServiceDate ? new Date(updatedMixer.lastServiceDate) : null,
                lastChipDate: updatedMixer.lastChipDate ? new Date(updatedMixer.lastChipDate) : null,
                vin: updatedMixer.vin,
                make: updatedMixer.make,
                model: updatedMixer.model,
                year: updatedMixer.year
            })
            setHasUnsavedChanges(false)
        } catch (error) {
            alert(`Error saving changes: ${error.message || 'Unknown error'}`)
        } finally {
            setIsSaving(false)
        }
    }

    async function handleDelete() {
        if (!mixer) return
        if (!showDeleteConfirmation) return setShowDeleteConfirmation(true)
        try {
            await MixerService.deleteMixer(mixer.id)
            alert('Mixer deleted successfully')
            onClose()
        } catch (error) {
            alert('Error deleting mixer')
        } finally {
            setShowDeleteConfirmation(false)
        }
    }

    async function handleVerifyMixer() {
        if (!mixer.vin || !mixer.make || !mixer.model || !mixer.year) {
            let missing = []
            if (!mixer.vin) missing.push('VIN')
            if (!mixer.make) missing.push('Make')
            if (!mixer.model) missing.push('Model')
            if (!mixer.year) missing.push('Year')
            setMissingFields(missing)
            setShowMissingFieldsModal(true)
            return
        }
        const operatorName = getOperatorName(assignedOperator)
        if (
            status === 'Active' &&
            (
                assignedOperator === null ||
                assignedOperator === undefined ||
                assignedOperator === '0' ||
                (assignedOperator && operatorName === 'Unknown')
            )
        ) {
            setMessage('Cannot verify: Assigned operator is missing or invalid.')
            setTimeout(() => setMessage(''), 4000)
            return
        }
        setIsSaving(true)
        try {
            if (hasUnsavedChanges) {
                await handleSave().catch(() => {
                    alert('Failed to save your changes before verification. Please try saving manually first.')
                    throw new Error('Failed to save changes before verification')
                })
            }
            let userObj = await UserService.getCurrentUser()
            let userId = typeof userObj === 'object' && userObj !== null ? userObj.id : userObj
            const verified = await MixerService.verifyMixer(mixer.id, userId)
            setMixer(verified)
            setMessage('Mixer verified successfully!')
            setTimeout(() => setMessage(''), 3000)
            setHasUnsavedChanges(false)
            if (verified.updatedBy) {
                try {
                    const userName = await UserService.getUserDisplayName(verified.updatedBy)
                    setUpdatedByEmail(userName)
                } catch {
                    setUpdatedByEmail('Unknown User')
                }
            }
        } catch (error) {
            alert(`Error verifying mixer: ${error.message}`)
        } finally {
            setIsSaving(false)
        }
    }

    async function handleSaveMissingFields() {
        try {
            const needVin = !mixer.vin
            const needMake = !mixer.make
            const needModel = !mixer.model
            const needYear = !mixer.year
            const vinOk = needVin ? !!String(vin).trim() : true
            const makeOk = needMake ? !!String(make).trim() : true
            const modelOk = needModel ? !!String(model).trim() : true
            const yearOk = needYear ? !!String(year).trim() : true
            if (!(vinOk && makeOk && modelOk && yearOk)) {
                setMessage('Please fill all required fields before verifying.')
                setTimeout(() => setMessage(''), 4000)
                return
            }
            const overrides = {}
            if (needVin) overrides.vin = String(vin).trim()
            if (needMake) overrides.make = String(make).trim()
            if (needModel) overrides.model = String(model).trim()
            if (needYear) overrides.year = String(year).trim()
            await handleSave(overrides)
            const candidateMixer = {
                ...mixer,
                vin: overrides.vin ?? mixer.vin,
                make: overrides.make ?? mixer.make,
                model: overrides.model ?? mixer.model,
                year: overrides.year ?? mixer.year
            }
            const operatorName = getOperatorName(assignedOperator)
            if (
                status === 'Active' &&
                (
                    assignedOperator === null ||
                    assignedOperator === undefined ||
                    assignedOperator === '0' ||
                    (assignedOperator && operatorName === 'Unknown')
                )
            ) {
                setMessage('Cannot verify: Assigned operator is missing or invalid.')
                setTimeout(() => setMessage(''), 4000)
                return
            }
            let userObj = await UserService.getCurrentUser()
            let userId = typeof userObj === 'object' && userObj !== null ? userObj.id : userObj
            const verified = await MixerService.verifyMixer(candidateMixer.id, userId)
            setMixer(verified)
            setMessage('Mixer verified successfully!')
            setTimeout(() => setMessage(''), 3000)
            setHasUnsavedChanges(false)
            setShowMissingFieldsModal(false)
            setMissingFields([])
            if (verified.updatedBy) {
                try {
                    const userName = await UserService.getUserDisplayName(verified.updatedBy)
                    setUpdatedByEmail(userName)
                } catch {
                    setUpdatedByEmail('Unknown User')
                }
            }
        } catch (error) {
            alert('Failed to save missing fields. Please try again.')
        }
    }

    async function handleBackClick() {
        if (hasUnsavedChanges) {
            await handleSave()
        }
        onClose()
    }

    function getOperatorName(operatorId) {
        if (!operatorId || operatorId === '0') return 'None'
        const operator = operators.find(op => op.employeeId === operatorId)
        return operator ? (operator.position ? `${operator.name} (${operator.position})` : operator.name) : 'Unknown'
    }

    function getPlantName(plantCode) {
        const plant = plants.find(p => p.plantCode === plantCode)
        return plant ? plant.plantName : plantCode
    }

    function formatDate(date) {
        if (!date) return ''
        return date instanceof Date ? date.toISOString().split('T')[0] : date
    }

    async function fetchOperatorsForModal() {
        let dbOperators = await OperatorService.fetchOperators()
        if (lastUnassignedOperatorId) {
            const unassignedOperator = dbOperators.find(op => op.employeeId === lastUnassignedOperatorId)
            if (unassignedOperator) {
                dbOperators = [...dbOperators, unassignedOperator]
            }
        }
        setOperatorModalOperators(dbOperators)
    }

    async function refreshOperators() {
        const updatedOperators = await OperatorService.fetchOperators()
        setOperators(updatedOperators)
    }

    useEffect(() => {
        async function fetchCommentsAndIssues() {
            if (!mixerId) return
            try {
                const [commentData, issueData] = await Promise.all([
                    MixerService.fetchComments(mixerId).catch(() => []),
                    MixerService.fetchIssues(mixerId).catch(() => [])
                ])
                const normalizedComments = Array.isArray(commentData) ? commentData.map(c => ({
                    id: c.id,
                    author: c.author,
                    text: c.text,
                    created_at: c.createdAt || c.created_at
                })) : []
                setComments(normalizedComments)
                setIssues(Array.isArray(issueData) ? issueData.filter(i => i && (i.issue || i.title || i.description)) : [])
            } catch {
                setComments([])
                setIssues([])
            }
        }

        fetchCommentsAndIssues()
    }, [mixerId])

    function handleExportEmail() {
        if (!mixer) return
        const hasComments = comments && comments.length > 0
        const openIssues = (issues || []).filter(issue => !issue.time_completed)
        let summary = `Mixer Summary for Truck #${mixer.truckNumber || ''}\n\nBasic Information\nStatus: ${mixer.status || ''}\nAssigned Plant: ${getPlantName(mixer.assignedPlant)}\nAssigned Operator: ${getOperatorName(mixer.assignedOperator)}\nCleanliness Rating: ${mixer.cleanlinessRating || 'N/A'}\nLast Service Date: ${mixer.lastServiceDate ? new Date(mixer.lastServiceDate).toLocaleDateString() : 'N/A'}\nLast Chip Date: ${mixer.lastChipDate ? new Date(mixer.lastChipDate).toLocaleDateString() : 'N/A'}\nVIN: ${mixer.vin || ''}\nMake: ${mixer.make || ''}\nModel: ${mixer.model || ''}\nYear: ${mixer.year || ''}\n\nComments\n${hasComments
            ? comments.map(c =>
                `- ${c.author || 'Unknown'}: ${c.text || ''} (${new Date(c.created_at).toLocaleString()})`
            ).join('\n')
            : 'No comments.'}\n\nIssues (${openIssues.length})\n${openIssues.length > 0
            ? openIssues.map(i =>
                `- ${i.issue || i.title || i.description || ''} (${new Date(i.time_created || i.created_at).toLocaleString()})`
            ).join('\n')
            : 'No open issues.'}\n`
        const subject = encodeURIComponent(`Mixer Summary for Truck #${mixer.truckNumber || ''}`)
        const body = encodeURIComponent(summary)
        window.location.href = `mailto:?subject=${subject}&body=${body}`
    }

    if (isLoading) {
        return (
            <div className="operator-detail-view">
                <div className="detail-header" style={{
                    backgroundColor: 'var(--detail-header-bg)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px'
                }}>
                    <button className="back-button" onClick={onClose} style={{marginRight: '8px'}}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h1 style={{color: 'var(--text-primary)', textAlign: 'center', flex: 1, margin: '0 auto'}}>Mixer
                        Details</h1>
                    <div style={{width: '36px'}}></div>
                </div>
                <div className="detail-content">
                    <LoadingScreen message="Loading mixer details..." inline={true}/>
                </div>
            </div>
        )
    }

    if (!mixer) {
        return (
            <div className="mixer-detail-view">
                <div className="detail-header"
                     style={{backgroundColor: 'var(--detail-header-bg)', color: 'var(--text-primary)'}}>
                    <button className="back-button" onClick={onClose}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h1>Mixer Not Found</h1>
                </div>
                <div className="error-message">
                    <p>Could not find the requested mixer. It may have been deleted.</p>
                    <button className="primary-button" onClick={onClose}>Return to Mixers</button>
                </div>
            </div>
        )
    }

    const assignedPlantInRegion = assignedPlant && regionPlantCodes.has(String(assignedPlant).trim().toUpperCase())

    const canSubmitMissing = missingFields.every(f => {
        if (f === 'VIN') return !!String(vin).trim()
        if (f === 'Make') return !!String(make).trim()
        if (f === 'Model') return !!String(model).trim()
        if (f === 'Year') return !!String(year).trim()
        return true
    })

    return (
        <div className="mixer-detail-view">
            {showComments && <MixerCommentModal mixerId={mixerId} mixerNumber={mixer?.truckNumber}
                                                onClose={() => setShowComments(false)}/>}
            {showIssues && <MixerIssueModal mixerId={mixerId} mixerNumber={mixer?.truckNumber}
                                            onClose={() => setShowIssues(false)}/>}
            {isSaving && (
                <div className="saving-overlay">
                    <div className="saving-indicator"></div>
                </div>
            )}
            <div className="detail-header"
                 style={{backgroundColor: 'var(--detail-header-bg)', color: 'var(--text-primary)'}}>
                <div className="header-left">
                    <button className="back-button" onClick={handleBackClick} aria-label="Back to mixers">
                        <i className="fas fa-arrow-left"></i>
                        <span>Back</span>
                    </button>
                </div>
                <h1>Truck #{mixer.truckNumber || 'Not Assigned'}</h1>
                <div className="header-actions">
                    <button className="issues-button" style={{marginRight: 0}} onClick={handleExportEmail}>
                        <i className="fas fa-envelope"></i> Email
                    </button>
                    {canEditMixer && (
                        <>
                            <button className="issues-button" onClick={() => setShowIssues(true)}>
                                <i className="fas fa-tools"></i> Issues
                            </button>
                            <button className="comments-button" onClick={() => setShowComments(true)}>
                                <i className="fas fa-comments"></i> Comments
                            </button>
                        </>
                    )}
                    <button className="history-button" onClick={() => setShowHistory(true)}>
                        <i className="fas fa-history"></i>
                        <span>History</span>
                    </button>
                </div>
            </div>
            {!canEditMixer && (
                <div className="plant-restriction-warning">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span>{plantRestrictionReason}</span>
                </div>
            )}
            <div className="detail-content" style={{maxWidth: '1000px', margin: '0 auto', overflow: 'visible'}}>
                {message && (
                    <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                        {message}
                    </div>
                )}
                <div className="detail-card">
                    <div className="card-header">
                        <h2>Verification Status</h2>
                    </div>
                    <div className="verification-card">
                        <div className="verification-card-header">
                            <i className="fas fa-clipboard-check"></i>
                            {Mixer.ensureInstance(mixer).isVerified() ? (
                                <div className="verification-badge verified">
                                    <i className="fas fa-check-circle"></i>
                                    <span>Verified</span>
                                </div>
                            ) : (
                                <div className="verification-badge needs-verification">
                                    <i className="fas fa-exclamation-circle"></i>
                                    <span>{!mixer.updatedLast || !mixer.updatedBy ? 'Needs Verification' : 'Verification Outdated'}</span>
                                </div>
                            )}
                        </div>
                        <div className="verification-details">
                            <div className="verification-item">
                                <div className="verification-icon">
                                    <i className="fas fa-calendar-plus"></i>
                                </div>
                                <div className="verification-info">
                                    <span className="verification-label">Created</span>
                                    <span
                                        className="verification-value">{mixer.createdAt ? new Date(mixer.createdAt).toLocaleString() : 'Not Assigned'}</span>
                                </div>
                            </div>
                            <div className="verification-item"
                                 style={{color: mixer.updatedLast ? (Mixer.ensureInstance(mixer).isVerified() ? 'var(--success)' : new Date(mixer.updatedAt) > new Date(mixer.updatedLast) ? 'var(--error)' : 'var(--warning)') : 'var(--error)'}}>
                                <div className="verification-icon"
                                     style={{color: mixer.updatedLast ? (Mixer.ensureInstance(mixer).isVerified() ? 'var(--success)' : new Date(mixer.updatedAt) > new Date(mixer.updatedLast) ? 'var(--error)' : 'var(--warning)') : 'var(--error)'}}>
                                    <i className="fas fa-calendar-check"></i>
                                </div>
                                <div className="verification-info">
                                    <span className="verification-label">Last Verified</span>
                                    <span className="verification-value"
                                          style={{color: mixer.updatedLast ? (Mixer.ensureInstance(mixer).isVerified() ? 'inherit' : new Date(mixer.updatedAt) > new Date(mixer.updatedLast) ? 'var(--error)' : 'var(--warning)') : 'var(--error)'}}>
                                        {mixer.updatedLast ? `${new Date(mixer.updatedLast).toLocaleString()}${!Mixer.ensureInstance(mixer).isVerified() ? (new Date(mixer.updatedAt) > new Date(mixer.updatedLast) ? ' (Changes have been made)' : ' (It is a new week)') : ''}` : 'Never verified'}
                                    </span>
                                </div>
                            </div>
                            <div className="verification-item"
                                 title={`Last Updated: ${new Date(mixer.updatedAt).toLocaleString()}`}>
                                <div className="verification-icon"
                                     style={{color: mixer.updatedBy ? 'var(--success)' : 'var(--error)'}}>
                                    <i className="fas fa-user-check"></i>
                                </div>
                                <div className="verification-info">
                                    <span className="verification-label">Verified By</span>
                                    <span className="verification-value"
                                          style={{color: mixer.updatedBy ? 'inherit' : 'var(--error)'}}>{mixer.updatedBy ? (updatedByEmail || 'Unknown User') : 'No verification record'}</span>
                                </div>
                            </div>
                        </div>
                        <button className="verify-now-button" onClick={handleVerifyMixer} disabled={!canEditMixer}>
                            <i className="fas fa-check-circle"></i> Verify Now
                        </button>
                        {showMissingFieldsModal && (
                            <div className="modal-overlay">
                                <div className="modal-content">
                                    <h3>Missing Required Information</h3>
                                    <p>Please enter the following missing fields to verify this asset:</p>
                                    <ul>
                                        {missingFields.map(field => <li key={field}>{field}</li>)}
                                    </ul>
                                    {!mixer.vin && <input type="text" placeholder="VIN" value={vin}
                                                          onChange={e => setVin(e.target.value)}/>}
                                    {!mixer.make && <input type="text" placeholder="Make" value={make}
                                                           onChange={e => setMake(e.target.value)}/>}
                                    {!mixer.model && <input type="text" placeholder="Model" value={model}
                                                            onChange={e => setModel(e.target.value)}/>}
                                    {!mixer.year && <input type="text" placeholder="Year" value={year}
                                                           onChange={e => setYear(e.target.value)}/>}
                                    <button type="button" onClick={handleSaveMissingFields}
                                            disabled={!canSubmitMissing}>Save & Verify
                                    </button>
                                    <button type="button" onClick={() => setShowMissingFieldsModal(false)}>Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="verification-notice">
                            <i className="fas fa-info-circle"></i>
                            <p>Assets require verification after any changes are made and are reset weekly. <strong>Due:
                                Every Friday at 10:00 AM.</strong> Resets on Mondays at 5pm.</p>
                        </div>
                    </div>
                </div>
                <div className="detail-card">
                    <div className="card-header">
                        <h2>Mixer Information</h2>
                    </div>
                    <p className="edit-instructions">{canEditMixer ? 'You can make changes below. Remember to save your changes.' : 'You are in read-only mode and cannot make changes to this mixer.'}</p>
                    <div className="form-sections">
                        <div className="form-section basic-info">
                            <h3>Basic Information</h3>
                            <div className="form-group">
                                <label>Truck Number</label>
                                <input type="text" value={truckNumber} onChange={e => setTruckNumber(e.target.value)}
                                       className="form-control" readOnly={!canEditMixer}/>
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    value={status}
                                    onChange={async e => {
                                        const newStatus = e.target.value
                                        if (assignedOperator && originalValues.status === 'Active' && newStatus !== 'Active') {
                                            await handleSave({status: newStatus, assignedOperator: null})
                                            setStatus(newStatus)
                                            setAssignedOperator(null)
                                            setLastUnassignedOperatorId(assignedOperator)
                                            setMessage('Status changed and operator unassigned')
                                            setTimeout(() => setMessage(''), 3000)
                                            await refreshOperators()
                                            await fetchOperatorsForModal()
                                            const updatedMixer = await MixerService.fetchMixerById(mixerId)
                                            setMixer(updatedMixer)
                                        } else {
                                            setStatus(newStatus)
                                        }
                                    }}
                                    disabled={!canEditMixer}
                                    className="form-control"
                                >
                                    <option value="">Select Status</option>
                                    <option value="Active">Active</option>
                                    <option value="Spare">Spare</option>
                                    <option value="In Shop">In Shop</option>
                                    <option value="Retired">Retired</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Assigned Plant</label>
                                <select value={assignedPlant} onChange={e => setAssignedPlant(e.target.value)}
                                        disabled={!canEditMixer} className="form-control">
                                    <option value="">Select Plant</option>
                                    {!assignedPlantInRegion && assignedPlant &&
                                        <option value={assignedPlant}>{assignedPlant}</option>}
                                    {filteredPlants.map(plant => (
                                        <option key={plant.plantCode} value={plant.plantCode}>{plant.plantName}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Assigned Operator</label>
                                <div className="operator-select-container">
                                    <button
                                        className="operator-select-button form-control"
                                        onClick={async () => {
                                            if (canEditMixer) {
                                                await fetchOperatorsForModal()
                                                setShowOperatorModal(true)
                                            }
                                        }}
                                        type="button"
                                        disabled={!canEditMixer}
                                        style={!canEditMixer ? {
                                            cursor: 'not-allowed',
                                            opacity: 0.8,
                                            backgroundColor: 'var(--bg-secondary)'
                                        } : {}}
                                    >
                                        <span style={{display: 'block', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                            {assignedOperator ? getOperatorName(assignedOperator) : 'None (Click to select)'}
                                        </span>
                                    </button>
                                    {canEditMixer && (
                                        assignedOperator ? (
                                            <button
                                                className="unassign-operator-button"
                                                title="Unassign Operator"
                                                onClick={async () => {
                                                    try {
                                                        const prevOperator = assignedOperator
                                                        await handleSave({
                                                            assignedOperator: null,
                                                            status: 'Spare',
                                                            prevAssignedOperator: prevOperator
                                                        })
                                                        setAssignedOperator(null)
                                                        setStatus('Spare')
                                                        setLastUnassignedOperatorId(prevOperator)
                                                        await refreshOperators()
                                                        await fetchOperatorsForModal()
                                                        const updatedMixer = await MixerService.fetchMixerById(mixerId)
                                                        setMixer(updatedMixer)
                                                        setMessage('Operator unassigned and status set to Spare')
                                                        setTimeout(() => setMessage(''), 3000)
                                                        if (showOperatorModal) {
                                                            setShowOperatorModal(false)
                                                            setTimeout(() => {
                                                                setShowOperatorModal(true)
                                                            }, 0)
                                                        }
                                                    } catch (error) {
                                                        setMessage('Error unassigning operator. Please try again.')
                                                        setTimeout(() => setMessage(''), 3000)
                                                    }
                                                }}
                                                type="button"
                                            >
                                                Unassign Operator
                                            </button>
                                        ) : (
                                            lastUnassignedOperatorId && (
                                                <button
                                                    className="undo-operator-button unassign-operator-button"
                                                    title="Undo Unassign"
                                                    onClick={async () => {
                                                        try {
                                                            await handleSave({
                                                                assignedOperator: lastUnassignedOperatorId,
                                                                status: 'Active'
                                                            })
                                                            setAssignedOperator(lastUnassignedOperatorId)
                                                            setStatus('Active')
                                                            setLastUnassignedOperatorId(null)
                                                            await refreshOperators()
                                                            await fetchOperatorsForModal()
                                                            const updatedMixer = await MixerService.fetchMixerById(mixerId)
                                                            setMixer(updatedMixer)
                                                            setMessage('Operator re-assigned and status set to Active')
                                                            setTimeout(() => setMessage(''), 3000)
                                                        } catch (error) {
                                                            setMessage('Error undoing unassign. Please try again.')
                                                            setTimeout(() => setMessage(''), 3000)
                                                        }
                                                    }}
                                                    type="button"
                                                    style={{
                                                        backgroundColor: 'var(--success)',
                                                        color: 'var(--text-light)',
                                                        marginLeft: '8px',
                                                        height: '38px',
                                                        minWidth: '140px',
                                                        fontSize: '1rem',
                                                        borderRadius: '4px',
                                                        border: 'none',
                                                        padding: '0 16px',
                                                        cursor: 'pointer',
                                                        boxSizing: 'border-box'
                                                    }}
                                                >
                                                    Undo
                                                </button>
                                            )
                                        )
                                    )}
                                </div>
                                {showOperatorModal && (
                                    <OperatorSelectModal
                                        isOpen={showOperatorModal}
                                        onClose={() => setShowOperatorModal(false)}
                                        onSelect={async operatorId => {
                                            const newOperator = operatorId === '0' ? '' : operatorId
                                            const newStatus = newOperator ? 'Active' : status
                                            setShowOperatorModal(false)
                                            if (newOperator) {
                                                try {
                                                    await handleSave({
                                                        assignedOperator: newOperator,
                                                        status: newStatus
                                                    })
                                                    setAssignedOperator(newOperator)
                                                    setStatus(newStatus)
                                                    setLastUnassignedOperatorId(null)
                                                    await refreshOperators()
                                                    const updatedMixer = await MixerService.fetchMixerById(mixerId)
                                                    setMixer(updatedMixer)
                                                    setMessage('Operator assigned and status set to Active')
                                                    setTimeout(() => setMessage(''), 3000)
                                                    setHasUnsavedChanges(false)
                                                } catch (error) {
                                                    setMessage('Error assigning operator. Please try again.')
                                                    setTimeout(() => setMessage(''), 3000)
                                                }
                                            }
                                        }}
                                        currentValue={assignedOperator}
                                        mixers={mixers}
                                        assignedPlant={assignedPlant}
                                        readOnly={!canEditMixer}
                                        operators={operatorModalOperators}
                                        onRefresh={async () => {
                                            await fetchOperatorsForModal()
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="form-section maintenance-info">
                            <h3>Maintenance Information</h3>
                            <div className="form-group">
                                <label>Last Service Date</label>
                                <input type="date" value={lastServiceDate ? formatDate(lastServiceDate) : ''}
                                       onChange={e => setLastServiceDate(e.target.value ? new Date(e.target.value) : null)}
                                       className="form-control" readOnly={!canEditMixer}/>
                                {lastServiceDate && MixerUtility.isServiceOverdue(lastServiceDate) &&
                                    <div className="warning-text">Service overdue</div>}
                            </div>
                            <div className="form-group">
                                <label>Last Chip Date</label>
                                <input type="date" value={lastChipDate ? formatDate(lastChipDate) : ''}
                                       onChange={e => setLastChipDate(e.target.value ? new Date(e.target.value) : null)}
                                       className="form-control" readOnly={!canEditMixer}/>
                                {lastChipDate && MixerUtility.isChipOverdue(lastChipDate) &&
                                    <div className="warning-text">Chip overdue</div>}
                            </div>
                            <div className="form-group">
                                <label>Cleanliness Rating</label>
                                <div className="cleanliness-rating-editor">
                                    <div className="star-input">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <button key={star} type="button"
                                                    className={`star-button ${star <= cleanlinessRating ? 'active' : ''} ${!canEditMixer ? 'disabled' : ''}`}
                                                    onClick={() => canEditMixer && setCleanlinessRating(star === cleanlinessRating ? 0 : star)}
                                                    aria-label={`Rate ${star} of 5 stars`} disabled={!canEditMixer}>
                                                <i className={`fas fa-star ${star <= cleanlinessRating ? 'filled' : ''}`}
                                                   style={star <= cleanlinessRating ? {color: 'var(--accent)'} : {}}></i>
                                            </button>
                                        ))}
                                    </div>
                                    {cleanlinessRating > 0 && (
                                        <div className="rating-value-display">
                                            <span
                                                className="rating-label">{[null, 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][cleanlinessRating]}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="form-sections">
                        <div className="form-section vehicle-info">
                            <h3>Asset Details</h3>
                            <div className="form-group">
                                <label>VIN</label>
                                <input type="text" value={vin} onChange={e => setVin(e.target.value)}
                                       className="form-control" readOnly={!canEditMixer}/>
                            </div>
                            <div className="form-group">
                                <label>Make</label>
                                <input type="text" value={make} onChange={e => setMake(e.target.value)}
                                       className="form-control" readOnly={!canEditMixer}/>
                            </div>
                            <div className="form-group">
                                <label>Model</label>
                                <input type="text" value={model} onChange={e => setModel(e.target.value)}
                                       className="form-control" readOnly={!canEditMixer}/>
                            </div>
                            <div className="form-group">
                                <label>Year</label>
                                <input type="text" value={year} onChange={e => setYear(e.target.value)}
                                       className="form-control" readOnly={!canEditMixer}/>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="form-actions">
                    {canEditMixer && (
                        <>
                            <button className="primary-button save-button" onClick={handleSave}
                                    disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
                            <button className="danger-button" onClick={() => setShowDeleteConfirmation(true)}
                                    disabled={isSaving}>Delete Mixer
                            </button>
                        </>
                    )}
                </div>
            </div>
            {showHistory && <MixerHistoryView mixer={mixer} onClose={() => setShowHistory(false)}/>}
            {showDeleteConfirmation && (
                <div className="confirmation-modal" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 9999
                }}>
                    <div className="confirmation-content" style={{width: '90%', maxWidth: '500px', margin: '0 auto'}}>
                        <h2>Confirm Delete</h2>
                        <p>Are you sure you want to delete Truck #{mixer.truckNumber}? This action cannot be undone.</p>
                        <div className="confirmation-actions"
                             style={{display: 'flex', justifyContent: 'center', gap: '12px'}}>
                            <button className="cancel-button" onClick={() => setShowDeleteConfirmation(false)}>Cancel
                            </button>
                            <button className="danger-button" onClick={handleDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default MixerDetailView
