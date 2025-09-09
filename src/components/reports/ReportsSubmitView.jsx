import React, {useEffect, useState} from 'react'
import './styles/ReportsSubmitView.css'
import {ReportService} from '../../services/ReportService'
import {PlantManagerSubmitPlugin} from './types/WeeklyPlantManagerReport'
import {DistrictManagerSubmitPlugin} from './types/WeeklyDistrictManagerReport'
import {EfficiencySubmitPlugin} from './types/WeeklyEfficiencyReport'
import {SafetyManagerSubmitPlugin} from './types/WeeklySafetyManagerReport'
import {GeneralManagerSubmitPlugin} from './types/WeeklyGeneralManagerReport'

const plugins = {
    plant_manager: PlantManagerSubmitPlugin,
    district_manager: DistrictManagerSubmitPlugin,
    plant_production: EfficiencySubmitPlugin,
    safety_manager: SafetyManagerSubmitPlugin,
    general_manager: GeneralManagerSubmitPlugin
}

function getTruckNumberForOperator(row, mixers) {
    if (row && row.truck_number) return row.truck_number
    if (!row || !row.name) return ''
    const mixer = mixers.find(m => m.assigned_operator === row.name)
    if (mixer && mixer.truck_number) return mixer.truck_number
    return ''
}

function ReportsSubmitView({
                               report,
                               initialData,
                               onBack,
                               onSubmit,
                               user,
                               readOnly,
                               allReports,
                               managerEditUser,
                               userProfiles
                           }) {
    const [form, setForm] = useState(() => {
        if (initialData) {
            if (initialData.data) {
                return {...Object.fromEntries(report.fields.map(f => [f.name, f.type === 'table' ? [] : ''])), ...initialData.data, ...(initialData.rows ? {rows: initialData.rows} : {})}
            }
            return {...Object.fromEntries(report.fields.map(f => [f.name, f.type === 'table' ? [] : ''])), ...initialData}
        }
        return Object.fromEntries(report.fields.map(f => [f.name, f.type === 'table' ? [] : '']))
    })
    const [submitting, setSubmitting] = useState(false)
    const [savingDraft, setSavingDraft] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [maintenanceItems, setMaintenanceItems] = useState([])
    const [summaryTab, setSummaryTab] = useState('summary')
    const [yph, setYph] = useState(null)
    const [yphGrade, setYphGrade] = useState('')
    const [yphLabel, setYphLabel] = useState('')
    const [lost, setLost] = useState(null)
    const [lostGrade, setLostGrade] = useState('')
    const [lostLabel, setLostLabel] = useState('')
    const [carouselIndex, setCarouselIndex] = useState(0)
    const [operatorOptions, setOperatorOptions] = useState([])
    const [mixers, setMixers] = useState([])
    const [plants, setPlants] = useState([])
    const [excludedOperators, setExcludedOperators] = useState([])
    const [saveMessage, setSaveMessage] = useState('')
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [initialFormSnapshot, setInitialFormSnapshot] = useState(null)
    const [, setDebugMsg] = useState('')
    const [showConfirmationModal, setShowConfirmationModal] = useState(false)
    const [confirmationChecks, setConfirmationChecks] = useState([false, false])

    let weekRange = ''
    if (report.weekIso) {
        weekRange = ReportService.getWeekRangeFromIso(report.weekIso)
    }
    const PluginComponent = plugins[report.name]
    const submitted = !!initialData?.completed

    function validatePlantProduction() {
        if (!form.plant) return 'Please select a plant before submitting.'
        if (!form.report_date) return 'Please select a report date before submitting.'
        const rows = Array.isArray(form.rows) ? form.rows : []
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i]
            const nameLabel = operatorOptions.find(o => o.value === r.name)?.label || `Operator ${i + 1}`
            const start = ReportService.parseTimeToMinutes(r.start_time)
            const first = ReportService.parseTimeToMinutes(r.first_load)
            const eod = ReportService.parseTimeToMinutes(r.eod_in_yard)
            const punch = ReportService.parseTimeToMinutes(r.punch_out)
            if (!r.start_time || start === null) return `${nameLabel}: Start Time is required and must be a valid time.`
            if (!r.first_load || first === null) return `${nameLabel}: 1st Load time is required and must be a valid time.`
            if (!r.eod_in_yard || eod === null) return `${nameLabel}: EOD In Yard time is required and must be a valid time.`
            if (!r.punch_out || punch === null) return `${nameLabel}: Punch Out time is required and must be a valid time.`
            if (first - start < 0) return `${nameLabel}: 1st Load time must be after Start Time.`
            if (punch - eod < 0) return `${nameLabel}: Punch Out time must be after EOD In Yard.`
            if (start !== null && punch !== null && punch - start <= 0) return `${nameLabel}: Total hours must be greater than 0.`
            const loadsVal = r.loads
            if (loadsVal === undefined || loadsVal === null || String(loadsVal) === '') return `${nameLabel}: Total Loads is required.`
            const loadsNum = Number(loadsVal)
            if (!Number.isFinite(loadsNum) || loadsNum < 0 || !Number.isInteger(loadsNum)) return `${nameLabel}: Total Loads must be a non-negative whole number.`
        }
        return ''
    }

    function handleChange(e, name, idx, colName) {
        if (report.name === 'plant_production' && name === 'rows') {
            const updatedRows = [...(form.rows || [])]
            if (colName === 'name' || colName === 'truck_number') {
                return
            } else {
                updatedRows[idx][colName] = e.target.value
            }
            setForm({...form, rows: updatedRows})
            return
        }
        if (report.name === 'general_manager' && name.startsWith('plant_field_')) {
            setForm({...form, [name]: e.target.value})
            return
        }
        let value = e.target.value
        if (
            ['total_yards_lost', 'yardage_lost', 'lost_yardage', 'Yardage Lost', 'yardage_lost'].includes(name)
            && value !== ''
            && !isNaN(Number(value))
            && Number(value) < 0
        ) {
            value = 0
        }
        setForm({...form, [name]: value})
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setSuccess(false)
        if (report.name === 'plant_manager') {
            setShowConfirmationModal(true)
            return
        }
        if (report.name === 'safety_manager') {
            const issues = Array.isArray(form.issues) ? form.issues : []
            if (issues.some(i => !i.description || !i.plant || !i.tag)) {
                setError('All issues must have a description, plant, and tag.')
                return
            }
        }
        if (report.name !== 'general_manager') {
            for (const field of report.fields) {
                if (field.required && (!form[field.name] || (Array.isArray(form[field.name]) && form[field.name].length === 0))) {
                    setError('Please fill out all required fields before submitting.')
                    return
                }
            }
        } else {
            if (plants.length > 0) {
                for (const plant of plants) {
                    const code = plant.plant_code
                    const requiredFields = [
                        `active_operators_${code}`,
                        `runnable_trucks_${code}`,
                        `down_trucks_${code}`,
                        `operators_starting_${code}`,
                        `new_operators_training_${code}`,
                        `operators_leaving_${code}`,
                        `total_yardage_${code}`,
                        `total_hours_${code}`
                    ]
                    for (const field of requiredFields) {
                        if (form[field] === undefined || form[field] === '' || form[field] === null) {
                            setError('Please fill out all required fields before submitting.')
                            return
                        }
                    }
                }
            }
        }
        if (report.name === 'plant_production') {
            const v = validatePlantProduction()
            if (v) {
                setError(v)
                return
            }
        }
        setSubmitting(true)
        try {
            await onSubmit(form, 'submit')
            setSuccess(true)
        } catch (err) {
            setError(err?.message || 'Error submitting report')
        }
        setSubmitting(false)
    }

    async function handleConfirmedSubmit() {
        setShowConfirmationModal(false)
        setSubmitting(true)
        setError('')
        setSuccess(false)
        try {
            await onSubmit(form, 'submit')
            setSuccess(true)
        } catch (err) {
            setError(err?.message || 'Error submitting report')
        }
        setSubmitting(false)
    }

    async function handleSaveDraft(e) {
        e.preventDefault()
        setError('')
        setSuccess(false)
        setSaveMessage('')
        if (managerEditUser && report.name === 'plant_production') {
            const v = validatePlantProduction()
            if (v) {
                setError(v)
                return
            }
        }
        setSavingDraft(true)
        try {
            await onSubmit(form, 'draft')
            setSaveMessage('Changes saved.')
            setInitialFormSnapshot(JSON.stringify(form))
            setHasUnsavedChanges(false)
        } catch (err) {
            setError(err?.message || 'Error saving draft')
        }
        setSavingDraft(false)
    }

    function handleExcludeOperator(idx) {
        const updatedRows = [...(form.rows || [])]
        if (updatedRows[idx]) {
            updatedRows.splice(idx, 1)
        }
        let newIndex = carouselIndex
        if (newIndex >= updatedRows.length) {
            newIndex = Math.max(0, updatedRows.length - 1)
        }
        setForm({...form, rows: updatedRows})
        setCarouselIndex(newIndex)
    }

    function handleReincludeOperator(operatorId) {
        if (!operatorId) return
        const mixer = mixers.find(m => m.assigned_operator === operatorId)
        const newRow = {
            name: operatorId,
            truck_number: mixer && mixer.truck_number ? mixer.truck_number : '',
            start_time: '',
            first_load: '',
            eod_in_yard: '',
            punch_out: '',
            loads: '',
            comments: ''
        }
        setForm(f => {
            const rows = [...(f.rows || []), newRow]
            return {...f, rows}
        })
        setCarouselIndex(form.rows ? form.rows.length : 0)
    }

    function handleBackClick() {
        if (hasUnsavedChanges) {
            handleSaveDraft({
                preventDefault: () => {}
            })
            setTimeout(() => onBack(), 800)
        } else {
            onBack()
        }
    }

    useEffect(() => {
        async function fetchPlants() {
            const targetUserId = managerEditUser || user?.id
            if (targetUserId) {
                const list = await ReportService.fetchPlantsForUser(targetUserId)
                setPlants(list)
            } else {
                const list = await ReportService.fetchPlantsSorted()
                setPlants(list)
            }
        }

        fetchPlants()
    }, [user, managerEditUser])

    useEffect(() => {
        async function fetchMaintenanceItems() {
            if (!report.weekIso) return
            const items = await ReportService.fetchMaintenanceItems(report.weekIso)
            setMaintenanceItems(items)
        }

        fetchMaintenanceItems()
    }, [report.weekIso])

    useEffect(() => {
        if (report.name === 'plant_production' && !form.plant && user && plants.length > 0) {
            setForm(f => ({...f, plant: plants[0]?.plant_code || ''}))
        }
    }, [report.name, form.plant, user, plants])

    useEffect(() => {
        async function fetchOperatorsAndMixers(plantCode) {
            if (!plantCode) {
                setOperatorOptions([])
                setMixers([])
                setForm(f => ({...f, rows: []}))
                return
            }
            const {operatorOptions, mixers, activeOperators} = await ReportService.fetchActiveOperatorsAndMixers(plantCode)
            setOperatorOptions(operatorOptions)
            setMixers(mixers)
            if (report.name === 'plant_production' && !readOnly) {
                if ((!initialData || !initialData.rows || initialData.rows.length === 0) && (!form.rows || form.rows.length === 0)) {
                    const rows = []
                    activeOperators.forEach(op => {
                        const mixer = mixers.find(m => m.assigned_operator === op.employee_id)
                        rows.push({
                            name: op.employee_id,
                            truck_number: mixer && mixer.truck_number ? mixer.truck_number : '',
                            start_time: '',
                            first_load: '',
                            eod_in_yard: '',
                            punch_out: '',
                            loads: '',
                            comments: ''
                        })
                    })
                    setForm(f => ({...f, rows}))
                    setCarouselIndex(0)
                }
            }
        }

        if (report.name === 'plant_production') {
            const plantCode = form.plant
            if (!plantCode) {
                setForm(f => ({...f, rows: []}))
                return
            }
            fetchOperatorsAndMixers(plantCode)
        }
    }, [report.name, form.plant, user, readOnly, plants])

    useEffect(() => {
        if (initialData) {
            if (initialData.data) {
                setForm(() => ({
                    ...Object.fromEntries(report.fields.map(f => [f.name, f.type === 'table' ? [] : ''])),
                    ...initialData.data,
                    ...(initialData.rows ? {rows: initialData.rows} : {})
                }))
            } else {
                setForm(() => ({
                    ...Object.fromEntries(report.fields.map(f => [f.name, f.type === 'table' ? [] : ''])),
                    ...initialData
                }))
            }
        }
    }, [initialData])

    useEffect(() => {
        let {yph, yphGrade, yphLabel, lost, lostGrade, lostLabel} = ReportService.getYardageMetrics(form)
        setYph(yph)
        setYphGrade(yphGrade)
        setYphLabel(yphLabel)
        setLost(lost)
        setLostGrade(lostGrade)
        setLostLabel(lostLabel)
    }, [form, report.name])

    useEffect(() => {
        if (report.name === 'plant_production' && Array.isArray(form.rows) && Array.isArray(operatorOptions)) {
            const excluded = operatorOptions
                .filter(opt => !(form.rows || []).some(row => row.name === opt.value))
                .map(opt => opt.value)
            setExcludedOperators(excluded)
        }
    }, [form.rows, operatorOptions, report.name])

    useEffect(() => {
        if (
            (report.name !== 'plant_production') ||
            (report.name === 'plant_production' && plants.length > 0 && operatorOptions.length > 0 && Array.isArray(form.rows))
        ) {
            if (initialFormSnapshot === null) {
                setInitialFormSnapshot(JSON.stringify(form))
            }
        }
    }, [report.name, plants, operatorOptions, form.rows, initialData])

    useEffect(() => {
        if (initialFormSnapshot !== null) {
            setHasUnsavedChanges(JSON.stringify(form) !== initialFormSnapshot)
        }
    }, [form, initialFormSnapshot])

    useEffect(() => {
        if (report.name === 'plant_manager' && user && user.plant_code) {
            setForm(f => ({...f, plant: user.plant_code}))
        }
    }, [report.name, user])

    let editingUserName = ''
    if (managerEditUser && userProfiles && userProfiles[managerEditUser]) {
        const profile = userProfiles[managerEditUser]
        editingUserName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    } else if (managerEditUser) {
        editingUserName = managerEditUser.slice(0, 8)
    }
    return (
        <div style={{width: '100%', minHeight: '100vh', background: 'var(--background)'}}>
            <div style={{maxWidth: 900, margin: '56px auto 0 auto', padding: '0 0 32px 0'}}>
                {managerEditUser && (
                    <div style={{
                        fontWeight: 700,
                        fontSize: 18,
                        color: 'var(--accent)',
                        marginBottom: 18,
                        textAlign: 'center'
                    }}>
                        Editing report for: {editingUserName}
                    </div>
                )}
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24}}>
                    <button className="report-form-back" onClick={handleBackClick} type="button">
                        <i className="fas fa-arrow-left"></i> Back
                    </button>
                </div>
                <div className="report-form-header-row" style={{marginTop: 0}}>
                    <div className="report-form-title">
                        {report.title || ''}
                    </div>
                    {weekRange && (
                        <div style={{fontWeight: 700, fontSize: 17, color: 'var(--accent)'}}>
                            {weekRange}
                        </div>
                    )}
                </div>
                <form className="report-form-body-wide" onSubmit={handleSubmit}>
                    <div className="report-form-fields-grid">
                        {report.name === 'plant_production' ? (
                            <>
                                <div style={{display: 'flex', gap: 24, width: '100%', marginBottom: 18}}>
                                    <div style={{flex: 1}}>
                                        <label>
                                            Plant
                                            <span className="report-modal-required">*</span>
                                        </label>
                                        <select
                                            value={form.plant || ''}
                                            onChange={e => {
                                                const newPlant = e.target.value
                                                setForm(f => ({...f, plant: newPlant, rows: []}))
                                                setCarouselIndex(0)
                                            }}
                                            required
                                            disabled={readOnly}
                                            style={{
                                                background: 'var(--background)',
                                                border: '1.5px solid var(--divider)',
                                                borderRadius: 8,
                                                fontSize: 16,
                                                width: '100%',
                                                height: 44,
                                                padding: '0 16px',
                                                color: 'var(--text-primary)',
                                                boxShadow: '0 1px 4px var(--shadow-xs)',
                                                transition: 'border 0.2s, box-shadow 0.2s',
                                                outline: 'none',
                                                appearance: 'none',
                                                cursor: readOnly ? 'not-allowed' : 'pointer',
                                                lineHeight: 1.2
                                            }}
                                            className="plant-prod-input plant-prod-select"
                                        >
                                            <option value="">Select Plant...</option>
                                            {plants.map(p => (
                                                <option key={p.plant_code} value={p.plant_code}>{p.plant_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{
                                        flex: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-end'
                                    }}>
                                        <label>
                                            Report Date
                                            <span className="report-modal-required">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={form.report_date || ''}
                                            onChange={e => setForm(f => ({...f, report_date: e.target.value}))}
                                            required
                                            disabled={readOnly}
                                            style={{
                                                background: 'var(--background)',
                                                border: '1.5px solid var(--divider)',
                                                borderRadius: 8,
                                                fontSize: 16,
                                                width: 180,
                                                height: 44,
                                                padding: '0 16px',
                                                color: 'var(--text-primary)',
                                                boxShadow: '0 1px 4px var(--shadow-xs)',
                                                transition: 'border 0.2s, box-shadow 0.2s',
                                                outline: 'none',
                                                cursor: readOnly ? 'not-allowed' : 'pointer',
                                                lineHeight: 1.2
                                            }}
                                            className="plant-prod-input plant-prod-date"
                                        />
                                    </div>
                                </div>
                                <style>
                                    {`
                                    .plant-prod-select:focus, .plant-prod-date:focus {
                                        border: 1.5px solid var(--accent);
                                        box-shadow: 0 2px 8px var(--shadow-sm);
                                    }
                                    .plant-prod-select:hover, .plant-prod-date:hover {
                                        border: 1.5px solid var(--accent);
                                    }
                                    .plant-prod-input::placeholder {
                                        color: var(--text-primary);
                                        opacity: 1;
                                    }
                                    `}
                                </style>
                                <div className="report-form-field-wide" style={{gridColumn: '1 / -1'}}>
                                    <label>Operators</label>
                                    <div>
                                        {form.plant && (form.rows || []).length === 0 && (
                                            <div style={{color: 'var(--text-secondary)', margin: '16px 0'}}>
                                                No active operators for this plant.
                                            </div>
                                        )}
                                        {!form.plant && (
                                            <div style={{color: 'var(--text-secondary)', margin: '16px 0'}}>
                                                Please wait, loading plant assignment...
                                            </div>
                                        )}
                                        {(form.rows || []).length > 0 && (
                                            <div style={{marginBottom: 18}}>
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    marginBottom: 16,
                                                    width: '100%'
                                                }}>
                                                    {form.rows.map((row, idx) => (
                                                        <div
                                                            key={idx}
                                                            onClick={() => {
                                                                setCarouselIndex(idx)
                                                            }}
                                                            style={{
                                                                minWidth: 32,
                                                                height: 32,
                                                                borderRadius: 16,
                                                                background: idx === carouselIndex ? 'var(--accent)' : 'var(--divider)',
                                                                color: idx === carouselIndex ? 'var(--text-light)' : 'var(--text-secondary)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontWeight: 600,
                                                                fontSize: 15,
                                                                cursor: 'pointer',
                                                                border: idx === carouselIndex ? '2px solid var(--accent)' : '1px solid var(--divider)',
                                                                transition: 'background 0.2s'
                                                            }}
                                                        >
                                                            {idx + 1}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div
                                                    style={{
                                                        border: '1px solid var(--divider)',
                                                        borderRadius: 10,
                                                        background: 'var(--background-elevated)',
                                                        boxShadow: '0 1px 4px var(--shadow-sm)',
                                                        padding: 0,
                                                        color: 'var(--text-primary)',
                                                        width: '100%'
                                                    }}
                                                >
                                                    {form.rows[carouselIndex] && (
                                                        <div style={{
                                                            padding: '24px 24px 0 24px',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: 18
                                                        }}>
                                                            <div style={{display: 'flex', gap: 18}}>
                                                                <div style={{flex: 1}}>
                                                                    <label style={{
                                                                        fontWeight: 600,
                                                                        fontSize: 15
                                                                    }}>Name</label>
                                                                    <input
                                                                        type="text"
                                                                        value={operatorOptions.find(opt => opt.value === form.rows[carouselIndex]?.name)?.label || ''}
                                                                        disabled
                                                                        style={{
                                                                            background: 'var(--background)',
                                                                            border: '1px solid var(--divider)',
                                                                            borderRadius: 6,
                                                                            fontSize: 15,
                                                                            width: '100%',
                                                                            padding: '7px 10px',
                                                                            color: 'var(--text-primary)'
                                                                        }}
                                                                        className="plant-prod-input"
                                                                    />
                                                                </div>
                                                                <div style={{width: 120}}>
                                                                    <label style={{fontWeight: 600, fontSize: 15}}>Truck
                                                                        #</label>
                                                                    <input
                                                                        type="text"
                                                                        value={getTruckNumberForOperator(form.rows[carouselIndex], mixers)}
                                                                        disabled
                                                                        style={{
                                                                            background: 'var(--background)',
                                                                            border: '1px solid var(--divider)',
                                                                            borderRadius: 6,
                                                                            fontSize: 15,
                                                                            width: '100%',
                                                                            padding: '7px 10px',
                                                                            color: 'var(--text-primary)'
                                                                        }}
                                                                        className="plant-prod-input"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div style={{display: 'flex', gap: 18}}>
                                                                <div style={{flex: 1}}>
                                                                    <label style={{fontWeight: 600, fontSize: 15}}>Start
                                                                        Time</label>
                                                                    <input
                                                                        type="time"
                                                                        placeholder="Start Time"
                                                                        value={form.rows[carouselIndex]?.start_time || ''}
                                                                        onChange={e => handleChange(e, 'rows', carouselIndex, 'start_time')}
                                                                        disabled={!!readOnly}
                                                                        style={{
                                                                            background: 'var(--background)',
                                                                            border: '1px solid var(--divider)',
                                                                            borderRadius: 6,
                                                                            fontSize: 15,
                                                                            width: '100%',
                                                                            padding: '7px 10px',
                                                                            color: 'var(--text-primary)'
                                                                        }}
                                                                        className="plant-prod-input"
                                                                    />
                                                                </div>
                                                                <div style={{flex: 1}}>
                                                                    <label style={{fontWeight: 600, fontSize: 15}}>1st
                                                                        Load</label>
                                                                    <input
                                                                        type="time"
                                                                        placeholder="1st Load"
                                                                        value={form.rows[carouselIndex]?.first_load || ''}
                                                                        onChange={e => handleChange(e, 'rows', carouselIndex, 'first_load')}
                                                                        disabled={!!readOnly}
                                                                        style={{
                                                                            background: 'var(--background)',
                                                                            border: '1px solid var(--divider)',
                                                                            borderRadius: 6,
                                                                            fontSize: 15,
                                                                            width: '100%',
                                                                            padding: '7px 10px',
                                                                            color: 'var(--text-primary)'
                                                                        }}
                                                                        className="plant-prod-input"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div style={{display: 'flex', gap: 18}}>
                                                                <div style={{flex: 1}}>
                                                                    <label style={{fontWeight: 600, fontSize: 15}}>EOD
                                                                        In Yard</label>
                                                                    <input
                                                                        type="time"
                                                                        placeholder="EOD"
                                                                        value={form.rows[carouselIndex]?.eod_in_yard || ''}
                                                                        onChange={e => handleChange(e, 'rows', carouselIndex, 'eod_in_yard')}
                                                                        disabled={!!readOnly}
                                                                        style={{
                                                                            background: 'var(--background)',
                                                                            border: '1px solid var(--divider)',
                                                                            borderRadius: 6,
                                                                            fontSize: 15,
                                                                            width: '100%',
                                                                            padding: '7px 10px',
                                                                            color: 'var(--text-primary)'
                                                                        }}
                                                                        className="plant-prod-input"
                                                                    />
                                                                </div>
                                                                <div style={{flex: 1}}>
                                                                    <label style={{fontWeight: 600, fontSize: 15}}>Punch
                                                                        Out</label>
                                                                    <input
                                                                        type="time"
                                                                        placeholder="Punch Out"
                                                                        value={form.rows[carouselIndex]?.punch_out || ''}
                                                                        onChange={e => handleChange(e, 'rows', carouselIndex, 'punch_out')}
                                                                        disabled={!!readOnly}
                                                                        style={{
                                                                            background: 'var(--background)',
                                                                            border: '1px solid var(--divider)',
                                                                            borderRadius: 6,
                                                                            fontSize: 15,
                                                                            width: '100%',
                                                                            padding: '7px 10px',
                                                                            color: 'var(--text-primary)'
                                                                        }}
                                                                        className="plant-prod-input"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div style={{display: 'flex', gap: 18}}>
                                                                <div style={{flex: 1}}>
                                                                    <label style={{fontWeight: 600, fontSize: 15}}>Total
                                                                        Loads</label>
                                                                    <input
                                                                        type="number"
                                                                        placeholder="Total Loads"
                                                                        value={form.rows[carouselIndex]?.loads || ''}
                                                                        onChange={e => handleChange(e, 'rows', carouselIndex, 'loads')}
                                                                        disabled={readOnly}
                                                                        style={{
                                                                            background: 'var(--background)',
                                                                            border: '1px solid var(--divider)',
                                                                            borderRadius: 6,
                                                                            fontSize: 15,
                                                                            width: '100%',
                                                                            padding: '7px 10px',
                                                                            color: 'var(--text-primary)'
                                                                        }}
                                                                        className="plant-prod-input"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label style={{
                                                                    fontWeight: 600,
                                                                    fontSize: 15
                                                                }}>Comments</label>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Comments"
                                                                    value={form.rows[carouselIndex]?.comments || ''}
                                                                    onChange={e => handleChange(e, 'rows', carouselIndex, 'comments')}
                                                                    disabled={readOnly}
                                                                    style={{
                                                                        background: 'var(--background)',
                                                                        border: '1px solid var(--divider)',
                                                                        borderRadius: 6,
                                                                        fontSize: 15,
                                                                        width: '100%',
                                                                        padding: '7px 10px',
                                                                        color: 'var(--text-primary)'
                                                                    }}
                                                                    className="plant-prod-input"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '18px 24px 18px 24px'
                                                    }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleExcludeOperator(carouselIndex)}
                                                            style={{
                                                                fontWeight: 600,
                                                                fontSize: 15,
                                                                background: 'var(--divider)',
                                                                color: 'var(--text-primary)',
                                                                border: 'none',
                                                                borderRadius: 6,
                                                                padding: '6px 18px',
                                                                cursor: 'pointer',
                                                                marginRight: 12
                                                            }}
                                                        >
                                                            Exclude Operator
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setCarouselIndex(i => Math.max(i - 1, 0))}
                                                            disabled={carouselIndex === 0}
                                                            style={{
                                                                fontWeight: 600,
                                                                fontSize: 15,
                                                                background: 'var(--accent)',
                                                                color: 'var(--text-light)',
                                                                border: 'none',
                                                                borderRadius: 6,
                                                                padding: '6px 18px',
                                                                cursor: carouselIndex === 0 ? 'not-allowed' : 'pointer',
                                                                opacity: carouselIndex === 0 ? 0.5 : 1
                                                            }}
                                                        >
                                                            &#8592; Prev Operator
                                                        </button>
                                                        <span style={{fontWeight: 600, fontSize: 15}}>
                                                            Operator {carouselIndex + 1} of {form.rows.length}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setCarouselIndex(i => Math.min(i + 1, form.rows.length - 1))}
                                                            disabled={carouselIndex === form.rows.length - 1}
                                                            style={{
                                                                fontWeight: 600,
                                                                fontSize: 15,
                                                                background: 'var(--accent)',
                                                                color: 'var(--text-light)',
                                                                border: 'none',
                                                                borderRadius: 6,
                                                                padding: '6px 18px',
                                                                cursor: carouselIndex === form.rows.length - 1 ? 'not-allowed' : 'pointer',
                                                                opacity: carouselIndex === form.rows.length - 1 ? 0.5 : 1
                                                            }}
                                                        >
                                                            Next Operator &#8594;
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {excludedOperators.length > 0 && (
                                            <div style={{marginTop: 18, marginBottom: 18}}>
                                                <div style={{fontWeight: 600, fontSize: 15, marginBottom: 8}}>
                                                    Excluded Operators
                                                </div>
                                                <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
                                                    {excludedOperators.map(opId => {
                                                        const op = operatorOptions.find(opt => opt.value === opId)
                                                        return (
                                                            <button
                                                                key={opId}
                                                                type="button"
                                                                onClick={() => handleReincludeOperator(opId)}
                                                                style={{
                                                                    background: 'var(--divider)',
                                                                    color: 'var(--text-primary)',
                                                                    border: 'none',
                                                                    borderRadius: 6,
                                                                    padding: '6px 14px',
                                                                    fontWeight: 600,
                                                                    fontSize: 15,
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                {op ? op.label : opId} (Re-include)
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : report.name === 'general_manager' ? null : report.name === 'safety_manager' ? null : (
                            report.fields.map(field => (
                                field.name === 'issues' ? null : (
                                    <div key={field.name} className="report-form-field-wide">
                                        <label>
                                            {field.name === 'yardage' ? 'Total Yardage' : field.label}
                                            {field.required && <span className="report-modal-required">*</span>}
                                        </label>
                                        {field.type === 'textarea' ? (
                                            <textarea
                                                value={form[field.name] || ''}
                                                onChange={e => handleChange(e, field.name)}
                                                required={field.required}
                                                disabled={readOnly}
                                            />
                                        ) : field.type === 'select' ? (
                                            <select
                                                value={form[field.name] || ''}
                                                onChange={e => handleChange(e, field.name)}
                                                required={field.required}
                                                disabled={readOnly}
                                            >
                                                <option value="">Select...</option>
                                                {field.options?.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                type={field.type}
                                                value={form[field.name] || ''}
                                                onChange={e => handleChange(e, field.name)}
                                                required={field.required}
                                                disabled={readOnly}
                                            />
                                        )}
                                    </div>
                                )
                            ))
                        )}
                    </div>
                    {PluginComponent && (
                        <>
                            <PluginComponent
                                form={form}
                                yph={yph}
                                yphGrade={yphGrade}
                                yphLabel={yphLabel}
                                lost={lost}
                                lostGrade={lostGrade}
                                lostLabel={lostLabel}
                                summaryTab={summaryTab}
                                setSummaryTab={setSummaryTab}
                                maintenanceItems={maintenanceItems}
                                operatorOptions={operatorOptions}
                                setDebugMsg={setDebugMsg}
                                allReports={report.name === 'general_manager' ? allReports : undefined}
                                weekIso={report.name === 'general_manager' ? report.weekIso : undefined}
                                setForm={setForm}
                                plants={plants}
                                readOnly={readOnly}
                            />
                        </>
                    )}
                    {error && <div className="report-modal-error">{error}</div>}
                    {success &&
                        <div style={{color: 'var(--success)', marginBottom: 8}}>Report submitted successfully.</div>}
                    {saveMessage && <div style={{color: 'var(--success)', marginBottom: 8}}>{saveMessage}</div>}
                    {!readOnly && (
                        <div className="report-modal-actions-wide"
                             style={{display: 'flex', alignItems: 'center', gap: 16}}>
                            <button
                                type="button"
                                className="report-modal-cancel"
                                onClick={handleBackClick}
                                disabled={submitting || savingDraft}
                                style={{
                                    background: 'var(--divider)',
                                    color: 'var(--text-primary)',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '10px 22px',
                                    fontWeight: 600,
                                    fontSize: 15,
                                    cursor: 'pointer',
                                    height: 44
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="report-modal-save"
                                style={{
                                    background: 'var(--accent)',
                                    color: 'var(--text-light)',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '10px 22px',
                                    fontWeight: 600,
                                    fontSize: 15,
                                    cursor: 'pointer',
                                    marginRight: 12,
                                    height: 44
                                }}
                                onClick={handleSaveDraft}
                                disabled={submitting || savingDraft}
                            >
                                {savingDraft ? 'Saving...' : 'Save Changes'}
                            </button>
                            {(!managerEditUser) && (
                                <button
                                    type="submit"
                                    className="report-modal-submit"
                                    disabled={submitting || savingDraft}
                                    style={{
                                        background: 'var(--accent)',
                                        color: 'var(--text-light)',
                                        border: 'none',
                                        borderRadius: 6,
                                        padding: '10px 22px',
                                        fontWeight: 600,
                                        fontSize: 15,
                                        cursor: 'pointer',
                                        height: 44
                                    }}
                                >
                                    {submitting ? 'Submitting...' : 'Submit'}
                                </button>
                            )}
                        </div>
                    )}
                </form>
            </div>
            {showConfirmationModal && (
                <div className="confirmation-modal" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 9999,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)'
                }}>
                    <div className="confirmation-content" style={{
                        width: '90%',
                        maxWidth: '500px',
                        margin: '0 auto',
                        background: 'var(--background)',
                        borderRadius: 10,
                        padding: 32
                    }}>
                        <h2 style={{marginBottom: 18}}>Confirm Submission</h2>
                        <div style={{marginBottom: 18, fontWeight: 500, color: 'var(--text-primary)'}}>Please confirm
                            the following before submitting:
                        </div>
                        <div style={{marginBottom: 12}}>
                            <label style={{display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500}}>
                                <input
                                    type="checkbox"
                                    checked={confirmationChecks[0]}
                                    onChange={e => setConfirmationChecks([e.target.checked, confirmationChecks[1]])}
                                />
                                Total yardage includes all yardage we can bill for and does not include lost yardage.
                            </label>
                        </div>
                        <div style={{marginBottom: 24}}>
                            <label style={{display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500}}>
                                <input
                                    type="checkbox"
                                    checked={confirmationChecks[1]}
                                    onChange={e => setConfirmationChecks([confirmationChecks[0], e.target.checked])}
                                />
                                Total hours only includes hours from operators and not from plant managers, loader
                                operators or any other roles.
                            </label>
                        </div>
                        <div style={{display: 'flex', gap: 16, justifyContent: 'center'}}>
                            <button
                                type="button"
                                style={{
                                    background: 'var(--divider)',
                                    color: 'var(--text-primary)',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '10px 22px',
                                    fontWeight: 600,
                                    fontSize: 15,
                                    cursor: 'pointer'
                                }}
                                onClick={() => setShowConfirmationModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                style={{
                                    background: confirmationChecks[0] && confirmationChecks[1] ? 'var(--accent)' : 'var(--divider)',
                                    color: confirmationChecks[0] && confirmationChecks[1] ? 'var(--text-light)' : 'var(--text-secondary)',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '10px 22px',
                                    fontWeight: 600,
                                    fontSize: 15,
                                    cursor: confirmationChecks[0] && confirmationChecks[1] ? 'pointer' : 'not-allowed',
                                    opacity: confirmationChecks[0] && confirmationChecks[1] ? 1 : 0.6
                                }}
                                disabled={!(confirmationChecks[0] && confirmationChecks[1])}
                                onClick={handleConfirmedSubmit}
                            >
                                Confirm & Submit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ReportsSubmitView
