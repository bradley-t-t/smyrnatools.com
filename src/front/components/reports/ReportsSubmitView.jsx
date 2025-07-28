import React, { useState, useEffect } from 'react'
import './styles/ReportsSubmitView.css'
import { supabase } from '../../../services/DatabaseService'
import { getWeekRangeFromIso, getMondayAndSaturday } from './ReportsView'

const REPORTS_START_DATE = new Date('2025-07-20')

function ReportsSubmitView({ report, initialData, onBack, onSubmit, user, readOnly }) {
    const [form, setForm] = useState(initialData || Object.fromEntries(report.fields.map(f => [f.name, ''])))
    const [submitting, setSubmitting] = useState(false)
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

    function handleChange(e, name) {
        setForm({ ...form, [name]: e.target.value })
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

    function getPlantName(plantCode) {
        return plantCode || ''
    }

    function truncateText(text, maxLength) {
        if (!text) return ''
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
    }

    let weekRange = ''
    if (report.weekIso) {
        weekRange = getWeekRangeFromIso(report.weekIso)
    }

    return (
        <div style={{ width: '100%', minHeight: '100vh', background: 'var(--background)' }}>
            <div style={{ maxWidth: 900, margin: '56px auto 0 auto', padding: '0 0 32px 0' }}>
                <button className="report-form-back" onClick={onBack} type="button" style={{ marginBottom: 24, marginLeft: 0 }}>
                    <i className="fas fa-arrow-left"></i> Back
                </button>
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
                        {report.fields.map(field => (
                            <div key={field.name} className="report-form-field-wide">
                                <label>
                                    {field.label}
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
                                                {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : ''}
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
                                    <div className="summary-metric-card" style={{ borderColor: yphColor, flex: 1, marginRight: 0 }}>
                                        <div className="summary-metric-title">Yards per Man-Hour</div>
                                        <div className="summary-metric-value" style={{ color: yphColor }}>
                                            {yph !== null ? yph.toFixed(2) : '--'}
                                        </div>
                                        <div className="summary-metric-grade" style={{ color: yphColor }}>
                                            {yphLabel}
                                        </div>
                                        <div className="summary-metric-scale">
                                            <span className={yphGrade === 'excellent' ? 'active' : ''}>Excellent</span>
                                            <span className={yphGrade === 'good' ? 'active' : ''}>Good</span>
                                            <span className={yphGrade === 'average' ? 'active' : ''}>Average</span>
                                            <span className={yphGrade === 'poor' ? 'active' : ''}>Poor</span>
                                        </div>
                                    </div>
                                    <div className="summary-metric-card" style={{ borderColor: lostColor, flex: 1, marginLeft: 0 }}>
                                        <div className="summary-metric-title">Yardage Lost</div>
                                        <div className="summary-metric-value" style={{ color: lostColor }}>
                                            {lost !== null ? lost : '--'}
                                        </div>
                                        <div className="summary-metric-grade" style={{ color: lostColor }}>
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
                    {error && <div className="report-modal-error">{error}</div>}
                    {success && <div style={{ color: 'var(--success)', marginBottom: 8 }}>Report submitted successfully.</div>}
                    {!readOnly && (
                        <div className="report-modal-actions-wide">
                            <button type="button" className="report-modal-cancel" onClick={onBack} disabled={submitting}>
                                Cancel
                            </button>
                            <button type="submit" className="report-modal-submit" disabled={submitting}>
                                {submitting ? 'Submitting...' : 'Submit'}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    )
}

export default ReportsSubmitView