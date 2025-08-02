import React, { useState, useEffect } from 'react'
import './styles/ReportsSubmitView.css'
import { supabase } from '../../../services/DatabaseService'
import { getWeekRangeFromIso } from './ReportsView'
import { PlantManagerSubmitPlugin } from './plugins/WeeklyPlantManagerReportPlugin'
import { DistrictManagerSubmitPlugin } from './plugins/WeeklyDistrictManagerReportPlugin'
import { PlantProductionSubmitPlugin } from './plugins/WeeklyPlantProductionReportPlugin'
import { UserService } from '../../../services/UserService'

const plugins = {
    plant_manager: PlantManagerSubmitPlugin,
    district_manager: DistrictManagerSubmitPlugin,
    plant_production: PlantProductionSubmitPlugin
}

const REPORTS_START_DATE = new Date('2025-07-20')

function exportRowsToCSV(rows, operatorOptions, reportDate) {
    if (!Array.isArray(rows) || rows.length === 0) return
    const dateStr = reportDate ? ` - ${reportDate}` : ''
    const title = `Plant Production Report${dateStr}`
    const headers = [
        title,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]
    const tableHeaders = [
        'Operator Name',
        'Truck Number',
        'Start Time',
        '1st Load',
        'Elapsed (Start→1st)',
        'EOD In Yard',
        'Punch Out',
        'Elapsed (EOD→Punch)',
        'Total Loads',
        'Total Hours',
        'Loads/Hour',
        'Comments'
    ]
    const csvRows = [headers, tableHeaders]
    rows.forEach(row => {
        function parseTimeToMinutes(timeStr) {
            if (!timeStr || typeof timeStr !== 'string') return null
            const [h, m] = timeStr.split(':').map(Number)
            if (isNaN(h) || isNaN(m)) return null
            return h * 60 + m
        }
        function getOperatorName(row, operatorOptions) {
            if (!row || !row.name) return ''
            if (Array.isArray(operatorOptions)) {
                const found = operatorOptions.find(opt => opt.value === row.name)
                if (found) return found.label
            }
            if (row.displayName) return row.displayName
            return row.name
        }
        const start = parseTimeToMinutes(row.start_time)
        const firstLoad = parseTimeToMinutes(row.first_load)
        const eod = parseTimeToMinutes(row.eod_in_yard)
        const punch = parseTimeToMinutes(row.punch_out)
        const elapsedStart = (start !== null && firstLoad !== null) ? firstLoad - start : ''
        const elapsedEnd = (eod !== null && punch !== null) ? punch - eod : ''
        const totalHours = (start !== null && punch !== null) ? ((punch - start) / 60) : ''
        const loadsPerHour = (row.loads && totalHours && totalHours > 0) ? (row.loads / totalHours).toFixed(2) : ''
        csvRows.push([
            getOperatorName(row, operatorOptions),
            row.truck_number || '',
            row.start_time || '',
            row.first_load || '',
            elapsedStart !== '' ? `${elapsedStart} min` : '',
            row.eod_in_yard || '',
            row.punch_out || '',
            elapsedEnd !== '' ? `${elapsedEnd} min` : '',
            row.loads || '',
            totalHours !== '' ? totalHours.toFixed(2) : '',
            loadsPerHour,
            row.comments || ''
        ])
    })
    const csvContent = csvRows.map(r =>
        r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
    ).join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const safeDate = reportDate ? reportDate.replace(/[^0-9\-]/g, '') : ''
    const a = document.createElement('a')
    a.href = url
    a.download = `Plant Production Report${safeDate ? ' - ' + safeDate : ''}.csv`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }, 0)
}

function exportReportFieldsToCSV(report, form) {
    if (!report || !Array.isArray(report.fields)) return
    const headers = report.fields.map(f => f.label || f.name)
    const values = report.fields.map(f => form[f.name] || '')
    const csvRows = [headers, values]
    const csvContent = csvRows.map(r =>
        r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
    ).join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.title || report.name}.csv`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }, 0)
}

function ReportsSubmitView({ report, initialData, onBack, onSubmit, user, readOnly }) {
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
    const [excludedOperators, setExcludedOperators] = useState([])
    const [saveMessage, setSaveMessage] = useState('')
    const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [initialFormSnapshot, setInitialFormSnapshot] = useState(null)

    useEffect(() => {
        setInitialFormSnapshot(JSON.stringify(form))
    }, [])

    useEffect(() => {
        if (initialFormSnapshot !== null) {
            setHasUnsavedChanges(JSON.stringify(form) !== initialFormSnapshot)
        }
    }, [form, initialFormSnapshot])

    useEffect(() => {
        async function fetchPlants() {
            const { data, error } = await supabase
                .from('plants')
                .select('plant_code,plant_name')
                .order('plant_code', { ascending: true })
            if (!error && Array.isArray(data)) {
                const sorted = data
                    .filter(p => p.plant_code && p.plant_name)
                    .sort((a, b) => {
                        const aNum = parseInt(a.plant_code, 10)
                        const bNum = parseInt(b.plant_code, 10)
                        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
                        return String(a.plant_code).localeCompare(String(b.plant_code))
                    })
                setPlants(sorted)
            } else {
                setPlants([])
            }
        }
        if (report.name === 'plant_production') {
            fetchPlants()
        }
    }, [report.name])

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
            if (!error && Array.isArray(data)) {
                setMaintenanceItems(data)
            } else {
                setMaintenanceItems([])
            }
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
            setInitialFormSnapshot(
                JSON.stringify(
                    initialData.data
                        ? { ...Object.fromEntries(report.fields.map(f => [f.name, f.type === 'table' ? [] : ''])), ...initialData.data, ...(initialData.rows ? { rows: initialData.rows } : {}) }
                        : { ...Object.fromEntries(report.fields.map(f => [f.name, f.type === 'table' ? [] : ''])), ...initialData }
                )
            )
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
        for (const field of report.fields) {
            if (field.required && !form[field.name]) {
                setError('Please fill out all required fields.')
                return
            }
        }
        setSubmitting(true)
        try {
            await onSubmit(form)
            setSuccess(true)
        } catch {
            setError('Error submitting report')
        } finally {
            setSubmitting(false)
        }
    }

    async function handleSaveDraft(e) {
        e.preventDefault()
        setError('')
        setSuccess(false)
        setSaveMessage('')
        for (const field of report.fields) {
            if (field.required && !form[field.name]) {
                setError('Please fill out all required fields.')
                return
            }
        }
        setSavingDraft(true)
        try {
            if (!report || !user || typeof user.id !== 'string') {
                setError('User not found')
                setSavingDraft(false)
                return
            }
            let monday = report.weekIso ? new Date(report.weekIso) : null
            let saturday = monday ? new Date(monday) : null
            if (saturday) saturday.setDate(monday.getDate() + 5)
            const upsertData = {
                report_name: report.name,
                user_id: user.id,
                data: { ...form, week: report.weekIso },
                week: monday ? monday.toISOString() : null,
                completed: false,
                submitted_at: new Date().toISOString(),
                report_date_range_start: monday?.toISOString() || null,
                report_date_range_end: saturday?.toISOString() || null
            }
            const { data: existing, error: findError } = await supabase
                .from('reports')
                .select('id')
                .eq('report_name', report.name)
                .eq('user_id', user.id)
                .eq('week', monday ? monday.toISOString() : null)
                .maybeSingle()
            if (findError) {
                setError(findError.message || 'Error checking for existing report')
                setSavingDraft(false)
                return
            }
            let response
            if (existing && existing.id) {
                response = await supabase
                    .from('reports')
                    .update(upsertData)
                    .eq('id', existing.id)
                    .select('id')
                    .single()
            } else {
                response = await supabase
                    .from('reports')
                    .insert([upsertData])
                    .select('id')
                    .single()
            }
            const { error } = response
            if (error) {
                setError(error.message || 'Error saving draft')
                setSavingDraft(false)
                return
            }
            setSaveMessage('Changes saved.')
        } catch {
            setError('Error saving draft')
        } finally {
            setSavingDraft(false)
        }
    }

    function getPlantName(plantCode) {
        return plantCode || ''
    }

    function truncateText(text, maxLength) {
        if (!text) return ''
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
    }

    function getTruckNumberForOperator(row) {
        if (row && row.truck_number) return row.truck_number
        if (!row || !row.name) return ''
        const mixer = mixers.find(m => m.assigned_operator === row.name)
        if (mixer && mixer.truck_number) return mixer.truck_number
        return ''
    }

    let weekRange = ''
    if (report.weekIso) {
        weekRange = getWeekRangeFromIso(report.weekIso)
    }
    const PluginComponent = plugins[report.name]
    const submitted = !!initialData?.completed

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

    return (
        <div style={{ width: '100%', minHeight: '100vh', background: 'var(--background)' }}>
            <div style={{ maxWidth: 900, margin: '56px auto 0 auto', padding: '0 0 32px 0' }}>
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
                                if (submitted) exportRowsToCSV(form.rows, operatorOptions, form.report_date)
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
                                if (submitted) exportReportFieldsToCSV(report, form)
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
                    <div className="report-form-fields-grid">
                        {report.name === 'plant_production' ? (
                            <>
                                <div style={{ display: 'flex', gap: 24, width: '100%', marginBottom: 18 }}>
                                    <div style={{ flex: 1 }}>
                                        <label>
                                            Plant
                                            <span className="report-modal-required">*</span>
                                        </label>
                                        <select
                                            value={form.plant || ''}
                                            onChange={e => {
                                                const newPlant = e.target.value
                                                setForm(f => ({ ...f, plant: newPlant, rows: [] }))
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
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <label>
                                            Report Date
                                            <span className="report-modal-required">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={form.report_date || ''}
                                            onChange={e => setForm(f => ({ ...f, report_date: e.target.value }))}
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
                                <div className="report-form-field-wide" style={{ gridColumn: '1 / -1' }}>
                                    <label>Operators</label>
                                    <div>
                                        {form.plant && (form.rows || []).length === 0 && (
                                            <div style={{ color: 'var(--text-secondary)', margin: '16px 0' }}>
                                                No active operators for this plant.
                                            </div>
                                        )}
                                        {!form.plant && (
                                            <div style={{ color: 'var(--text-secondary)', margin: '16px 0' }}>
                                                Please wait, loading plant assignment...
                                            </div>
                                        )}
                                        {(form.rows || []).length > 0 && (
                                            <div style={{ marginBottom: 18 }}>
                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 16, width: '100%' }}>
                                                    {form.rows.map((row, idx) => (
                                                        <div
                                                            key={idx}
                                                            onClick={() => { setCarouselIndex(idx); setRowStep(0) }}
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
                                                        <div style={{ padding: '24px 24px 0 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                                                            <div style={{ display: 'flex', gap: 18 }}>
                                                                <div style={{ flex: 1 }}>
                                                                    <label style={{ fontWeight: 600, fontSize: 15 }}>Name</label>
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
                                                                <div style={{ width: 120 }}>
                                                                    <label style={{ fontWeight: 600, fontSize: 15 }}>Truck #</label>
                                                                    <input
                                                                        type="text"
                                                                        value={getTruckNumberForOperator(form.rows[carouselIndex])}
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
                                                            <div style={{ display: 'flex', gap: 18 }}>
                                                                <div style={{ flex: 1 }}>
                                                                    <label style={{ fontWeight: 600, fontSize: 15 }}>Start Time</label>
                                                                    <input
                                                                        type="time"
                                                                        placeholder="Start Time"
                                                                        value={form.rows[carouselIndex]?.start_time || ''}
                                                                        onChange={e => handleChange(e, 'rows', carouselIndex, 'start_time')}
                                                                        disabled={readOnly ? true : false}
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
                                                                <div style={{ flex: 1 }}>
                                                                    <label style={{ fontWeight: 600, fontSize: 15 }}>1st Load</label>
                                                                    <input
                                                                        type="time"
                                                                        placeholder="1st Load"
                                                                        value={form.rows[carouselIndex]?.first_load || ''}
                                                                        onChange={e => handleChange(e, 'rows', carouselIndex, 'first_load')}
                                                                        disabled={readOnly ? true : false}
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
                                                            <div style={{ display: 'flex', gap: 18 }}>
                                                                <div style={{ flex: 1 }}>
                                                                    <label style={{ fontWeight: 600, fontSize: 15 }}>EOD In Yard</label>
                                                                    <input
                                                                        type="time"
                                                                        placeholder="EOD"
                                                                        value={form.rows[carouselIndex]?.eod_in_yard || ''}
                                                                        onChange={e => handleChange(e, 'rows', carouselIndex, 'eod_in_yard')}
                                                                        disabled={readOnly ? true : false}
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
                                                                <div style={{ flex: 1 }}>
                                                                    <label style={{ fontWeight: 600, fontSize: 15 }}>Punch Out</label>
                                                                    <input
                                                                        type="time"
                                                                        placeholder="Punch Out"
                                                                        value={form.rows[carouselIndex]?.punch_out || ''}
                                                                        onChange={e => handleChange(e, 'rows', carouselIndex, 'punch_out')}
                                                                        disabled={readOnly ? true : false}
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
                                                            <div style={{ display: 'flex', gap: 18 }}>
                                                                <div style={{ flex: 1 }}>
                                                                    <label style={{ fontWeight: 600, fontSize: 15 }}>Total Loads</label>
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
                                                                <label style={{ fontWeight: 600, fontSize: 15 }}>Comments</label>
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
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px 18px 24px' }}>
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
                                                        <span style={{ fontWeight: 600, fontSize: 15 }}>
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
                                            <div style={{ marginTop: 18, marginBottom: 18 }}>
                                                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>
                                                    Excluded Operators
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
                    </div>
                    {PluginComponent && (
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
                        />
                    )}
                    {error && <div className="report-modal-error">{error}</div>}
                    {success && <div style={{ color: 'var(--success)', marginBottom: 8 }}>Report submitted successfully.</div>}
                    {saveMessage && <div style={{ color: 'var(--success)', marginBottom: 8 }}>{saveMessage}</div>}
                    {!readOnly && (
                        <div className="report-modal-actions-wide" style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                            <button type="button" className="report-modal-cancel" onClick={handleBackClick} disabled={submitting || savingDraft}>
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
                                    marginRight: 12
                                }}
                                onClick={handleSaveDraft}
                                disabled={submitting || savingDraft}
                            >
                                {savingDraft ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button type="submit" className="report-modal-submit" disabled={submitting || savingDraft}>
                                {submitting ? 'Submitting...' : 'Submit'}
                            </button>
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
        </div>
    )
}

export default ReportsSubmitView
