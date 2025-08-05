import React, { useEffect, useState } from 'react'
import './styles/ReportsSubmitView.css'
import './styles/ReportsReviewView.css'
import { supabase } from '../../../services/DatabaseService'
import { UserService } from '../../../services/UserService'
import {
    getWeekRangeFromIso,
    exportRowsToCSV,
    exportReportFieldsToCSV
} from '../../../services/ReportService'
import { PlantManagerReviewPlugin } from './plugins/WeeklyPlantManagerReportPlugin'
import { DistrictManagerReviewPlugin } from './plugins/WeeklyDistrictManagerReportPlugin'
import { PlantProductionReviewPlugin } from './plugins/WeeklyPlantProductionReportPlugin'

const plugins = {
    plant_manager: PlantManagerReviewPlugin,
    district_manager: DistrictManagerReviewPlugin,
    plant_production: PlantProductionReviewPlugin
}

function formatDateTime(dt) {
    if (!dt) return ''
    const date = new Date(dt)
    return date.toLocaleString()
}

function truncateText(text, maxLength) {
    if (!text) return ''
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
}

function ReportsReviewView({ report, initialData, onBack, user, completedByUser, allReports }) {
    const [form, setForm] = useState(initialData?.data || initialData || {})
    const [maintenanceItems, setMaintenanceItems] = useState([])
    const [ownerName, setOwnerName] = useState('')
    const [weekRange, setWeekRange] = useState('')
    const [submittedAt, setSubmittedAt] = useState('')
    const [summaryTab, setSummaryTab] = useState('summary')
    const [operatorOptions, setOperatorOptions] = useState([])
    const [assignedPlant, setAssignedPlant] = useState('')

    useEffect(() => {
        async function fetchOwnerName() {
            const ownerId = completedByUser?.id || initialData?.user_id || report?.userId || user?.id
            if (!ownerId) {
                setOwnerName('')
                return
            }
            const name = completedByUser && (completedByUser.first_name || completedByUser.last_name)
                ? `${completedByUser.first_name || ''} ${completedByUser.last_name || ''}`.trim()
                : await UserService.getUserDisplayName(ownerId) || ownerId.slice(0, 8)
            setOwnerName(name)
        }
        fetchOwnerName()
    }, [report, user, initialData, completedByUser])

    useEffect(() => {
        let weekIso = report.weekIso || initialData?.week
        if (weekIso) {
            setWeekRange(getWeekRangeFromIso(weekIso))
        } else if (report.report_date_range_start && report.report_date_range_end) {
            setWeekRange(getWeekRangeFromIso(report.report_date_range_start.toISOString().slice(0, 10)))
        }
    }, [report, initialData])

    useEffect(() => {
        async function fetchMaintenanceItems() {
            let weekIso = report.weekIso || initialData?.week
            if (!weekIso) return
            const monday = new Date(weekIso)
            monday.setDate(monday.getDate() + 1)
            monday.setHours(0, 0, 0, 0)
            const saturday = new Date(monday)
            saturday.setDate(monday.getDate() + 5)
            const { data, error } = await supabase
                .from('list_items')
                .select('*')
                .eq('completed', true)
                .gte('completed_at', monday.toISOString())
                .lte('completed_at', saturday.toISOString())
            setMaintenanceItems(!error && Array.isArray(data) ? data : [])
        }
        fetchMaintenanceItems()
    }, [report.weekIso, initialData?.week])

    useEffect(() => {
        setSubmittedAt(initialData?.submitted_at ? formatDateTime(initialData.submitted_at) : '')
    }, [initialData])

    useEffect(() => {
        if (initialData?.data) {
            setForm(initialData.data)
        } else if (initialData) {
            setForm(initialData)
        }
    }, [initialData])

    useEffect(() => {
        async function fetchOperatorOptions() {
            if (report.name !== 'plant_production') {
                setOperatorOptions([])
                return
            }
            let plantCode = form.plant
            if (!plantCode && Array.isArray(form.rows) && form.rows.length > 0) {
                plantCode = form.rows[0].plant_code
            }
            if (!plantCode) {
                setOperatorOptions([])
                return
            }
            const { data: operatorsData, error: opError } = await supabase
                .from('operators')
                .select('employee_id, name')
                .eq('plant_code', plantCode)
            setOperatorOptions(!opError && Array.isArray(operatorsData)
                ? operatorsData.map(u => ({
                    value: u.employee_id,
                    label: u.name
                }))
                : []
            )
        }
        fetchOperatorOptions()
    }, [report.name, form.plant, form.rows])

    useEffect(() => {
        async function fetchAssignedPlant() {
            if ((report.name === 'plant_manager' || report.name === 'district_manager' || report.name === 'plant_production') && completedByUser && completedByUser.id) {
                const plant = await UserService.getUserPlant(completedByUser.id)
                setAssignedPlant(plant || '')
            }
        }
        fetchAssignedPlant()
    }, [report.name, completedByUser])

    let weekRangeHeader = weekRange
    let reportTitle = report.title || 'Report Review'

    let yards = parseFloat(form.total_yards_delivered || form['Yardage'] || form['yardage'])
    let hours = parseFloat(form.total_operator_hours || form['Total Hours'] || form['total_hours'] || form['total_operator_hours'])
    let yph = !isNaN(yards) && !isNaN(hours) && hours > 0 ? yards / hours : null
    let yphGrade = ''
    if (yph !== null) {
        if (yph >= 6) yphGrade = 'excellent'
        else if (yph >= 4) yphGrade = 'good'
        else if (yph >= 3) yphGrade = 'average'
        else yphGrade = 'poor'
    }
    let yphColor = ''
    if (yphGrade === 'excellent') yphColor = 'var(--excellent)'
    else if (yphGrade === 'good') yphColor = 'var(--success)'
    else if (yphGrade === 'average') yphColor = 'var(--warning)'
    else if (yphGrade === 'poor') yphColor = 'var(--error)'

    let yphLabel = ''
    if (yphGrade === 'excellent') yphLabel = 'Excellent'
    else if (yphGrade === 'good') yphLabel = 'Good'
    else if (yphGrade === 'average') yphLabel = 'Average'
    else if (yphGrade === 'poor') yphLabel = 'Poor'

    let lost = null
    if (typeof form.total_yards_lost !== 'undefined' && form.total_yards_lost !== '' && !isNaN(Number(form.total_yards_lost))) {
        lost = Number(form.total_yards_lost)
    } else if (
        typeof form.yardage_lost !== 'undefined' && form.yardage_lost !== '' && !isNaN(Number(form.yardage_lost))
    ) {
        lost = Number(form.yardage_lost)
    } else if (
        typeof form.lost_yardage !== 'undefined' && form.lost_yardage !== '' && !isNaN(Number(form.lost_yardage))
    ) {
        lost = Number(form.lost_yardage)
    } else if (
        typeof form['Yardage Lost'] !== 'undefined' && form['Yardage Lost'] !== '' && !isNaN(Number(form['Yardage Lost']))
    ) {
        lost = Number(form['Yardage Lost'])
    } else if (
        typeof form['yardage_lost'] !== 'undefined' && form['yardage_lost'] !== '' && !isNaN(Number(form['yardage_lost']))
    ) {
        lost = Number(form['yardage_lost'])
    }
    if (lost !== null && lost < 0) {
        lost = 0
    }

    let lostGrade = ''
    if (lost !== null) {
        if (lost === 0) lostGrade = 'excellent'
        else if (lost < 5) lostGrade = 'good'
        else if (lost < 10) lostGrade = 'average'
        else lostGrade = 'poor'
    }
    let lostColor = ''
    if (lostGrade === 'excellent') lostColor = 'var(--excellent)'
    else if (lostGrade === 'good') lostColor = 'var(--success)'
    else if (lostGrade === 'average') lostColor = 'var(--warning)'
    else if (lostGrade === 'poor') lostColor = 'var(--error)'

    let lostLabel = ''
    if (lostGrade === 'excellent') lostLabel = 'Excellent'
    else if (lostGrade === 'good') lostLabel = 'Good'
    else if (lostGrade === 'average') lostLabel = 'Average'
    else if (lostGrade === 'poor') lostLabel = 'Poor'

    const PluginComponent = plugins[report.name]
    const isSubmitted = !!initialData?.completed

    let statusText = isSubmitted ? 'Submitted' : 'Saved (Draft)'
    let statusColor = isSubmitted ? 'var(--success)' : 'var(--warning)'

    const tabOptions = [
        { key: 'review', label: 'Review' },
        { key: 'overview', label: 'Overview' }
    ]
    const [activeTab, setActiveTab] = useState(tabOptions[0].key)

    useEffect(() => {
        setActiveTab(tabOptions[0].key)
    }, [report.name])

    return (
        <div style={{ width: '100%', minHeight: '100vh', background: 'var(--background)' }}>
            <div style={{ maxWidth: 900, margin: '56px auto 0 auto', padding: '0 0 32px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <button className="report-form-back" onClick={onBack} type="button">
                        <i className="fas fa-arrow-left"></i> Back
                    </button>
                    {Array.isArray(form.rows) && form.rows.length > 0 && report.name === 'plant_production' && (
                        <button
                            type="button"
                            style={{
                                background: isSubmitted ? 'var(--accent)' : 'var(--divider)',
                                color: isSubmitted ? 'var(--text-light)' : 'var(--text-secondary)',
                                border: 'none',
                                borderRadius: 6,
                                padding: '10px 22px',
                                fontWeight: 600,
                                fontSize: 15,
                                cursor: isSubmitted ? 'pointer' : 'not-allowed',
                                opacity: isSubmitted ? 1 : 0.6
                            }}
                            onClick={() => {
                                if (isSubmitted) exportRowsToCSV(form.rows, operatorOptions, form.report_date)
                            }}
                            disabled={!isSubmitted}
                        >
                            Export to Spreadsheet
                        </button>
                    )}
                    {report.name !== 'plant_production' && (
                        <button
                            type="button"
                            style={{
                                background: isSubmitted ? 'var(--accent)' : 'var(--divider)',
                                color: isSubmitted ? 'var(--text-light)' : 'var(--text-secondary)',
                                border: 'none',
                                borderRadius: 6,
                                padding: '10px 22px',
                                fontWeight: 600,
                                fontSize: 15,
                                cursor: isSubmitted ? 'pointer' : 'not-allowed',
                                opacity: isSubmitted ? 1 : 0.6,
                                marginLeft: 12
                            }}
                            onClick={() => {
                                if (isSubmitted) exportReportFieldsToCSV(report, form)
                            }}
                            disabled={!isSubmitted}
                        >
                            Export to Spreadsheet
                        </button>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{
                        fontWeight: 700,
                        fontSize: 17,
                        color: statusColor,
                        marginRight: 18
                    }}>
                        {statusText}
                    </div>
                    {(report.name === 'plant_manager' || report.name === 'district_manager' || report.name === 'plant_production') && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>
                                {ownerName}
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-secondary)' }}>
                                Assigned Plant: {assignedPlant}
                            </div>
                        </div>
                    )}
                    {submittedAt && (
                        <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {isSubmitted ? 'Submitted at' : 'Last saved'}: {submittedAt}
                        </div>
                    )}
                </div>
                <div className="report-form-header-row" style={{ marginTop: 0 }}>
                    <div className="report-form-title">
                        {reportTitle}
                    </div>
                    {weekRangeHeader && (
                        <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--accent)' }}>
                            {weekRangeHeader}
                        </div>
                    )}
                </div>
                <div className="report-form-body-wide">
                    {report.name !== 'general_manager' && (
                        <>
                            {report.name === 'plant_production' ? null : (
                                <div className="report-form-fields-grid">
                                    {report.fields.map(field => (
                                        <div key={field.name} className="report-form-field-wide">
                                            <label>
                                                {field.name === 'yardage' ? 'Total Yardage' : field.label}
                                                {field.required && <span className="report-modal-required">*</span>}
                                            </label>
                                            {field.type === 'textarea' ? (
                                                <textarea value={form[field.name] || ''} readOnly disabled />
                                            ) : field.type === 'select' ? (
                                                <select value={form[field.name] || ''} readOnly disabled>
                                                    <option value="">Select...</option>
                                                    {field.options?.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input type={field.type} value={form[field.name] || ''} readOnly disabled />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
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
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ReportsReviewView
