import React, {useEffect, useState} from 'react'
import './styles/ReportsSubmitView.css'
import {ReportService} from '../../services/ReportService'
import {PlantManagerSubmitPlugin} from './types/WeeklyPlantManagerReport'
import {DistrictManagerSubmitPlugin} from './types/WeeklyDistrictManagerReport'
import {EfficiencySubmitPlugin} from './types/WeeklyEfficiencyReport'
import {SafetyManagerSubmitPlugin} from './types/WeeklySafetyManagerReport'
import {GeneralManagerSubmitPlugin} from './types/WeeklyGeneralManagerReport'
import {ReportUtility} from '../../utils/ReportUtility'
import {EmailUtility} from '../../utils/EmailUtility'

const plugins = {
    plant_manager: PlantManagerSubmitPlugin,
    district_manager: DistrictManagerSubmitPlugin,
    plant_production: EfficiencySubmitPlugin,
    safety_manager: SafetyManagerSubmitPlugin,
    general_manager: GeneralManagerSubmitPlugin
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

    const PluginComponent = plugins[report.name]

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
            const v = ReportUtility.validatePlantProduction(form, operatorOptions)
            if (v) {
                setError(v)
                return
            }
        }
        setSubmitting(true)
        try {
            await onSubmit(form, 'submit')
            setSuccess(true)
            await EmailUtility.sendReportSubmittedEmail({report, weekVerbose})
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
            await EmailUtility.sendReportSubmittedEmail({report, weekVerbose})
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
            const v = ReportUtility.validatePlantProduction(form, operatorOptions)
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
            if (managerEditUser) await EmailUtility.sendReportSubmittedEmail({report, weekVerbose})
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
                preventDefault: () => {
                }
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
            const excluded = ReportUtility.getExcludedOperators(form.rows, operatorOptions)
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

    const weekVerbose = ReportUtility.getWeekVerbose(report.weekIso)
    const reportDateVerbose = form.report_date ? ReportUtility.formatVerboseDate(form.report_date) : ''

    return (
        <div className="rpts-sbmt-root">
            <div className="rpts-sbmt-container">
                {managerEditUser && (
                    <div className="rpts-sbmt-edit-banner">
                        Editing {editingUserName}s Report
                    </div>
                )}
                <div className="rpts-sbmt-toolbar">
                    <button className="rpts-sbmt-back" onClick={handleBackClick} type="button">
                        <i className="fas fa-arrow-left"></i> Back
                    </button>
                </div>
                <div className="rpts-sbmt-header-row">
                    <div className="rpts-sbmt-title">
                        {report.title || ''}
                    </div>
                    <div className="rpts-sbmt-context">
                        {weekVerbose ? (
                            <div className="rpts-sbmt-context-chip">
                                <i className="far fa-calendar-alt"></i>
                                <span>{weekVerbose}</span>
                            </div>
                        ) : null}
                        {reportDateVerbose ? (
                            <div className="rpts-sbmt-context-chip">
                                <i className="far fa-calendar-check"></i>
                                <span>{reportDateVerbose}</span>
                            </div>
                        ) : null}
                        {(report.name === 'plant_production' && form.plant) ? (
                            <div className="rpts-sbmt-context-chip">
                                <i className="fas fa-industry"></i>
                                <span>Plant {form.plant}</span>
                            </div>
                        ) : null}
                    </div>
                </div>
                <form className="rpts-sbmt-body" onSubmit={handleSubmit}>
                    <div className="rpts-sbmt-grid">
                        {report.name === 'plant_production' ? (
                            <>
                                <div className="rpts-sbmt-pp-row">
                                    <div className="rpts-sbmt-col">
                                        <label>
                                            Plant
                                            <span className="rpts-sbmt-required">*</span>
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
                                            className="rpts-sbmt-input rpts-sbmt-select"
                                        >
                                            <option value="">Select Plant...</option>
                                            {plants.map(p => (
                                                <option key={p.plant_code} value={p.plant_code}>{p.plant_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="rpts-sbmt-right-col">
                                        <label>
                                            Report Date
                                            <span className="rpts-sbmt-required">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={form.report_date || ''}
                                            onChange={e => setForm(f => ({...f, report_date: e.target.value}))}
                                            required
                                            disabled={readOnly}
                                            className="rpts-sbmt-input rpts-sbmt-date"
                                        />
                                    </div>
                                </div>
                                <div className="rpts-sbmt-field-wide rpts-sbmt-grid-col-span-all">
                                    <label>Operators</label>
                                    <div>
                                        {form.plant && (form.rows || []).length === 0 && (
                                            <div className="rpts-sbmt-muted">
                                                No active operators for this plant.
                                            </div>
                                        )}
                                        {!form.plant && (
                                            <div className="rpts-sbmt-muted">
                                                Please wait, loading plant assignment...
                                            </div>
                                        )}
                                        {(form.rows || []).length > 0 && (
                                            <div className="rpts-sbmt-mb-18">
                                                <div className="rpts-sbmt-op-carousel">
                                                    {form.rows.map((row, idx) => (
                                                        <div
                                                            key={idx}
                                                            onClick={() => {
                                                                setCarouselIndex(idx)
                                                            }}
                                                            className={`rpts-sbmt-op-dot ${idx === carouselIndex ? 'active' : ''}`}
                                                        >
                                                            {idx + 1}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="rpts-sbmt-op-card">
                                                    {form.rows[carouselIndex] && (
                                                        <div className="rpts-sbmt-op-card-body">
                                                            <div className="rpts-sbmt-row">
                                                                <div className="rpts-sbmt-col">
                                                                    <label className="rpts-sbmt-label">Name</label>
                                                                    <input type="text"
                                                                           value={operatorOptions.find(opt => opt.value === form.rows[carouselIndex]?.name)?.label || ''}
                                                                           disabled className="rpts-sbmt-field"/>
                                                                </div>
                                                                <div className="rpts-sbmt-w-120">
                                                                    <label className="rpts-sbmt-label">Truck #</label>
                                                                    <input type="text"
                                                                           value={ReportUtility.getTruckNumberForOperator(form.rows[carouselIndex], mixers)}
                                                                           disabled className="rpts-sbmt-field"/>
                                                                </div>
                                                            </div>
                                                            <div className="rpts-sbmt-row">
                                                                <div className="rpts-sbmt-col">
                                                                    <label className="rpts-sbmt-label">Start Time</label>
                                                                    <input type="time" placeholder="Start Time"
                                                                           value={form.rows[carouselIndex]?.start_time || ''}
                                                                           onChange={e => handleChange(e, 'rows', carouselIndex, 'start_time')}
                                                                           disabled={!!readOnly} className="rpts-sbmt-field"/>
                                                                </div>
                                                                <div className="rpts-sbmt-col">
                                                                    <label className="rpts-sbmt-label">1st Load</label>
                                                                    <input type="time" placeholder="1st Load"
                                                                           value={form.rows[carouselIndex]?.first_load || ''}
                                                                           onChange={e => handleChange(e, 'rows', carouselIndex, 'first_load')}
                                                                           disabled={!!readOnly} className="rpts-sbmt-field"/>
                                                                </div>
                                                            </div>
                                                            <div className="rpts-sbmt-row">
                                                                <div className="rpts-sbmt-col">
                                                                    <label className="rpts-sbmt-label">EOD In Yard</label>
                                                                    <input type="time" placeholder="EOD"
                                                                           value={form.rows[carouselIndex]?.eod_in_yard || ''}
                                                                           onChange={e => handleChange(e, 'rows', carouselIndex, 'eod_in_yard')}
                                                                           disabled={!!readOnly} className="rpts-sbmt-field"/>
                                                                </div>
                                                                <div className="rpts-sbmt-col">
                                                                    <label className="rpts-sbmt-label">Punch Out</label>
                                                                    <input type="time" placeholder="Punch Out"
                                                                           value={form.rows[carouselIndex]?.punch_out || ''}
                                                                           onChange={e => handleChange(e, 'rows', carouselIndex, 'punch_out')}
                                                                           disabled={!!readOnly} className="rpts-sbmt-field"/>
                                                                </div>
                                                            </div>
                                                            <div className="rpts-sbmt-row">
                                                                <div className="rpts-sbmt-col">
                                                                    <label className="rpts-sbmt-label">Total Loads</label>
                                                                    <input type="number" placeholder="Total Loads"
                                                                           value={form.rows[carouselIndex]?.loads || ''}
                                                                           onChange={e => handleChange(e, 'rows', carouselIndex, 'loads')}
                                                                           disabled={readOnly} className="rpts-sbmt-field"/>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="rpts-sbmt-label">Comments</label>
                                                                <input type="text" placeholder="Comments"
                                                                       value={form.rows[carouselIndex]?.comments || ''}
                                                                       onChange={e => handleChange(e, 'rows', carouselIndex, 'comments')}
                                                                       disabled={readOnly} className="rpts-sbmt-field"/>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="rpts-sbmt-op-card-actions">
                                                        <button type="button"
                                                                onClick={() => handleExcludeOperator(carouselIndex)}
                                                                className="rpts-sbmt-btn-secondary">
                                                            Exclude Operator
                                                        </button>
                                                        <button type="button"
                                                                onClick={() => setCarouselIndex(i => Math.max(i - 1, 0))}
                                                                disabled={carouselIndex === 0} className="rpts-sbmt-btn-primary">
                                                            &#8592; Prev Operator
                                                        </button>
                                                        <span className="rpts-sbmt-operator-count">
                                                            Operator {carouselIndex + 1} of {form.rows.length}
                                                        </span>
                                                        <button type="button"
                                                                onClick={() => setCarouselIndex(i => Math.min(i + 1, form.rows.length - 1))}
                                                                disabled={carouselIndex === form.rows.length - 1}
                                                                className="rpts-sbmt-btn-primary">
                                                            Next Operator &#8594;
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {excludedOperators.length > 0 && (
                                            <div className="rpts-sbmt-my-18">
                                                <div className="rpts-sbmt-section-title">
                                                    Excluded Operators
                                                </div>
                                                <div className="rpts-sbmt-flex-wrap">
                                                    {excludedOperators.map(opId => {
                                                        const op = operatorOptions.find(opt => opt.value === opId)
                                                        return (
                                                            <button key={opId} type="button"
                                                                    onClick={() => handleReincludeOperator(opId)}
                                                                    className="rpts-sbmt-chip-btn">
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
                                    <div key={field.name} className="rpts-sbmt-field-wide">
                                        <label>
                                            {field.name === 'yardage' ? 'Total Yardage' : field.label}
                                            {field.required && <span className="rpts-sbmt-required">*</span>}
                                        </label>
                                        {field.type === 'textarea' ? (
                                            <textarea value={form[field.name] || ''}
                                                      onChange={e => handleChange(e, field.name)}
                                                      required={field.required} disabled={readOnly}/>
                                        ) : field.type === 'select' ? (
                                            <select value={form[field.name] || ''}
                                                    onChange={e => handleChange(e, field.name)}
                                                    required={field.required} disabled={readOnly}>
                                                <option value="">Select...</option>
                                                {field.options?.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input type={field.type} value={form[field.name] || ''}
                                                   onChange={e => handleChange(e, field.name)} required={field.required}
                                                   disabled={readOnly}/>
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
                    {error && <div className="rpts-sbmt-error">{error}</div>}
                    {success &&
                        <div className="rpts-sbmt-success">Report submitted successfully.</div>}
                    {saveMessage && <div className="rpts-sbmt-success">{saveMessage}</div>}
                    {!readOnly && (
                        <div className="rpts-sbmt-actions-wide rpts-sbmt-actions">
                            <button type="button" className="rpts-sbmt-cancel" onClick={handleBackClick}
                                    disabled={submitting || savingDraft}>
                                Cancel
                            </button>
                            <button type="button" className="rpts-sbmt-save" onClick={handleSaveDraft} disabled={submitting || savingDraft}>
                                {savingDraft ? 'Saving...' : 'Save Changes'}
                            </button>
                            {(!managerEditUser) && (
                                <button type="submit" className="rpts-sbmt-submit"
                                        disabled={submitting || savingDraft}>
                                    {submitting ? 'Submitting...' : 'Submit'}
                                </button>
                            )}
                        </div>
                    )}
                </form>
            </div>
            {showConfirmationModal && (
                <div className="rpts-sbmt-modal-backdrop">
                    <div className="rpts-sbmt-modal-content">
                        <h2 className="rpts-sbmt-modal-title">Confirm Submission</h2>
                        <div className="rpts-sbmt-modal-text">Please confirm the following before submitting:</div>
                        <div>
                            <label className="rpts-sbmt-checkbox-label">
                                <input type="checkbox" checked={confirmationChecks[0]}
                                       onChange={e => setConfirmationChecks([e.target.checked, confirmationChecks[1]])}/>
                                Total yardage includes all yardage we can bill for and does not include lost yardage.
                            </label>
                        </div>
                        <div>
                            <label className="rpts-sbmt-checkbox-label">
                                <input type="checkbox" checked={confirmationChecks[1]}
                                       onChange={e => setConfirmationChecks([confirmationChecks[0], e.target.checked])}/>
                                Total hours only includes hours from operators and not from plant managers, loader operators or any other roles.
                            </label>
                        </div>
                        <div className="rpts-sbmt-modal-actions">
                            <button type="button" className="rpts-sbmt-btn-secondary" onClick={() => setShowConfirmationModal(false)}>
                                Cancel
                            </button>
                            <button type="button" className="rpts-sbmt-btn-confirm" disabled={!(confirmationChecks[0] && confirmationChecks[1])}
                                    onClick={handleConfirmedSubmit}>
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
