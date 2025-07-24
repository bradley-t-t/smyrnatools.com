import React, { useEffect, useState } from 'react'
import './ReportsSubmitView.css'
import './ReportsReviewView.css'
import { UserService } from '../../services/UserService'
import { supabase } from '../../services/DatabaseService'

function getMondayAndSaturday(date) {
    const d = new Date(date)
    const day = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((day + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    const saturday = new Date(monday)
    saturday.setDate(monday.getDate() + 5)
    saturday.setHours(23, 59, 59, 999)
    return { monday, saturday }
}

function formatDateMMDDYY(date) {
    const mm = date.getMonth() + 1
    const dd = date.getDate()
    const yy = date.getFullYear().toString().slice(-2)
    return `${mm}-${dd}-${yy}`
}

function getWeekRangeString(start, end) {
    return `${formatDateMMDDYY(start)} through ${formatDateMMDDYY(end)}`
}

function formatDateTime(dt) {
    if (!dt) return ''
    const date = new Date(dt)
    const mm = date.getMonth() + 1
    const dd = date.getDate()
    const yyyy = date.getFullYear()
    let h = date.getHours()
    const m = date.getMinutes().toString().padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12
    if (h === 0) h = 12
    return `${mm}/${dd}/${yyyy} ${h}:${m} ${ampm}`
}

function ReportsReviewView({ report, initialData, onBack, user, completedByUser }) {
    const [form, setForm] = useState(initialData || {})
    const [maintenanceItems, setMaintenanceItems] = useState([])
    const [ownerName, setOwnerName] = useState('')
    const [weekRange, setWeekRange] = useState('')
    const [submittedAt, setSubmittedAt] = useState('')

    useEffect(() => {
        async function fetchOwnerName() {
            let ownerId = null
            if (completedByUser && completedByUser.id) ownerId = completedByUser.id
            else if (initialData && initialData.user_id) ownerId = initialData.user_id
            else if (report && report.userId) ownerId = report.userId
            else if (user && user.id) ownerId = user.id
            if (!ownerId) {
                setOwnerName('')
                return
            }
            let name = ''
            if (completedByUser && (completedByUser.first_name || completedByUser.last_name)) {
                name = `${completedByUser.first_name || ''} ${completedByUser.last_name || ''}`.trim()
            } else {
                name = await UserService.getUserDisplayName(ownerId)
            }
            setOwnerName(name || ownerId.slice(0, 8))
        }
        fetchOwnerName()
    }, [report, user, initialData, completedByUser])

    useEffect(() => {
        let weekStart, weekEnd
        if (report.name === 'district_manager') {
            let weekIso = report.weekIso
            if (!weekIso && form.week) weekIso = form.week
            if (!weekIso && initialData && initialData.week) weekIso = initialData.week
            if (weekIso) {
                const { monday, saturday } = getMondayAndSaturday(weekIso)
                weekStart = monday
                weekEnd = saturday
            }
        } else if (report.frequency === 'weekly') {
            let weekOf = form.week_of || (initialData && initialData.week_of)
            if (weekOf) {
                const { monday, saturday } = getMondayAndSaturday(weekOf)
                weekStart = monday
                weekEnd = saturday
            }
        }
        if (weekStart && weekEnd) {
            setWeekRange(getWeekRangeString(weekStart, weekEnd))
        } else {
            setWeekRange('')
        }
    }, [report, form, initialData])

    useEffect(() => {
        async function fetchMaintenanceItems() {
            let weekStart, weekEnd
            if (report.name === 'district_manager') {
                let weekIso = report.weekIso
                if (!weekIso && form.week) weekIso = form.week
                if (!weekIso && initialData && initialData.week) weekIso = initialData.week
                if (!weekIso) return
                const { monday, saturday } = getMondayAndSaturday(weekIso)
                weekStart = monday
                weekEnd = saturday
            } else if (report.frequency === 'weekly') {
                let weekOf = form.week_of || (initialData && initialData.week_of)
                if (!weekOf) return
                const { monday, saturday } = getMondayAndSaturday(weekOf)
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
    }, [report, form, initialData])

    useEffect(() => {
        let dt = initialData && (initialData.submitted_at || initialData.created_at)
        setSubmittedAt(dt ? formatDateTime(dt) : '')
    }, [initialData])

    function getPlantName(plantCode) {
        return plantCode || 'No Plant'
    }

    function truncateText(text, maxLength, byWords = false) {
        if (!text) return ''
        if (byWords) {
            const words = text.split(' ')
            return words.length > maxLength ? `${words.slice(0, maxLength).join(' ')}...` : text
        }
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
    }

    return (
        <>
            <button className="report-form-back" onClick={onBack} type="button">
                <i className="fas fa-arrow-left"></i>
                Back
            </button>
            <div className="report-form-body-wide">
                <div className="review-user-card">
                    <div className="review-user-avatar">
                        <span>
                            {ownerName ? ownerName[0].toUpperCase() : '?'}
                        </span>
                    </div>
                    <div className="review-user-details">
                        <div className="review-user-name">
                            {ownerName ? `Completed By ${ownerName}` : 'Completed By Unknown'}
                        </div>
                        {weekRange && (
                            <div className="review-user-week-badge">{weekRange}</div>
                        )}
                        {submittedAt && (
                            <div className="review-user-submitted">
                                Submitted: {submittedAt}
                            </div>
                        )}
                    </div>
                </div>
                <div className="review-divider"></div>
                <div className="report-form-fields-grid">
                    {report.fields.map(field => (
                        <div key={field.name} className="report-form-field-wide">
                            <label>
                                {field.label}
                                {field.required && <span className="report-modal-required">*</span>}
                            </label>
                            {field.type === 'textarea' ? (
                                <textarea
                                    value={form[field.name]}
                                    readOnly
                                    disabled
                                />
                            ) : field.type === 'select' ? (
                                <select
                                    value={form[field.name]}
                                    readOnly
                                    disabled
                                >
                                    <option value="">Select...</option>
                                    {field.options && field.options.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type={field.type}
                                    value={form[field.name]}
                                    readOnly
                                    disabled
                                />
                            )}
                        </div>
                    ))}
                </div>
                {maintenanceItems.length > 0 && (
                    <div style={{marginTop: 32, marginBottom: 16}}>
                        <div style={{fontWeight: 700, fontSize: 17, marginBottom: 8}}>
                            Maintenance Items Completed This Week
                        </div>
                        <div className="list-view-table" style={{marginTop: 0}}>
                            <div className="list-view-header">
                                <div className="list-column description">Description</div>
                                <div className="list-column plant">Plant</div>
                                <div className="list-column deadline">Deadline</div>
                                <div className="list-column completed-date">Completed</div>
                            </div>
                            <div className="list-view-rows">
                                {maintenanceItems.map(item => (
                                    <div
                                        key={item.id}
                                        className={`list-view-row ${item.completed ? 'completed' : ''}`}
                                    >
                                        <div className="list-column description left-align" title={item.description}>
                                            <div style={{
                                                backgroundColor: item.completed ? 'var(--success)' : item.isOverdue ? 'var(--error)' : 'var(--accent)',
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
                                            <span>
                                                {item.deadline ? new Date(item.deadline).toLocaleDateString() : ''}
                                            </span>
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
        </>
    )
}

export default ReportsReviewView
