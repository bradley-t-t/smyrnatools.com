import React, { useState, useEffect } from 'react'
import './ReportsSubmitView.css'
import { supabase } from '../../services/DatabaseService'
import { getWeekRangeFromIso, getMondayAndSaturday } from './ReportsView'

const REPORTS_START_DATE = new Date('2025-07-20')

function ReportsSubmitView({ report, initialData, onBack, onSubmit, user, readOnly }) {
    const [form, setForm] = useState(initialData || Object.fromEntries(report.fields.map(f => [f.name, ''])))
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [maintenanceItems, setMaintenanceItems] = useState([])

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
                    {maintenanceItems.length > 0 && (
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
                                                    backgroundColor: item.completed ? '#38a169' : item.isOverdue ? '#e53e3e' : '#3182ce',
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
                    {error && <div className="report-modal-error">{error}</div>}
                    {success && <div style={{ color: 'var(--success, #38a169)', marginBottom: 8 }}>Report submitted successfully.</div>}
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