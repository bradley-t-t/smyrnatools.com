import React, { useState, useEffect } from 'react'
import './styles/ReportsSubmitView.css'
import { supabase } from '../../../services/DatabaseService'
import { ReportService } from '../../../services/ReportService'
import { PlantManagerSubmitPlugin } from './plugins/WeeklyPlantManagerReportPlugin'
import { DistrictManagerSubmitPlugin } from './plugins/WeeklyDistrictManagerReportPlugin'
import { PlantProductionSubmitPlugin } from './plugins/WeeklyPlantProductionReportPlugin'
import { WeeklyGeneralManagerReportPlugin } from './plugins/WeeklyGeneralManagerReportPlugin'

const plugins = {
    plant_manager: PlantManagerSubmitPlugin,
    district_manager: DistrictManagerSubmitPlugin,
    plant_production: PlantProductionSubmitPlugin
}

function ReportsSubmitView({ report, initialData, onBack, onSubmit, user, readOnly, allReports, managerEditUser, userProfiles }) {
    const [form, setForm] = useState(() => {
        if (initialData) {
            if (initialData.data) {
                return { ...Object.fromEntries(report.fields.map(f => [f.name, f.type === 'table' ? [] : ''])), ...initialData.data, ...(initialData.rows ? { rows: initialData.rows } : {}) }
            }
            return { ...Object.fromEntries(report.fields.map(f => [f.name, f.type === 'table' ? [] : ''])), ...initialData }
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
    const [yphColor, setYphColor] = useState('')
    const [yphLabel, setYphLabel] = useState('')
    const [lost, setLost] = useState(null)
    const [lostGrade, setLostGrade] = useState('')
    const [lostColor, setLostColor] = useState('')
    const [lostLabel, setLostLabel] = useState('')
    const [carouselIndex, setCarouselIndex] = useState(0)
    const [rowStep, setRowStep] = useState(0)
    const [operatorOptions, setOperatorOptions] = useState([])
    const [mixers, setMixers] = useState([])
    const [plants, setPlants] = useState([])
    const [plantIndex, setPlantIndex] = useState(0)
    const [historyWeeks, setHistoryWeeks] = useState([])
    const [historyWeekIndex, setHistoryWeekIndex] = useState(0)
    const [historyReports, setHistoryReports] = useState([])
    const [showHistoryPopup, setShowHistoryPopup] = useState(false)
    const [historySearch, setHistorySearch] = useState('')
    const [excludedOperators, setExcludedOperators] = useState([])
    const [saveMessage, setSaveMessage] = useState('')
    const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [initialFormSnapshot, setInitialFormSnapshot] = useState(null)
    const [debugMsg, setDebugMsg] = useState('')
    const [showConfirmationModal, setShowConfirmationModal] = useState(false)
    const [confirmationChecks, setConfirmationChecks] = useState([false, false])

    let weekRange = ''
    if (report.weekIso) {
        weekRange = ReportService.getWeekRangeFromIso(report.weekIso)
    }
    const PluginComponent = plugins[report.name]
    const submitted = !!initialData?.completed

    function handleChange(e, name, idx, colName) {
        if (report.name === 'plant_production' && name === 'rows') {
            const updatedRows = [...(form.rows || [])]
            if (colName === 'name' || colName === 'truck_number') {
                return
            } else {
                updatedRows[idx][colName] = e.target.value
            }
            setForm({ ...form, rows: updatedRows })
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
        setForm({ ...form, [name]: value })
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setSuccess(false)
        if (report.name === 'plant_manager') {
            setShowConfirmationModal(true)
            return
        }
        if (report.name !== 'general_manager') {
            for (const field of report.fields) {
                if (field.required && (!form[field.name] || (Array.isArray(form[field.name]) && form[field.name].length === 0))) {
                    setError('Please fill out all required fields before submitting.')
                    return
                }
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
        setForm({ ...form, rows: updatedRows })
        setCarouselIndex(newIndex)
    }

    function handleReincludeOperator(operatorId) {
        if (!operatorId) return
        const op = operatorOptions.find(opt => opt.value === operatorId)
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
        setForm(f => ({
            ...f,
            rows: [...(f.rows || []), newRow]
        }))
        setCarouselIndex((form.rows || []).length)
    }

    function handleBackClick() {
        if (hasUnsavedChanges) setShowUnsavedChangesModal(true)
        else onBack()
    }

    useEffect(() => {
        async function fetchPlants() {
            const { data, error } = await supabase
                .from('plants')
                .select('plant_code,plant_name')
                .order('plant_code', { ascending: true })
            setPlants(!error && Array.isArray(data)
                ? data.filter(p => p.plant_code && p.plant_name)
                    .sort((a, b) => {
                        const aNum = parseInt(a.plant_code, 10)
                        const bNum = parseInt(b.plant_code, 10)
                        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
                        return String(a.plant_code).localeCompare(String(b.plant_code))
                    })
                : []
            )
        }
        fetchPlants()
    }, [])
    useEffect(() => {
        async function fetchMaintenanceItems() {
            let weekStart, weekEnd
            if (report.weekIso) {
                const monday = new Date(report.weekIso)
                monday.setDate(monday.getDate() + 1)
                monday.setHours(0, 0, 0, 0)
                const saturday = new Date(monday)
                saturday.setDate(monday.getDate() + 5)
                weekStart = monday
                weekEnd = saturday
            } else {
                return
            }
            const { data, error } = await supabase
                .from('list_items')
                .select('*')
                .eq('completed', true)
                .gte('completed_at', weekStart.toISOString())
                .lte('completed_at', weekEnd.toISOString())
            setMaintenanceItems(!error && Array.isArray(data) ? data : [])
        }
        fetchMaintenanceItems()
    }, [report.weekIso])

    useEffect(() => {
        if (report.name === 'plant_production' && !form.plant && user && plants.length > 0) {
            setForm(f => ({ ...f, plant: plants[0]?.plant_code || '' }))
        }
    }, [report.name, form.plant, user, plants])

    useEffect(() => {
        async function fetchOperatorsAndMixers(plantCode) {
            if (!plantCode) {
                setOperatorOptions([])
                setMixers([])
                setForm(f => ({ ...f, rows: [] }))
                return
            }
            const { data: operatorsData, error: opError } = await supabase
                .from('operators')
                .select('employee_id, name, status, plant_code, position')
                .eq('plant_code', plantCode)
                .eq('status', 'Active')
                .eq('position', 'Mixer Operator')
            let activeOperators = []
            if (!opError && Array.isArray(operatorsData)) {
                activeOperators = operatorsData
                setOperatorOptions(
                    operatorsData.map(u => ({
                        value: u.employee_id,
                        label: u.name
                    }))
                )
            } else {
                setOperatorOptions([])
            }
            const { data: mixersData, error: mixError } = await supabase
                .from('mixers')
                .select('assigned_operator, truck_number')
                .eq('assigned_plant', plantCode)
            let assignedMixers = []
            if (!mixError && Array.isArray(mixersData)) {
                assignedMixers = mixersData
                setMixers(mixersData)
            } else {
                setMixers([])
            }
            if (report.name === 'plant_production' && !readOnly) {
                if ((!initialData || !initialData.rows || initialData.rows.length === 0) && (!form.rows || form.rows.length === 0)) {
                    const rows = []
                    activeOperators.forEach(op => {
                        const mixer = assignedMixers.find(m => m.assigned_operator === op.employee_id)
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
                    setForm(f => ({ ...f, rows }))
                    setCarouselIndex(0)
                }
            }
        }
        if (report.name === 'plant_production') {
            let plantCode = form.plant
            if (!plantCode) {
                setForm(f => ({ ...f, rows: [] }))
                return
            }
            fetchOperatorsAndMixers(plantCode)
        }
    }, [report.name, form.plant, user, readOnly, plants])

    useEffect(() => {
        if (initialData) {
            if (initialData.data) {
                setForm(f => ({
                    ...Object.fromEntries(report.fields.map(f => [f.name, f.type === 'table' ? [] : ''])),
                    ...initialData.data,
                    ...(initialData.rows ? { rows: initialData.rows } : {})
                }))
            } else {
                setForm(f => ({
                    ...Object.fromEntries(report.fields.map(f => [f.name, f.type === 'table' ? [] : ''])),
                    ...initialData
                }))
            }
        }
    }, [initialData])

    useEffect(() => {
        let yards = null
        let hours = null
        let lostVal = null

        if (report.name === 'plant_manager') {
            yards = parseFloat(form.yardage)
            hours = parseFloat(form.total_hours)
            if (typeof form.total_yards_lost !== 'undefined' && form.total_yards_lost !== '' && !isNaN(Number(form.total_yards_lost))) {
                lostVal = Number(form.total_yards_lost)
            }
        } else {
            yards = parseFloat(form.total_yards_delivered)
            hours = parseFloat(form.total_operator_hours)
            if (
                typeof form.yardage_lost !== 'undefined' && form.yardage_lost !== '' && !isNaN(Number(form.yardage_lost))
            ) {
                lostVal = Number(form.yardage_lost)
            } else if (
                typeof form.lost_yardage !== 'undefined' && form.lost_yardage !== '' && !isNaN(Number(form.lost_yardage))
            ) {
                lostVal = Number(form.lost_yardage)
            } else if (
                typeof form['Yardage Lost'] !== 'undefined' && form['Yardage Lost'] !== '' && !isNaN(Number(form['Yardage Lost']))
            ) {
                lostVal = Number(form['Yardage Lost'])
            } else if (
                typeof form['yardage_lost'] !== 'undefined' && form['yardage_lost'] !== '' && !isNaN(Number(form['yardage_lost']))
            ) {
                lostVal = Number(form['yardage_lost'])
            }
        }

        if (lostVal !== null && lostVal < 0) {
            lostVal = 0
            let updatedForm = { ...form }
            if (report.name === 'plant_manager' && typeof form.total_yards_lost !== 'undefined') {
                updatedForm.total_yards_lost = 0
            }
            if (typeof form.yardage_lost !== 'undefined') updatedForm.yardage_lost = 0
            if (typeof form.lost_yardage !== 'undefined') updatedForm.lost_yardage = 0
            if (typeof form['Yardage Lost'] !== 'undefined') updatedForm['Yardage Lost'] = 0
            if (typeof form['yardage_lost'] !== 'undefined') updatedForm['yardage_lost'] = 0
            setForm(updatedForm)
        }

        const yphVal = !isNaN(yards) && !isNaN(hours) && hours > 0 ? yards / hours : null
        setYph(yphVal)
        let grade = ''
        if (yphVal !== null) {
            if (yphVal >= 6) grade = 'excellent'
            else if (yphVal >= 4) grade = 'good'
            else if (yphVal >= 3) grade = 'average'
            else grade = 'poor'
        }
        setYphGrade(grade)
        let color = ''
        if (grade === 'excellent') color = 'var(--excellent)'
        else if (grade === 'good') color = 'var(--success)'
        else if (grade === 'average') color = 'var(--warning)'
        else if (grade === 'poor') color = 'var(--error)'
        setYphColor(color)
        let label = ''
        if (grade === 'excellent') label = 'Excellent'
        else if (grade === 'good') label = 'Good'
        else if (grade === 'average') label = 'Average'
        else if (grade === 'poor') label = 'Poor'
        setYphLabel(label)

        setLost(lostVal)
        let lostGradeVal = ''
        if (lostVal !== null) {
            if (lostVal === 0) lostGradeVal = 'excellent'
            else if (lostVal < 5) lostGradeVal = 'good'
            else if (lostVal < 10) lostGradeVal = 'average'
            else lostGradeVal = 'poor'
        }
        setLostGrade(lostGradeVal)
        let lostColorVal = ''
        if (lostGradeVal === 'excellent') lostColorVal = 'var(--excellent)'
        else if (lostGradeVal === 'good') lostColorVal = 'var(--success)'
        else if (lostGradeVal === 'average') lostColorVal = 'var(--warning)'
        else if (lostGradeVal === 'poor') lostColorVal = 'var(--error)'
        setLostColor(lostColorVal)
        let lostLabelVal = ''
        if (lostGradeVal === 'excellent') lostLabelVal = 'Excellent'
        else if (lostGradeVal === 'good') lostLabelVal = 'Good'
        else if (lostGradeVal === 'average') lostLabelVal = 'Average'
        else if (lostGradeVal === 'poor') lostLabelVal = 'Poor'
        setLostLabel(lostLabelVal)
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
            setForm(f => ({ ...f, plant: user.plant_code }))
        }
    }, [report.name, user])

    let editingUserName = ''
    if (managerEditUser && userProfiles && userProfiles[managerEditUser]) {
        const profile = userProfiles[managerEditUser]
        editingUserName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    } else if (managerEditUser) {
        editingUserName = managerEditUser.slice(0, 8)
    }

    useEffect(() => {
        async function fetchHistoryReports() {
            if (report.name !== 'general_manager' || !user?.id) {
                setHistoryReports([])
                setHistoryWeeks([])
                return
            }
            const { data, error } = await supabase
                .from('reports')
                .select('id,week,data,completed')
                .eq('report_name', 'general_manager')
                .eq('user_id', user.id)
                .order('week', { ascending: false })
            let reports = Array.isArray(data) ? data : []
            let weeks = reports.map(r => r.week ? new Date(r.week).toISOString().slice(0, 10) : '').filter(Boolean)
            if (report.weekIso && !weeks.includes(report.weekIso)) {
                weeks = [report.weekIso, ...weeks]
                reports = [{ week: report.weekIso, data: form, completed: !!initialData?.completed }, ...reports]
            }
            setHistoryReports(reports)
            setHistoryWeeks(weeks)
            setHistoryWeekIndex(weeks.findIndex(w => w === report.weekIso) !== -1 ? weeks.findIndex(w => w === report.weekIso) : 0)
        }
        fetchHistoryReports()
    }, [report.name, user, report.weekIso, initialData, form])
    function getHistoryFormForWeek(weekIso) {
        const found = historyReports.find(r => r.week && new Date(r.week).toISOString().slice(0, 10) === weekIso)
        return found && found.data ? found.data : {}
    }
    function isCurrentWeek(weekIso) {
        return false
    }
    const filteredHistoryWeeks = historyWeeks.filter(weekIso =>
        ReportService.getWeekRangeFromIso(weekIso).toLowerCase().includes(historySearch.toLowerCase()) ||
        (isCurrentWeek(weekIso) && 'current week'.includes(historySearch.toLowerCase()))
    )

    return (
        <div style={{ width: '100%', minHeight: '100vh', background: 'var(--background)' }}>
            <div style={{ maxWidth: 900, margin: '56px auto 0 auto', padding: '0 0 32px 0' }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <button className="report-form-back" onClick={handleBackClick} type="button">
                        <i className="fas fa-arrow-left"></i> Back
                    </button>
                    {Array.isArray(form.rows) && form.rows.length > 0 && report.name === 'plant_production' && (
                        <button
                            type="button"
                            style={{
                                background: submitted ? 'var(--accent)' : 'var(--divider)',
                                color: submitted ? 'var(--text-light)' : 'var(--text-secondary)',
                                border: 'none',
                                borderRadius: 6,
                                padding: '10px 22px',
                                fontWeight: 600,
                                fontSize: 15,
                                cursor: submitted ? 'pointer' : 'not-allowed',
                                opacity: submitted ? 1 : 0.6
                            }}
                            onClick={() => {
                                if (submitted) ReportService.exportRowsToCSV(form.rows, operatorOptions, form.report_date)
                            }}
                            disabled={!submitted || readOnly}
                        >
                            Export to Spreadsheet
                        </button>
                    )}
                    {report.name !== 'plant_production' && (
                        <button
                            type="button"
                            style={{
                                background: submitted ? 'var(--accent)' : 'var(--divider)',
                                color: submitted ? 'var(--text-light)' : 'var(--text-secondary)',
                                border: 'none',
                                borderRadius: 6,
                                padding: '10px 22px',
                                fontWeight: 600,
                                fontSize: 15,
                                cursor: submitted ? 'pointer' : 'not-allowed',
                                opacity: submitted ? 1 : 0.6,
                                marginLeft: 12
                            }}
                            onClick={() => {
                                if (submitted) ReportService.exportReportFieldsToCSV(report, form)
                            }}
                            disabled={!submitted || readOnly}
                        >
                            Export to Spreadsheet
                        </button>
                    )}
                </div>
                <div className="report-form-header-row" style={{ marginTop: 0 }}>
                    <div className="report-form-title">
                        {report.title || ''}
                    </div>
                    {weekRange && (
                        <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--accent)' }}>
                            {weekRange}
                        </div>
                    )}
                </div>
                <form className="report-form-body-wide" onSubmit={handleSubmit}>
                    {report.name === 'general_manager' ? (
                        <>
                            <div style={{ width: '100%', marginBottom: 32 }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-end',
                                    marginBottom: 12
                                }}>
                                    <div>
                                        <div style={{
                                            fontWeight: 800,
                                            fontSize: 22,
                                            color: 'var(--accent)',
                                            letterSpacing: '0.03em',
                                            marginBottom: 4
                                        }}>
                                            {plants[plantIndex]?.plant_name || ''}
                                        </div>
                                        <div style={{
                                            fontWeight: 600,
                                            fontSize: 16,
                                            color: 'var(--text-secondary)'
                                        }}>
                                            {plants[plantIndex]?.plant_code || ''}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <button
                                            type="button"
                                            style={{
                                                background: plantIndex > 0 ? 'var(--accent)' : 'var(--divider)',
                                                color: plantIndex > 0 ? 'var(--text-light)' : 'var(--text-secondary)',
                                                border: 'none',
                                                borderRadius: 8,
                                                padding: '8px 22px',
                                                fontWeight: 600,
                                                fontSize: 16,
                                                cursor: plantIndex > 0 ? 'pointer' : 'not-allowed',
                                                opacity: plantIndex > 0 ? 1 : 0.6
                                            }}
                                            disabled={plantIndex === 0}
                                            onClick={() => setPlantIndex(i => Math.max(0, i - 1))}
                                        >
                                            Prev
                                        </button>
                                        <button
                                            type="button"
                                            style={{
                                                background: plantIndex < plants.length - 1 ? 'var(--accent)' : 'var(--divider)',
                                                color: plantIndex < plants.length - 1 ? 'var(--text-light)' : 'var(--text-secondary)',
                                                border: 'none',
                                                borderRadius: 8,
                                                padding: '8px 22px',
                                                fontWeight: 600,
                                                fontSize: 16,
                                                cursor: plantIndex < plants.length - 1 ? 'pointer' : 'not-allowed',
                                                opacity: plantIndex < plants.length - 1 ? 1 : 0.6
                                            }}
                                            disabled={plantIndex === plants.length - 1}
                                            onClick={() => setPlantIndex(i => Math.min(plants.length - 1, i + 1))}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                                <div style={{
                                    width: '100%',
                                    height: 1,
                                    background: 'var(--divider)',
                                    margin: '8px 0 24px 0'
                                }} />
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <div style={{
                                        width: '100%',
                                        maxWidth: 500,
                                        background: 'var(--background-elevated)',
                                        borderRadius: 18,
                                        boxShadow: '0 2px 12px var(--shadow-sm)',
                                        padding: '32px 24px',
                                        marginBottom: 24,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 18
                                    }}>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: 18
                                        }}>
                                            <div>
                                                <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, display: 'block' }}>
                                                    Active Operators
                                                </label>
                                                <input
                                                    type="number"
                                                    value={plants[plantIndex]?.plant_code ? form[`active_operators_${plants[plantIndex].plant_code}`] || '' : ''}
                                                    onChange={e => {
                                                        if (plants[plantIndex]?.plant_code) {
                                                            setForm(f => ({ ...f, [`active_operators_${plants[plantIndex].plant_code}`]: e.target.value }))
                                                        }
                                                    }}
                                                    disabled={readOnly}
                                                    style={{
                                                        width: '100%',
                                                        fontSize: 17,
                                                        padding: '10px 14px',
                                                        borderRadius: 8,
                                                        border: '1.5px solid var(--divider)',
                                                        background: 'var(--background)',
                                                        color: 'var(--text-primary)',
                                                        fontWeight: 600
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, display: 'block' }}>
                                                    Runnable Trucks<span className="report-modal-required">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    value={plants[plantIndex]?.plant_code ? form[`runnable_trucks_${plants[plantIndex].plant_code}`] || '' : ''}
                                                    onChange={e => {
                                                        if (plants[plantIndex]?.plant_code) {
                                                            setForm(f => ({ ...f, [`runnable_trucks_${plants[plantIndex].plant_code}`]: e.target.value }))
                                                        }
                                                    }}
                                                    required
                                                    disabled={readOnly}
                                                    style={{
                                                        width: '100%',
                                                        fontSize: 17,
                                                        padding: '10px 14px',
                                                        borderRadius: 8,
                                                        border: '1.5px solid var(--divider)',
                                                        background: 'var(--background)',
                                                        color: 'var(--text-primary)',
                                                        fontWeight: 600
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, display: 'block' }}>
                                                    Down Trucks
                                                </label>
                                                <input
                                                    type="number"
                                                    value={plants[plantIndex]?.plant_code ? form[`down_trucks_${plants[plantIndex].plant_code}`] || '' : ''}
                                                    onChange={e => {
                                                        if (plants[plantIndex]?.plant_code) {
                                                            setForm(f => ({ ...f, [`down_trucks_${plants[plantIndex].plant_code}`]: e.target.value }))
                                                        }
                                                    }}
                                                    disabled={readOnly}
                                                    style={{
                                                        width: '100%',
                                                        fontSize: 17,
                                                        padding: '10px 14px',
                                                        borderRadius: 8,
                                                        border: '1.5px solid var(--divider)',
                                                        background: 'var(--background)',
                                                        color: 'var(--text-primary)',
                                                        fontWeight: 600
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, display: 'block' }}>
                                                    Operators Starting<span className="report-modal-required">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    value={plants[plantIndex]?.plant_code ? form[`operators_starting_${plants[plantIndex].plant_code}`] || '' : ''}
                                                    onChange={e => {
                                                        if (plants[plantIndex]?.plant_code) {
                                                            setForm(f => ({ ...f, [`operators_starting_${plants[plantIndex].plant_code}`]: e.target.value }))
                                                        }
                                                    }}
                                                    required
                                                    disabled={readOnly}
                                                    style={{
                                                        width: '100%',
                                                        fontSize: 17,
                                                        padding: '10px 14px',
                                                        borderRadius: 8,
                                                        border: '1.5px solid var(--divider)',
                                                        background: 'var(--background)',
                                                        color: 'var(--text-primary)',
                                                        fontWeight: 600
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, display: 'block' }}>
                                                    New Operators Training
                                                </label>
                                                <input
                                                    type="number"
                                                    value={plants[plantIndex]?.plant_code ? form[`new_operators_training_${plants[plantIndex].plant_code}`] || '' : ''}
                                                    onChange={e => {
                                                        if (plants[plantIndex]?.plant_code) {
                                                            setForm(f => ({ ...f, [`new_operators_training_${plants[plantIndex].plant_code}`]: e.target.value }))
                                                        }
                                                    }}
                                                    disabled={readOnly}
                                                    style={{
                                                        width: '100%',
                                                        fontSize: 17,
                                                        padding: '10px 14px',
                                                        borderRadius: 8,
                                                        border: '1.5px solid var(--divider)',
                                                        background: 'var(--background)',
                                                        color: 'var(--text-primary)',
                                                        fontWeight: 600
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, display: 'block' }}>
                                                    Operators Leaving<span className="report-modal-required">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    value={plants[plantIndex]?.plant_code ? form[`operators_leaving_${plants[plantIndex].plant_code}`] || '' : ''}
                                                    onChange={e => {
                                                        if (plants[plantIndex]?.plant_code) {
                                                            setForm(f => ({ ...f, [`operators_leaving_${plants[plantIndex].plant_code}`]: e.target.value }))
                                                        }
                                                    }}
                                                    required
                                                    disabled={readOnly}
                                                    style={{
                                                        width: '100%',
                                                        fontSize: 17,
                                                        padding: '10px 14px',
                                                        borderRadius: 8,
                                                        border: '1.5px solid var(--divider)',
                                                        background: 'var(--background)',
                                                        color: 'var(--text-primary)',
                                                        fontWeight: 600
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, display: 'block' }}>
                                                    Total Yardage<span className="report-modal-required">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    value={plants[plantIndex]?.plant_code ? form[`total_yardage_${plants[plantIndex].plant_code}`] || '' : ''}
                                                    onChange={e => {
                                                        if (plants[plantIndex]?.plant_code) {
                                                            setForm(f => ({ ...f, [`total_yardage_${plants[plantIndex].plant_code}`]: e.target.value }))
                                                        }
                                                    }}
                                                    required
                                                    disabled={readOnly}
                                                    style={{
                                                        width: '100%',
                                                        fontSize: 17,
                                                        padding: '10px 14px',
                                                        borderRadius: 8,
                                                        border: '1.5px solid var(--divider)',
                                                        background: 'var(--background)',
                                                        color: 'var(--text-primary)',
                                                        fontWeight: 600
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, display: 'block' }}>
                                                    Total Hours<span className="report-modal-required">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    value={plants[plantIndex]?.plant_code ? form[`total_hours_${plants[plantIndex].plant_code}`] || '' : ''}
                                                    onChange={e => {
                                                        if (plants[plantIndex]?.plant_code) {
                                                            setForm(f => ({ ...f, [`total_hours_${plants[plantIndex].plant_code}`]: e.target.value }))
                                                        }
                                                    }}
                                                    required
                                                    disabled={readOnly}
                                                    style={{
                                                        width: '100%',
                                                        fontSize: 17,
                                                        padding: '10px 14px',
                                                        borderRadius: 8,
                                                        border: '1.5px solid var(--divider)',
                                                        background: 'var(--background)',
                                                        color: 'var(--text-primary)',
                                                        fontWeight: 600
                                                    }}
                                                />
                                            </div>
                                            <div style={{ gridColumn: '1 / span 2' }}>
                                                <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, display: 'block' }}>
                                                    Comments
                                                </label>
                                                <textarea
                                                    value={plants[plantIndex]?.plant_code ? form[`comments_${plants[plantIndex].plant_code}`] || '' : ''}
                                                    onChange={e => {
                                                        if (plants[plantIndex]?.plant_code) {
                                                            setForm(f => ({ ...f, [`comments_${plants[plantIndex].plant_code}`]: e.target.value }))
                                                        }
                                                    }}
                                                    disabled={readOnly}
                                                    style={{
                                                        width: '100%',
                                                        fontSize: 16,
                                                        padding: '10px 14px',
                                                        borderRadius: 8,
                                                        border: '1.5px solid var(--divider)',
                                                        background: 'var(--background)',
                                                        color: 'var(--text-primary)',
                                                        fontWeight: 500,
                                                        minHeight: 48
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div style={{
                                            marginTop: 32,
                                            width: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center'
                                        }}>
                                            <WeeklyGeneralManagerReportPlugin
                                                plantCode={plants[plantIndex]?.plant_code || ''}
                                                yardage={plants[plantIndex]?.plant_code ? form[`total_yardage_${plants[plantIndex].plant_code}`] : ''}
                                                hours={plants[plantIndex]?.plant_code ? form[`total_hours_${plants[plantIndex].plant_code}`] : ''}
                                                averages={
                                                    (() => {
                                                        if (!plants.length) return null
                                                        let totalRunnable = 0
                                                        let totalStarting = 0
                                                        let totalLeaving = 0
                                                        let totalYardage = 0
                                                        let totalHours = 0
                                                        let count = 0
                                                        plants.forEach(p => {
                                                            const pc = p.plant_code
                                                            const r = Number(form[`runnable_trucks_${pc}`]) || 0
                                                            const s = Number(form[`operators_starting_${pc}`]) || 0
                                                            const l = Number(form[`operators_leaving_${pc}`]) || 0
                                                            const y = Number(form[`total_yardage_${pc}`]) || 0
                                                            const h = Number(form[`total_hours_${pc}`]) || 0
                                                            totalRunnable += r
                                                            totalStarting += s
                                                            totalLeaving += l
                                                            totalYardage += y
                                                            totalHours += h
                                                            count += 1
                                                        })
                                                        const avgYph = totalHours > 0 ? totalYardage / totalHours : null
                                                        return {
                                                            runnableTrucks: count ? (totalRunnable / count).toFixed(2) : '-',
                                                            operatorsStarting: count ? (totalStarting / count).toFixed(2) : '-',
                                                            operatorsLeaving: count ? (totalLeaving / count).toFixed(2) : '-',
                                                            yardage: count ? (totalYardage / count).toFixed(2) : '-',
                                                            hours: count ? (totalHours / count).toFixed(2) : '-',
                                                            yph: avgYph
                                                        }
                                                    })()
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div style={{ width: '100%', maxWidth: 700, margin: '24px auto 0 auto' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                            <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--accent)' }}>
                                                Previous Weeks Statistics
                                            </div>
                                            <div>
                                                <button
                                                    type="button"
                                                    style={{
                                                        background: 'var(--background)',
                                                        border: '1.5px solid var(--divider)',
                                                        borderRadius: 8,
                                                        fontSize: 15,
                                                        padding: '6px 14px',
                                                        color: 'var(--text-primary)',
                                                        minWidth: 180,
                                                        boxShadow: '0 1px 4px var(--shadow-xs)',
                                                        outline: 'none',
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => setShowHistoryPopup(true)}
                                                >
                                                    {historyWeeks.length > 0 && historyWeeks[historyWeekIndex]
                                                        ? isCurrentWeek(historyWeeks[historyWeekIndex])
                                                            ? 'Current Week'
                                                            : ReportService.getWeekRangeFromIso(historyWeeks[historyWeekIndex])
                                                        : 'Select Week'}
                                                </button>
                                                {showHistoryPopup && (
                                                    <div style={{
                                                        position: 'fixed',
                                                        top: 0,
                                                        left: 0,
                                                        width: '100vw',
                                                        height: '100vh',
                                                        background: 'rgba(0,0,0,0.3)',
                                                        zIndex: 9999,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        <div style={{
                                                            background: 'var(--background)',
                                                            borderRadius: 12,
                                                            boxShadow: '0 2px 16px var(--shadow-lg)',
                                                            width: '90%',
                                                            maxWidth: 420,
                                                            maxHeight: '80vh',
                                                            overflow: 'hidden',
                                                            display: 'flex',
                                                            flexDirection: 'column'
                                                        }}>
                                                            <div style={{
                                                                padding: '18px 18px 8px 18px',
                                                                borderBottom: '1px solid var(--divider)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 12
                                                            }}>
                                                                <input
                                                                    type="text"
                                                                    value={historySearch}
                                                                    onChange={e => setHistorySearch(e.target.value)}
                                                                    placeholder="Search week range..."
                                                                    className="history-search-input"
                                                                    style={{
                                                                        width: '100%',
                                                                        fontSize: 15,
                                                                        padding: '8px 12px',
                                                                        borderRadius: 8,
                                                                        border: '1.5px solid var(--divider)',
                                                                        background: 'var(--background)',
                                                                        color: 'var(--text-primary)'
                                                                    }}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    style={{
                                                                        background: 'var(--divider)',
                                                                        color: 'var(--text-primary)',
                                                                        border: 'none',
                                                                        borderRadius: 8,
                                                                        padding: '8px 14px',
                                                                        fontWeight: 600,
                                                                        fontSize: 15,
                                                                        cursor: 'pointer'
                                                                    }}
                                                                    onClick={() => setShowHistoryPopup(false)}
                                                                >
                                                                    Close
                                                                </button>
                                                            </div>
                                                            <div style={{
                                                                overflowY: 'auto',
                                                                flex: 1,
                                                                padding: '8px 0'
                                                            }}>
                                                                {filteredHistoryWeeks.length === 0 ? (
                                                                    <div style={{
                                                                        padding: '24px',
                                                                        textAlign: 'center',
                                                                        color: 'var(--text-secondary)'
                                                                    }}>
                                                                        No reports found
                                                                    </div>
                                                                ) : (
                                                                    filteredHistoryWeeks.map((weekIso, idx) => (
                                                                        <button
                                                                            key={weekIso}
                                                                            type="button"
                                                                            style={{
                                                                                width: '100%',
                                                                                textAlign: 'left',
                                                                                padding: '12px 18px',
                                                                                background: historyWeeks[historyWeekIndex] === weekIso ? 'var(--accent)' : 'var(--background)',
                                                                                color: historyWeeks[historyWeekIndex] === weekIso ? 'var(--text-light)' : 'var(--text-primary)',
                                                                                border: 'none',
                                                                                borderBottom: '1px solid var(--divider)',
                                                                                fontWeight: 600,
                                                                                fontSize: 15,
                                                                                cursor: 'pointer'
                                                                            }}
                                                                            onClick={() => {
                                                                                setHistoryWeekIndex(historyWeeks.indexOf(weekIso))
                                                                                setShowHistoryPopup(false)
                                                                            }}
                                                                        >
                                                                            <span style={{
                                                                                color: historyWeeks[historyWeekIndex] === weekIso ? 'var(--text-light)' : 'var(--text-primary)'
                                                                            }}>
                                                                                {isCurrentWeek(weekIso) ? 'Current Week' : ReportService.getWeekRangeFromIso(weekIso)}
                                                                            </span>
                                                                        </button>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <table style={{ width: 'calc(100% + 125px)', borderCollapse: 'collapse', background: 'var(--background-elevated)', borderRadius: 12, boxShadow: '0 1px 6px var(--shadow-xs)' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--background)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 12 }}>
                                                    <th style={{ padding: '12px 8px', borderBottom: '1px solid var(--divider)', textAlign: 'left' }}>Plant</th>
                                                    <th style={{ padding: '12px 8px', borderBottom: '1px solid var(--divider)', textAlign: 'right' }}>Runnable Trucks</th>
                                                    <th style={{ padding: '12px 8px', borderBottom: '1px solid var(--divider)', textAlign: 'right' }}>Operators Starting</th>
                                                    <th style={{ padding: '12px 8px', borderBottom: '1px solid var(--divider)', textAlign: 'right' }}>Operators Leaving</th>
                                                    <th style={{ padding: '12px 8px', borderBottom: '1px solid var(--divider)', textAlign: 'right' }}>Yardage</th>
                                                    <th style={{ padding: '12px 8px', borderBottom: '1px solid var(--divider)', textAlign: 'right' }}>Hours</th>
                                                    <th style={{ padding: '12px 8px', borderBottom: '1px solid var(--divider)', textAlign: 'right' }}>Yards/Hour</th>
                                                    <th style={{ padding: '12px 8px', borderBottom: '1px solid var(--divider)', textAlign: 'right' }}>Variance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {plants.map(plant => {
                                                    const isCurrent = isCurrentWeek(historyWeeks[historyWeekIndex])
                                                    let runnableTrucks, operatorsStarting, operatorsLeaving, yardage, hours, yph
                                                    if (isCurrent) {
                                                        runnableTrucks = form[`runnable_trucks_${plant.plant_code}`] || '-'
                                                        operatorsStarting = form[`operators_starting_${plant.plant_code}`] || '-'
                                                        operatorsLeaving = form[`operators_leaving_${plant.plant_code}`] || '-'
                                                        yardage = Number(form[`total_yardage_${plant.plant_code}`]) || 0
                                                        hours = Number(form[`total_hours_${plant.plant_code}`]) || 0
                                                        yph = hours > 0 ? (yardage / hours).toFixed(2) : '-'
                                                    } else {
                                                        const historyForm = getHistoryFormForWeek(historyWeeks[historyWeekIndex])
                                                        runnableTrucks = historyForm?.[`runnable_trucks_${plant.plant_code}`] || '-'
                                                        operatorsStarting = historyForm?.[`operators_starting_${plant.plant_code}`] || '-'
                                                        operatorsLeaving = historyForm?.[`operators_leaving_${plant.plant_code}`] || '-'
                                                        yardage = Number(historyForm?.[`total_yardage_${plant.plant_code}`]) || 0
                                                        hours = Number(historyForm?.[`total_hours_${plant.plant_code}`]) || 0
                                                        yph = hours > 0 ? (yardage / hours).toFixed(2) : '-'
                                                    }
                                                    let prevForm = null
                                                    if (historyWeekIndex + 1 < historyWeeks.length) {
                                                        prevForm = getHistoryFormForWeek(historyWeeks[historyWeekIndex + 1])
                                                    }
                                                    const prevYardage = prevForm ? Number(prevForm[`total_yardage_${plant.plant_code}`]) || 0 : null
                                                    function getVarianceColor(curr, prev) {
                                                        if (!prev || prev === 0) return 'var(--text-secondary)'
                                                        const percent = ((curr - prev) / prev) * 100
                                                        if (percent >= 5) return 'var(--success)'
                                                        if (percent <= -5) return 'var(--error)'
                                                        return 'var(--warning)'
                                                    }
                                                    function showYardageVariance(curr, prev) {
                                                        if (!prev || prev === 0) return '-'
                                                        const percent = ((curr - prev) / prev) * 100
                                                        if (isNaN(percent)) return '-'
                                                        if (percent === 0) return '0%'
                                                        return (percent > 0 ? '+' : '') + percent.toFixed(1) + '%'
                                                    }
                                                    const varianceValue = showYardageVariance(yardage, prevYardage)
                                                    const varianceColor = getVarianceColor(yardage, prevYardage)
                                                    return (
                                                        <tr key={plant.plant_code} style={{ borderBottom: '1px solid var(--divider)' }}>
                                                            <td style={{ padding: '10px 8px', textAlign: 'left', color: 'var(--text-primary)', fontWeight: 600 }}>{plant.plant_name}</td>
                                                            <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>{runnableTrucks}</td>
                                                            <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>{operatorsStarting}</td>
                                                            <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>{operatorsLeaving}</td>
                                                            <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>{yardage || '-'}</td>
                                                            <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>{hours || '-'}</td>
                                                            <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>{yph}</td>
                                                            <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: varianceColor }}>
                                                                {varianceValue}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        report.fields.map(field => (
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
                        ))
                    )}
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
                            />
                        </>
                    )}
                    {error && <div className="report-modal-error">{error}</div>}
                    {success && <div style={{ color: 'var(--success)', marginBottom: 8 }}>Report submitted successfully.</div>}
                    {saveMessage && <div style={{ color: 'var(--success)', marginBottom: 8 }}>{saveMessage}</div>}
                    {!readOnly && (
                        <div className="report-modal-actions-wide" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
            {showUnsavedChangesModal && (
                <div className="confirmation-modal" style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.5)'}}>
                    <div className="confirmation-content" style={{width: '90%', maxWidth: '500px', margin: '0 auto'}}>
                        <h2>Unsaved Changes</h2>
                        <p>You have unsaved changes that will be lost if you navigate away. What would you like to do?</p>
                        <div className="confirmation-actions" style={{justifyContent: 'center', flexWrap: 'wrap', display: 'flex', gap: '12px'}}>
                            <button className="cancel-button" onClick={() => setShowUnsavedChangesModal(false)}>Continue Editing</button>
                            <button
                                className="primary-button"
                                onClick={async () => {
                                    setShowUnsavedChangesModal(false)
                                    try {
                                        await handleSaveDraft({ preventDefault: () => {} })
                                        setTimeout(() => onBack(), 800)
                                    } catch {
                                    }
                                }}
                                disabled={submitting || savingDraft}
                                style={{background: 'var(--accent)', opacity: submitting || savingDraft ? '0.6' : '1', cursor: submitting || savingDraft ? 'not-allowed' : 'pointer'}}
                            >Save & Leave</button>
                            <button
                                className="danger-button"
                                onClick={() => {
                                    setShowUnsavedChangesModal(false)
                                    setHasUnsavedChanges(false)
                                    onBack()
                                }}
                            >Discard & Leave</button>
                        </div>
                    </div>
                </div>
            )}
            {showConfirmationModal && (
                <div className="confirmation-modal" style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.5)'}}>
                    <div className="confirmation-content" style={{width: '90%', maxWidth: '500px', margin: '0 auto', background: 'var(--background)', borderRadius: 10, padding: 32}}>
                        <h2 style={{marginBottom: 18}}>Confirm Submission</h2>
                        <div style={{marginBottom: 18, fontWeight: 500, color: 'var(--text-primary)'}}>Please confirm the following before submitting:</div>
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
                                Total hours only includes hours from operators and not from plant managers, loader operators or any other roles.
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
