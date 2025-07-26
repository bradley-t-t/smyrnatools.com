import React, { useState, useEffect } from 'react'
import { reportTypes } from '../../../config/types/ReportTypes'
import './styles/ReportsView.css'
import ReportsSubmitView from './ReportsSubmitView'
import ReportsReviewView from './ReportsReviewView'
import { supabase } from '../../../services/DatabaseService'
import { UserService } from '../../../services/UserService'

const HARDCODED_TODAY = new Date()
const REPORTS_START_DATE = new Date('2025-07-20')

export function getWeekRangeFromIso(weekIso) {
    const monday = new Date(weekIso)
    monday.setDate(monday.getDate() + 1)
    monday.setHours(0, 0, 0, 0)
    const saturday = new Date(monday)
    saturday.setDate(monday.getDate() + 5)
    function formatDateMMDDYY(date) {
        const mm = date.getMonth() + 1
        const dd = date.getDate()
        const yy = date.getFullYear().toString().slice(-2)
        return `${mm}-${dd}-${yy}`
    }
    return `${formatDateMMDDYY(monday)} through ${formatDateMMDDYY(saturday)}`
}

export function getMondayAndSaturday(date = new Date()) {
    const d = new Date(date)
    const day = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((day + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    const saturday = new Date(monday)
    saturday.setDate(monday.getDate() + 5)
    saturday.setHours(0, 0, 0, 0)
    return { monday, saturday }
}

function getMondayISO(date) {
    const { monday } = getMondayAndSaturday(date)
    return monday.toISOString().slice(0, 10)
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

function ReportsView() {
    const [localReports, setLocalReports] = useState([])
    const [showForm, setShowForm] = useState(null)
    const [showReview, setShowReview] = useState(null)
    const [reviewData, setReviewData] = useState(null)
    const [tab, setTab] = useState('all')
    const [loadError, setLoadError] = useState('')
    const [user, setUser] = useState(null)
    const [userProfiles, setUserProfiles] = useState({})
    const [hasAssigned, setHasAssigned] = useState({})
    const [hasReviewPermission, setHasReviewPermission] = useState({})

    useEffect(() => {
        async function fetchUserAndReports() {
            let u
            try {
                u = await UserService.getCurrentUser()
            } catch (err) {
                setLoadError(err?.message || 'Error fetching user')
                return
            }
            if (!u || typeof u.id !== 'string') {
                setUser(null)
                setLocalReports([])
                return
            }
            setUser(u)
            let data, error
            try {
                const res = await supabase
                    .from('reports')
                    .select('id,report_name,user_id,submitted_at,data,completed,report_date_range_start,report_date_range_end,week')
                data = res.data
                error = res.error
            } catch (err) {
                setLoadError(err?.message || 'Error fetching reports')
                setLocalReports([])
                return
            }
            if (error) {
                setLoadError(error.message || 'Error fetching reports')
                setLocalReports([])
                return
            }
            setLocalReports(
                Array.isArray(data)
                    ? data.map(r => ({
                        id: r.id,
                        name: r.report_name,
                        title: (reportTypes.find(rt => rt.name === r.report_name) || {}).title || r.report_name,
                        completed: !!r.completed,
                        completedDate: r.submitted_at,
                        data: r.data,
                        userId: r.user_id,
                        week: r.week || r.data?.week || null,
                        report_date_range_start: r.report_date_range_start ? new Date(r.report_date_range_start) : null,
                        report_date_range_end: r.report_date_range_end ? new Date(r.report_date_range_end) : null
                    }))
                    : []
            )
            const userIds = Array.from(new Set((data || []).map(r => r.user_id).filter(Boolean)))
            if (userIds.length > 0) {
                const { data: profiles, error: profileError } = await supabase
                    .from('users_profiles')
                    .select('id, first_name, last_name')
                    .in('id', userIds)
                if (!profileError && Array.isArray(profiles)) {
                    setUserProfiles(profiles.reduce((map, p) => ({ ...map, [p.id]: p }), {}))
                }
            }
        }
        fetchUserAndReports()
    }, [])

    useEffect(() => {
        async function checkAssignedAndReview() {
            let u
            try {
                u = await UserService.getCurrentUser()
            } catch {
                setHasAssigned({})
                setHasReviewPermission({})
                return
            }
            if (!u) {
                setHasAssigned({})
                setHasReviewPermission({})
                return
            }
            const assigned = {}
            const review = {}
            for (const rt of reportTypes) {
                assigned[rt.name] = await UserService.hasPermission(u.id, `reports.assigned.${rt.name}`)
                review[rt.name] = await UserService.hasPermission(u.id, `reports.review.${rt.name}`)
            }
            setHasAssigned(assigned)
            setHasReviewPermission(review)
        }
        checkAssignedAndReview()
    }, [])

    function getDueWeeks(startDate) {
        const weeks = []
        const today = HARDCODED_TODAY
        const currentMonday = getMondayAndSaturday(today).monday
        let monday = getMondayAndSaturday(startDate).monday
        while (monday <= currentMonday) {
            weeks.push({ weekIso: getMondayISO(monday), monday: new Date(monday) })
            monday.setDate(monday.getDate() + 7)
        }
        return weeks
    }

    const allWeeks = []
    reportTypes.forEach(rt => {
        if (!user || !hasAssigned[rt.name]) return
        getDueWeeks(REPORTS_START_DATE).forEach(({ weekIso, monday }) => {
            const saturday = new Date(monday)
            saturday.setDate(monday.getDate() + 5)
            const existing = localReports.find(r =>
                r.name === rt.name &&
                r.userId === user.id &&
                r.week &&
                new Date(r.week).toISOString().slice(0, 10) === weekIso
            )
            allWeeks.push({
                ...rt,
                weekIso,
                range: getWeekRangeString(monday, saturday),
                completed: !!(existing && existing.completed),
                report: existing || null
            })
        })
    })
    allWeeks.sort((a, b) => new Date(b.weekIso) - new Date(a.weekIso))

    const reviewableReports = localReports
        .filter(r =>
            r.completed &&
            r.week &&
            hasReviewPermission[r.name] &&
            r.userId !== user?.id
        )
        .sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())

    function getUserName(userId) {
        const profile = userProfiles[userId]
        if (profile && (profile.first_name || profile.last_name)) {
            return `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
        }
        return typeof userId === 'string' && userId.length > 0 ? userId.slice(0, 8) : ''
    }

    async function handleSubmitReport(formData) {
        if (!showForm || !user || typeof user.id !== 'string') {
            setLoadError('User not found')
            return
        }
        const existingReport = localReports.find(r =>
            r.name === showForm.name &&
            r.userId === user.id &&
            r.week &&
            new Date(r.week).toISOString().slice(0, 10) === showForm.weekIso
        )
        let monday = showForm.weekIso ? new Date(showForm.weekIso) : null
        let saturday = monday ? new Date(monday) : null
        if (saturday) saturday.setDate(monday.getDate() + 5)
        const upsertData = {
            report_name: showForm.name,
            user_id: user.id,
            data: { ...formData, week: showForm.weekIso },
            week: monday ? monday.toISOString() : null,
            completed: true,
            submitted_at: new Date().toISOString(),
            report_date_range_start: monday?.toISOString() || null,
            report_date_range_end: saturday?.toISOString() || null
        }
        let response
        if (existingReport) {
            response = await supabase
                .from('reports')
                .update(upsertData)
                .eq('id', existingReport.id)
                .select('id,report_name,user_id,submitted_at,data,completed,report_date_range_start,report_date_range_end,week')
                .single()
        } else {
            response = await supabase
                .from('reports')
                .insert([upsertData])
                .select('id,report_name,user_id,submitted_at,data,completed,report_date_range_start,report_date_range_end,week')
                .single()
        }
        const { data, error } = response
        if (error) {
            setLoadError(error.message || 'Error submitting report')
            return
        }
        if (data && data.id) {
            setLocalReports(prev => {
                const filtered = prev.filter(r => r.id !== data.id)
                return [
                    ...filtered,
                    {
                        id: data.id,
                        name: data.report_name,
                        title: (reportTypes.find(rt => rt.name === data.report_name) || {}).title || data.report_name,
                        completed: !!data.completed,
                        completedDate: data.submitted_at,
                        data: data.data,
                        userId: data.user_id,
                        week: data.week || data.data?.week || showForm.weekIso,
                        report_date_range_start: data.report_date_range_start ? new Date(data.report_date_range_start) : monday,
                        report_date_range_end: data.report_date_range_end ? new Date(data.report_date_range_end) : saturday
                    }
                ]
            })
            setShowForm(null)
        }
    }

    function handleReview(report) {
        setReviewData(report)
        setShowReview(reportTypes.find(rt => rt.name === report.name))
    }

    return (
        <>
            <div className="reports-root">
                {loadError && <div style={{ color: 'var(--error, red)', padding: 16 }}>{loadError}</div>}
                {!showForm && !showReview && (
                    <>
                        <div className="reports-toolbar">
                            <div className="reports-toolbar-title">
                                <i className="fas fa-file-alt"></i>
                                <span>Reports</span>
                            </div>
                            <div className="reports-tabs">
                                <button
                                    className={tab === 'all' ? 'active' : ''}
                                    onClick={() => setTab('all')}
                                    type="button"
                                >
                                    My Reports
                                </button>
                                <button
                                    className={tab === 'review' ? 'active' : ''}
                                    onClick={() => setTab('review')}
                                    type="button"
                                >
                                    Review
                                </button>
                            </div>
                        </div>
                        <div className="reports-content">
                            {tab === 'all' && (
                                <div className="reports-list">
                                    {allWeeks.length === 0 ? (
                                        <div className="reports-empty">
                                            <i className="fas fa-check-circle"></i>
                                            <div>No reports</div>
                                        </div>
                                    ) : (
                                        allWeeks.map(item => {
                                            const today = new Date()
                                            const endDateStr = item.range.split(' through ')[1]
                                            const [mm, dd, yy] = endDateStr.split('-')
                                            const endDate = new Date(`20${yy.length === 2 ? yy : yy.slice(-2)}`, mm - 1, dd)
                                            let statusText
                                            let statusColor
                                            if (item.completed) {
                                                statusText = 'Completed'
                                                statusColor = 'var(--success, #38a169)'
                                            } else if (endDate >= today) {
                                                statusText = 'Current Week'
                                                statusColor = '#166534'
                                            } else {
                                                statusText = 'Past Due'
                                                statusColor = 'var(--error, #e53e3e)'
                                            }
                                            return (
                                                <div className="reports-list-item" key={item.name + item.weekIso}>
                                                    <div className="reports-list-title">
                                                        {item.title}
                                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 8 }}>
                                                            ({item.range})
                                                        </span>
                                                        <span style={{
                                                            marginLeft: 12,
                                                            color: statusColor,
                                                            fontWeight: 600
                                                        }}>
                                                            {statusText}
                                                        </span>
                                                    </div>
                                                    {item.completed ? (
                                                        <button className="reports-list-action" onClick={() => setShowForm(item)}>
                                                            View
                                                        </button>
                                                    ) : (
                                                        <button className="reports-list-action" onClick={() => setShowForm(item)}>
                                                            Submit
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            )}
                            {tab === 'review' && (
                                <div className="reports-list">
                                    {reviewableReports.length === 0 ? (
                                        <div className="reports-empty">
                                            <i className="fas fa-user-check"></i>
                                            <div>No reports to review</div>
                                        </div>
                                    ) : (
                                        reviewableReports.map(report => {
                                            let weekRange = report.report_date_range_start && report.report_date_range_end
                                                ? getWeekRangeString(
                                                    new Date(report.report_date_range_start.getTime() + 86400000),
                                                    new Date(report.report_date_range_end.getTime() + 86400000)
                                                )
                                                : ''
                                            return (
                                                <div className="reports-list-item" key={report.id}>
                                                    <div className="reports-list-title">
                                                        {report.title}
                                                        {weekRange && (
                                                            <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 8 }}>
                                                                ({weekRange})
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="reports-list-date">{report.completedDate && new Date(report.completedDate).toLocaleString()}</div>
                                                    <div className="reports-list-date">Completed By: {getUserName(report.userId)}</div>
                                                    <button className="reports-list-action" onClick={() => handleReview(report)}>
                                                        Review
                                                    </button>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
                {showForm && (
                    <ReportsSubmitView
                        report={showForm}
                        initialData={localReports.find(r =>
                            r.name === showForm.name &&
                            r.userId === user?.id &&
                            r.week &&
                            new Date(r.week).toISOString().slice(0, 10) === showForm.weekIso
                        )?.data || null}
                        onBack={() => setShowForm(null)}
                        onSubmit={handleSubmitReport}
                        user={user}
                    />
                )}
                {showReview && (
                    <ReportsReviewView
                        report={showReview}
                        initialData={reviewData}
                        onBack={() => {
                            setShowReview(null)
                            setReviewData(null)
                        }}
                        user={user}
                        completedByUser={reviewData?.userId ? userProfiles[reviewData.userId] : undefined}
                    />
                )}
            </div>
            <div style={{ width: '100%', textAlign: 'center', marginTop: 48, marginBottom: 32, fontWeight: 600, color: 'var(--text-secondary)', paddingBottom: 32 }}>
                Weekly Reports are due on Saturdays
            </div>
        </>
    )
}

export default ReportsView
