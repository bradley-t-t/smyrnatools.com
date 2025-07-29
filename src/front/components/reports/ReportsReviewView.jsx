import React, { useEffect, useState } from 'react'
import './styles/ReportsSubmitView.css'
import './styles/ReportsReviewView.css'
import { supabase } from '../../../services/DatabaseService'
import { UserService } from '../../../services/UserService'
import { getWeekRangeFromIso, getMondayAndSaturday } from './ReportsView'

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
                    <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 18 }}>
                        <div style={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            background: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2.1rem',
                            fontWeight: 700,
                            color: 'var(--text-light)',
                            boxShadow: '0 2px 8px var(--shadow-sm, rgba(49,130,206,0.13))',
                            flexShrink: 0
                        }}>
                            <span>{ownerName ? ownerName[0].toUpperCase() : '?'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.01em' }}>
                                Completed By {ownerName || 'Unknown'}
                            </div>
                            {submittedAt && <div style={{ marginTop: 3, fontSize: '0.98rem', color: 'var(--text-secondary)', fontWeight: 500, letterSpacing: '0.01em' }}>Submitted: {submittedAt}</div>}
                        </div>
                    </div>
                    <div className="report-form-fields-grid">
                        {report.fields.map(field => (
                            <div key={field.name} className="report-form-field-wide">
                                <label>
                                    {field.label}
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
                    {report.name === 'district_manager' && maintenanceItems.length > 0 && (
                        <div style={{ marginTop: 32, marginBottom: 16 }}>
                            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
                                Items Completed This Week
                            </div>
                            <div className="list-view-table">
                                <div className="list-view-header">
                                    <div className="list-column description">Description</div>
                                    <div className="list-column plant">Plant</div>
                                    <div className="list-column deadline">Deadline</div>
                                    <div className="list-column completed-date">Completed</div>
                                </div>
                                <div className="list-view-rows">
                                    {maintenanceItems.map(item => (
                                        <div key={item.id} className={`list-view-row ${item.completed ? 'completed' : ''}`}>
                                            <div className="list-column description left-align" title={item.description}>
                                                <div style={{
                                                    background: item.completed ? 'var(--success)' : item.isOverdue ? 'var(--error)' : 'var(--accent)',
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: '50%',
                                                    display: 'inline-block',
                                                    marginRight: 8,
                                                    verticalAlign: 'middle'
                                                }}></div>
                                                {truncateText(item.description, 60)}
                                            </div>
                                            <div className="list-column plant" title={getPlantName(item.plant_code)}>
                                                {truncateText(getPlantName(item.plant_code), 20)}
                                            </div>
                                            <div className="list-column deadline">
                                                {item.deadline ? new Date(item.deadline).toLocaleDateString() : ''}
                                            </div>
                                            <div className="list-column completed-date">
                                                {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : 'N/A'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    {report.name === 'plant_manager' && (
                        <div className="summary-tabs-container">
                            <div className="summary-tabs">
                                <button
                                    type="button"
                                    className={summaryTab === 'summary' ? 'active' : ''}
                                    onClick={() => setSummaryTab('summary')}
                                >
                                    Summary
                                </button>
                            </div>
                            {summaryTab === 'summary' && (
                                <div className="summary-content" style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, alignItems: 'stretch' }}>
                                    <div className="summary-metric-card" style={{ borderColor: 'var(--divider)', flex: 1, marginRight: 0 }}>
                                        <div className="summary-metric-title">Yards per Man-Hour</div>
                                        <div className="summary-metric-value" style={{ color: 'var(--primary)' }}>
                                            {yph !== null ? yph.toFixed(2) : '--'}
                                        </div>
                                        <div className="summary-metric-grade" style={{ color: 'var(--primary)' }}>
                                            {yphLabel}
                                        </div>
                                        <div className="summary-metric-scale">
                                            <span className={yphGrade === 'excellent' ? 'active' : ''}>Excellent</span>
                                            <span className={yphGrade === 'good' ? 'active' : ''}>Good</span>
                                            <span className={yphGrade === 'average' ? 'active' : ''}>Average</span>
                                            <span className={yphGrade === 'poor' ? 'active' : ''}>Poor</span>
                                        </div>
                                    </div>
                                    <div className="summary-metric-card" style={{ borderColor: 'var(--divider)', flex: 1, marginLeft: 0 }}>
                                        <div className="summary-metric-title">Yardage Lost</div>
                                        <div className="summary-metric-value" style={{ color: 'var(--primary)' }}>
                                            {lost !== null ? lost : '--'}
                                        </div>
                                        <div className="summary-metric-grade" style={{ color: 'var(--primary)' }}>
                                            {lostLabel}
                                        </div>
                                        <div className="summary-metric-scale">
                                            <span className={lostGrade === 'excellent' ? 'active' : ''}>Excellent</span>
                                            <span className={lostGrade === 'good' ? 'active' : ''}>Good</span>
                                            <span className={lostGrade === 'average' ? 'active' : ''}>Average</span>
                                            <span className={lostGrade === 'poor' ? 'active' : ''}>Poor</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ReportsReviewView