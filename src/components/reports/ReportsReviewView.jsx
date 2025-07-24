import React, { useEffect, useState } from 'react'
import './ReportsSubmitView.css'
import './ReportsReviewView.css'
import { supabase } from '../../services/DatabaseService'
import { UserService } from '../../services/UserService'
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
                                            {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : 'N/A'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ReportsReviewView