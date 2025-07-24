import React, { useState, useEffect } from 'react'
import { reportTypes } from '../../config/ReportTypes'
import './ReportsView.css'
import ReportsSubmitView from './ReportsSubmitView'
import ReportsReviewView from './ReportsReviewView'
import { supabase } from '../../services/DatabaseService'
import { UserService } from '../../services/UserService'

const REPORTS_START_DATE = new Date('2025-07-23')

function getMondayAndSaturday(date = new Date()) {
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

function getReportWeekRange(report) {
    let monday, saturday
    if (report.data && report.data.week) {
        monday = new Date(report.data.week)
        const ms = getMondayAndSaturday(monday)
        monday = ms.monday
        saturday = ms.saturday
    } else if (report.completedDate) {
        const completed = new Date(report.completedDate)
        const ms = getMondayAndSaturday(completed)
        monday = ms.monday
        saturday = ms.saturday
    } else {
        return ''
    }
    return getWeekRangeString(monday, saturday)
}

function getAllDueDistrictManagerWeeks(localReports, user) {
    const today = new Date()
    const { monday: firstMonday } = getMondayAndSaturday(today)
    let weeks = []
    let weekCursor = new Date(firstMonday)
    while (true) {
        if (weekCursor < REPORTS_START_DATE) break
        const weekIso = weekCursor.toISOString().slice(0, 10)
        const alreadySubmitted = localReports.some(
            r => r.name === 'district_manager' && r.userId === user.id && r.data && r.data.week === weekIso
        )
        const saturday = new Date(weekCursor)
        saturday.setDate(weekCursor.getDate() + 5)
        const lastDay = new Date(saturday)
        const overdueCutoff = new Date(lastDay)
        overdueCutoff.setDate(lastDay.getDate() + 7)
        if (!alreadySubmitted && today >= weekCursor && today <= overdueCutoff) {
            weeks.push(weekIso)
        }
        weekCursor.setDate(weekCursor.getDate() - 7)
        if (today < weekCursor) break
    }
    weeks.reverse()
    let nextWeek = new Date(firstMonday)
    nextWeek.setDate(firstMonday.getDate() + 7)
    if (nextWeek >= REPORTS_START_DATE) {
        const nextWeekIso = nextWeek.toISOString().slice(0, 10)
        const nextAlreadySubmitted = localReports.some(
            r => r.name === 'district_manager' && r.userId === user.id && r.data && r.data.week === nextWeekIso
        )
        if (!nextAlreadySubmitted) {
            weeks.push(nextWeekIso)
        }
    }
    return weeks
}

function getDueReportRanges(report, localReports, user) {
    if (report.name === 'district_manager') {
        const dueWeeks = getAllDueDistrictManagerWeeks(localReports, user)
        return dueWeeks.map(weekIso => {
            const monday = new Date(weekIso)
            const ms = getMondayAndSaturday(monday)
            return { weekIso, range: getWeekRangeString(ms.monday, ms.saturday) }
        })
    }
    if (report.frequency === 'weekly') {
        const { monday, saturday } = getMondayAndSaturday(new Date())
        if (monday < REPORTS_START_DATE) return []
        const lastDay = new Date(saturday)
        const overdueCutoff = new Date(lastDay)
        overdueCutoff.setDate(lastDay.getDate() + 7)
        const today = new Date()
        let due = []
        if (today <= overdueCutoff) {
            due.push({ weekIso: getMondayISO(new Date()), range: getWeekRangeString(monday, saturday) })
        }
        let nextMonday = new Date(monday)
        nextMonday.setDate(monday.getDate() + 7)
        if (nextMonday >= REPORTS_START_DATE) {
            const alreadySubmitted = localReports.some(r => r.name === report.name && r.userId === user.id && r.completed && r.week === nextMonday.toISOString().slice(0, 10))
            if (!alreadySubmitted) {
                const nextSaturday = new Date(nextMonday)
                nextSaturday.setDate(nextMonday.getDate() + 5)
                due.push({ weekIso: nextMonday.toISOString().slice(0, 10), range: getWeekRangeString(nextMonday, nextSaturday) })
            }
        }
        return due
    }
    return []
}

function ReportsView() {
    const [search, setSearch] = useState('')
    const [localReports, setLocalReports] = useState([])
    const [showForm, setShowForm] = useState(null)
    const [showReview, setShowReview] = useState(null)
    const [reviewData, setReviewData] = useState(null)
    const [tab, setTab] = useState('due')
    const [loadError, setLoadError] = useState('')
    const [user, setUser] = useState(null)
    const [userProfiles, setUserProfiles] = useState({})

    useEffect(() => {
        async function fetchUserAndReports() {
            let u
            try {
                u = await UserService.getCurrentUser()
            } catch (err) {
                setLoadError(err && err.message ? err.message : '')
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
                    .select('id,report_name,user_id,submitted_at,data,completed')
                data = res.data
                error = res.error
            } catch (err) {
                setLoadError(err && err.message ? err.message : '')
                setLocalReports([])
                return
            }
            if (error) {
                setLocalReports([])
                setLoadError(error.message ? error.message : '')
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
                        week: r.data && r.data.week ? r.data.week : null
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
                    const map = {}
                    profiles.forEach(p => {
                        map[p.id] = p
                    })
                    setUserProfiles(map)
                }
            }
        }
        fetchUserAndReports()
    }, [])

    const completedReports = localReports
        .filter(r =>
            r.completed &&
            user &&
            r.userId === user.id &&
            (!r.week || new Date(r.week) >= REPORTS_START_DATE)
        )
        .sort((a, b) => {
            const aDate = a.completedDate ? new Date(a.completedDate).getTime() : 0
            const bDate = b.completedDate ? new Date(b.completedDate).getTime() : 0
            return bDate - aDate
        })

    const [hasAssigned, setHasAssigned] = useState('')
    useEffect(() => {
        async function checkAssigned() {
            let u
            try {
                u = await UserService.getCurrentUser()
            } catch {
                setHasAssigned({})
                return
            }
            if (!u || typeof u.id !== 'string') {
                setHasAssigned({})
                return
            }
            let assigned = {}
            for (const rt of reportTypes) {
                try {
                    assigned[rt.name] = await UserService.hasPermission(u.id, `reports.assigned.${rt.name}`)
                } catch {
                    assigned[rt.name] = false
                }
            }
            setHasAssigned(assigned)
        }
        checkAssigned()
    }, [])

    let dueReports = []
    reportTypes.forEach(rt => {
        if (!user) return
        if (!hasAssigned[rt.name]) return
        if (rt.name === 'district_manager') {
            const dueRanges = getDueReportRanges(rt, localReports, user)
            dueRanges.forEach(({ weekIso, range }) => {
                if (new Date(weekIso) >= REPORTS_START_DATE) {
                    dueReports.push({
                        ...rt,
                        weekIso,
                        range
                    })
                }
            })
        } else {
            const { monday, saturday } = getMondayAndSaturday(new Date())
            if (monday < REPORTS_START_DATE) return
            const lastDay = new Date(saturday)
            const overdueCutoff = new Date(lastDay)
            overdueCutoff.setDate(lastDay.getDate() + 7)
            const today = new Date()
            let added = false
            if (today <= overdueCutoff) {
                const alreadySubmitted = localReports.some(r => r.name === rt.name && r.userId === user.id && r.completed && r.week === getMondayISO(new Date()))
                if (!alreadySubmitted) {
                    dueReports.push({
                        ...rt,
                        weekIso: getMondayISO(new Date()),
                        range: getWeekRangeString(monday, saturday)
                    })
                    added = true
                }
            }
            let nextMonday = new Date(monday)
            nextMonday.setDate(monday.getDate() + 7)
            if (nextMonday >= REPORTS_START_DATE) {
                const alreadySubmittedNext = localReports.some(r => r.name === rt.name && r.userId === user.id && r.completed && r.week === nextMonday.toISOString().slice(0, 10))
                if (!alreadySubmittedNext) {
                    const nextSaturday = new Date(nextMonday)
                    nextSaturday.setDate(nextMonday.getDate() + 5)
                    dueReports.push({
                        ...rt,
                        weekIso: nextMonday.toISOString().slice(0, 10),
                        range: getWeekRangeString(nextMonday, nextSaturday)
                    })
                }
            }
        }
    })
    dueReports.sort((a, b) => new Date(b.weekIso) - new Date(a.weekIso))

    const reviewableReports = localReports
        .filter(r =>
            r.completed &&
            (!user || r.userId !== user.id) &&
            (!r.week || new Date(r.week) >= REPORTS_START_DATE)
        )
        .sort((a, b) => {
            const aDate = a.completedDate ? new Date(a.completedDate).getTime() : 0
            const bDate = b.completedDate ? new Date(b.completedDate).getTime() : 0
            return bDate - aDate
        })

    function getUserName(userId) {
        const profile = userProfiles[userId]
        if (profile && (profile.first_name || profile.last_name)) {
            return `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
        }
        if (typeof userId === 'string' && userId.length > 0) {
            return userId.slice(0, 8)
        }
        return ''
    }

    async function handleSubmitReport(formData) {
        let u
        try {
            u = await UserService.getCurrentUser()
        } catch (err) {
            return
        }
        if (!showForm) return
        if (!u || typeof u.id !== 'string') {
            setLoadError('User not found')
            return
        }
        if (showForm.weekIso && new Date(showForm.weekIso) < REPORTS_START_DATE) {
            return
        }
        if (showForm.frequency === 'weekly') {
            const { monday } = getMondayAndSaturday(new Date())
            if (monday < REPORTS_START_DATE) {
                return
            }
        }
        let data, error
        let insertData = {
            report_name: showForm.name,
            user_id: u.id,
            data: formData,
            completed: true
        }
        if (showForm.name === 'district_manager') {
            insertData.data = { ...formData, week: showForm.weekIso }
        }
        try {
            const res = await supabase.from('reports').insert([insertData]).select('id,submitted_at,user_id,completed,data').single()
            data = res.data
            error = res.error
        } catch (err) {
            setLoadError(err && err.message ? err.message : 'Error submitting report')
            return
        }
        if (error) {
            setLoadError(error.message ? error.message : 'Error submitting report')
            return
        }
        if (data && data.id) {
            setLocalReports(prev => [
                ...prev,
                {
                    id: data.id,
                    name: showForm.name,
                    title: showForm.title,
                    completed: !!data.completed,
                    completedDate: data.submitted_at,
                    data: data.data,
                    userId: data.user_id
                }
            ])
        }
    }

    function handleReview(report) {
        setReviewData(report)
        setShowReview(reportTypes.find(rt => rt.name === report.name))
    }

    return (
        <div className="reports-root">
            {loadError && <div style={{color: 'var(--error, red)', padding: 16}}>{typeof loadError === 'string' ? loadError : 'Error'}</div>}
            {!showForm && !showReview && (
                <>
                    <div className="reports-toolbar">
                        <div className="reports-toolbar-title">
                            <i className="fas fa-file-alt"></i>
                            <span>Reports</span>
                        </div>
                        <div style={{ flex: 1 }} />
                        <div className="reports-tabs">
                            <button className={tab === 'due' ? 'active' : ''} onClick={() => setTab('due')}>
                                Due
                            </button>
                            <button className={tab === 'completed' ? 'active' : ''} onClick={() => setTab('completed')}>
                                Completed
                            </button>
                            <button className={tab === 'review' ? 'active' : ''} onClick={() => setTab('review')}>
                                Review
                            </button>
                        </div>
                    </div>
                    <div className="reports-content">
                        {tab === 'due' && (
                            <div className="reports-list">
                                {dueReports.length === 0 ? (
                                    <div className="reports-empty">
                                        <i className="fas fa-check-circle"></i>
                                        <div>No reports due</div>
                                    </div>
                                ) : dueReports.map(report => (
                                    <div className="reports-list-item" key={report.name + report.weekIso}>
                                        <div className="reports-list-title">
                                            {report.title}
                                            {report.range && (
                                                <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 8 }}>
                                                    ({report.range})
                                                </span>
                                            )}
                                        </div>
                                        <button className="reports-list-action" onClick={() => setShowForm(report)}>
                                            Submit
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {tab === 'completed' && (
                            <div className="reports-list">
                                {completedReports.length === 0 ? (
                                    <div className="reports-empty">
                                        <i className="fas fa-folder-open"></i>
                                        <div>No completed reports</div>
                                    </div>
                                ) : completedReports.map(report => {
                                    let weekRange = getReportWeekRange(report)
                                    return (
                                        <div className="reports-list-item" key={report.id || report.name}>
                                            <div className="reports-list-title">
                                                {report.title}
                                                {weekRange && (
                                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 8 }}>
                                                        ({weekRange})
                                                    </span>
                                                )}
                                            </div>
                                            <div className="reports-list-date">{report.completedDate && new Date(report.completedDate).toLocaleString()}</div>
                                            <div className="reports-list-date">Completed By: {user && user.id === report.userId ? 'You' : getUserName(report.userId)}</div>
                                            <button className="reports-list-action" onClick={() => handleReview(report)}>
                                                Edit
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        {tab === 'review' && (
                            <div className="reports-list">
                                {reviewableReports.length === 0 ? (
                                    <div className="reports-empty">
                                        <i className="fas fa-user-check"></i>
                                        <div>No reports to review</div>
                                    </div>
                                ) : reviewableReports.map(report => (
                                    <div className="reports-list-item" key={report.id}>
                                        <div className="reports-list-title">{report.title}</div>
                                        <div className="reports-list-date">{report.completedDate && new Date(report.completedDate).toLocaleString()}</div>
                                        <div className="reports-list-date">Completed By: {getUserName(report.userId)}</div>
                                        <button className="reports-list-action" onClick={() => handleReview(report)}>
                                            Review
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
            {showForm && (
                <ReportsSubmitView
                    report={showForm}
                    onBack={() => setShowForm(null)}
                    onSubmit={handleSubmitReport}
                    user={user}
                />
            )}
            {showReview && tab === 'review' && (
                <ReportsReviewView
                    report={showReview}
                    initialData={reviewData && reviewData.data}
                    onBack={() => {
                        setShowReview(null)
                        setReviewData(null)
                    }}
                    user={user}
                    completedByUser={reviewData && reviewData.userId ? userProfiles[reviewData.userId] && { ...userProfiles[reviewData.userId], id: reviewData.userId } : undefined}
                />
            )}
            {showReview && tab !== 'review' && (
                <ReportsSubmitView
                    report={showReview}
                    initialData={reviewData && reviewData.data}
                    onBack={() => {
                        setShowReview(null)
                        setReviewData(null)
                    }}
                    onSubmit={formData => {
                        setLocalReports(reports =>
                            reports.map(r =>
                                r.id === reviewData.id
                                    ? { ...r, data: formData }
                                    : r
                            )
                        )
                        setShowReview(null)
                        setReviewData(null)
                    }}
                    readOnly={false}
                    user={user}
                />
            )}
        </div>
    )
}

export default ReportsView
