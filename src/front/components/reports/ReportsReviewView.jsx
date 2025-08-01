import React, { useEffect, useState } from 'react'
import './styles/ReportsSubmitView.css'
import './styles/ReportsReviewView.css'
import { supabase } from '../../../services/DatabaseService'
import { UserService } from '../../../services/UserService'
import { getWeekRangeFromIso, getMondayAndSaturday } from './ReportsView'
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

function ReportsReviewView({ report, initialData, onBack, user, completedByUser }) {
    const [form, setForm] = useState(initialData?.data || initialData || {})
    const [maintenanceItems, setMaintenanceItems] = useState([])
    const [ownerName, setOwnerName] = useState('')
    const [weekRange, setWeekRange] = useState('')
    const [submittedAt, setSubmittedAt] = useState('')
    const [summaryTab, setSummaryTab] = useState('summary')
    const [operatorOptions, setOperatorOptions] = useState([])

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
            if (!error && Array.isArray(data)) {
                setMaintenanceItems(data)
            } else {
                setMaintenanceItems([])
            }
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
            if (!opError && Array.isArray(operatorsData)) {
                setOperatorOptions(
                    operatorsData.map(u => ({
                        value: u.employee_id,
                        label: u.name
                    }))
                )
            } else {
                setOperatorOptions([])
            }
        }
        fetchOperatorOptions()
    }, [report.name, form.plant, form.rows])

    function getPlantName(plantCode) {
        return plantCode || 'No Plant'
    }

    function truncateText(text, maxLength) {
        if (!text) return ''
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
    }

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

    return (
        <div style={{ width: '100%', minHeight: '100vh', background: 'var(--background)' }}>
            <div style={{ maxWidth: 900, margin: '56px auto 0 auto', padding: '0 0 32px 0' }}>
                <button className="report-form-back" onClick={onBack} type="button" style={{ marginBottom: 24, marginLeft: 0 }}>
                    <i className="fas fa-arrow-left"></i> Back
                </button>
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
                    {report.name === 'plant_production' ? (
                        <div className="report-form-field-wide" style={{ marginBottom: 18 }}>
                            <label>Report Date</label>
                            <input
                                type="date"
                                value={form.report_date || ''}
                                readOnly
                                disabled
                                style={{
                                    background: 'var(--background)',
                                    border: '1px solid var(--divider)',
                                    borderRadius: 6,
                                    fontSize: 15,
                                    width: 180,
                                    padding: '7px 10px',
                                    color: 'var(--text-primary)'
                                }}
                                className="plant-prod-input"
                            />
                        </div>
                    ) : (
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
                </div>
            </div>
        </div>
    )
}

export default ReportsReviewView
