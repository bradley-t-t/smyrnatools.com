import React, {useEffect, useState} from 'react'
import {reportTypeMap, reportTypes} from '../../../config/types/ReportTypes'
import './styles/ReportsView.css'
import ReportsSubmitView from './ReportsSubmitView'
import ReportsReviewView from './ReportsReviewView'
import {supabase} from '../../../services/DatabaseService'
import {UserService} from '../../../services/UserService'
import {ReportService} from '../../../services/ReportService'

const HARDCODED_TODAY = new Date()
const REPORTS_START_DATE = new Date('2025-07-20')

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
    const [submitInitialData, setSubmitInitialData] = useState(null)
    const [plants, setPlants] = useState([])
    const [filterReportType, setFilterReportType] = useState('')
    const [filterPlant, setFilterPlant] = useState('')
    const [managerEditUser, setManagerEditUser] = useState(null)

    const [myReportsVisibleWeeks, setMyReportsVisibleWeeks] = useState(2)
    const [reviewVisibleWeeks, setReviewVisibleWeeks] = useState(2)

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
                        title: (reportTypeMap[r.report_name] || {}).title || r.report_name,
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
                const {data: profiles, error: profileError} = await supabase
                    .from('users_profiles')
                    .select('id, first_name, last_name')
                    .in('id', userIds)
                if (!profileError && Array.isArray(profiles)) {
                    setUserProfiles(profiles.reduce((map, p) => ({...map, [p.id]: p}), {}))
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
                assigned[rt.name] = await UserService.hasPermission(u.id, rt.assignment[0])
                review[rt.name] = false
                for (const perm of rt.review) {
                    if (await UserService.hasPermission(u.id, perm)) {
                        review[rt.name] = true
                        break
                    }
                }
            }
            setHasAssigned(assigned)
            setHasReviewPermission(review)
        }

        checkAssignedAndReview()
    }, [])

    useEffect(() => {
        async function fetchPlants() {
            const {data, error} = await supabase
                .from('plants')
                .select('plant_code,plant_name')
                .order('plant_code', {ascending: true})
            setPlants(!error && Array.isArray(data)
                ? data.filter(p => p.plant_code && p.plant_name)
                : []
            )
        }

        fetchPlants()
    }, [])

    function getDueWeeks(startDate) {
        const weeks = []
        const today = HARDCODED_TODAY
        const currentMonday = ReportService.getMondayAndSaturday(today).monday
        let monday = ReportService.getMondayAndSaturday(startDate).monday
        while (monday <= currentMonday) {
            weeks.push({weekIso: ReportService.getMondayISO(monday), monday: new Date(monday)})
            monday.setDate(monday.getDate() + 7)
        }
        return weeks
    }

    const allWeeks = []
    reportTypes.forEach(rt => {
        if (!user || !hasAssigned[rt.name]) return
        getDueWeeks(REPORTS_START_DATE).forEach(({weekIso, monday}) => {
            const saturday = new Date(monday)
            saturday.setDate(monday.getDate() + 5)
            const dividerMonday = new Date(monday)
            dividerMonday.setDate(dividerMonday.getDate() + 1)
            const dividerSaturday = new Date(dividerMonday)
            dividerSaturday.setDate(dividerMonday.getDate() + 5)
            const existing = localReports.find(r =>
                r.name === rt.name &&
                r.userId === user.id &&
                r.week &&
                new Date(r.week).toISOString().slice(0, 10) === weekIso
            )
            allWeeks.push({
                ...rt,
                weekIso,
                range: ReportService.getWeekRangeString(dividerMonday, dividerSaturday),
                completed: !!(existing && existing.completed),
                report: existing || null
            })
        })
    })
    allWeeks.sort((a, b) => new Date(b.weekIso) - new Date(a.weekIso))

    const myReportsByWeek = {}
    allWeeks.forEach(item => {
        if (!myReportsByWeek[item.weekIso]) myReportsByWeek[item.weekIso] = []
        myReportsByWeek[item.weekIso].push(item)
    })
    const sortedMyWeeks = Object.keys(myReportsByWeek).sort((a, b) => new Date(b) - new Date(a))

    const reviewableReports = localReports
        .filter(r =>
            r.completed &&
            r.week &&
            hasReviewPermission[r.name] &&
            r.userId !== user?.id
        )
        .sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())

    const reviewReportsByWeek = {}
    reviewableReports.forEach(report => {
        const weekIso = report.week ? new Date(report.week).toISOString().slice(0, 10) : ''
        if (!reviewReportsByWeek[weekIso]) reviewReportsByWeek[weekIso] = []
        reviewReportsByWeek[weekIso].push(report)
    })

    const sortedReviewWeeks = Object.keys(reviewReportsByWeek)
        .sort((a, b) => new Date(b) - new Date(a))

    function getUserName(userId) {
        const profile = userProfiles[userId]
        if (profile && (profile.first_name || profile.last_name)) {
            return `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
        }
        return typeof userId === 'string' && userId.length > 0 ? userId.slice(0, 8) : ''
    }

    async function handleSubmitReport(formData, completed = true) {
        if (!showForm || !user || typeof user.id !== 'string') {
            setLoadError('User not found')
            return
        }
        const weekIso = showForm.weekIso
        const reportName = showForm.name
        const userId = user.id
        let monday = weekIso ? new Date(weekIso) : null
        let saturday = monday ? new Date(monday) : null
        if (saturday) saturday.setDate(monday.getDate() + 5)
        const upsertData = {
            report_name: reportName,
            user_id: userId,
            data: {...formData, week: weekIso},
            week: monday ? monday.toISOString() : null,
            completed: completed,
            submitted_at: new Date().toISOString(),
            report_date_range_start: monday?.toISOString() || null,
            report_date_range_end: saturday?.toISOString() || null
        }
        let response
        const {data: existing, error: findError} = await supabase
            .from('reports')
            .select('id')
            .eq('report_name', reportName)
            .eq('user_id', userId)
            .eq('week', monday ? monday.toISOString() : null)
            .maybeSingle()
        if (findError) {
            setLoadError(findError.message || 'Error checking for existing report')
            return
        }
        if (existing && existing.id) {
            response = await supabase
                .from('reports')
                .update(upsertData)
                .eq('id', existing.id)
                .select('id,report_name,user_id,submitted_at,data,completed,report_date_range_start,report_date_range_end,week')
                .single()
        } else {
            response = await supabase
                .from('reports')
                .insert([upsertData])
                .select('id,report_name,user_id,submitted_at,data,completed,report_date_range_start,report_date_range_end,week')
                .single()
        }
        const {data, error} = response
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
                        title: (reportTypeMap[data.report_name] || {}).title || data.report_name,
                        completed: !!data.completed,
                        completedDate: data.submitted_at,
                        data: data.data,
                        userId: data.user_id,
                        week: data.week || data.data?.week || weekIso,
                        report_date_range_start: data.report_date_range_start ? new Date(data.report_date_range_start) : monday,
                        report_date_range_end: data.report_date_range_end ? new Date(data.report_date_range_end) : saturday
                    }
                ]
            })
            setShowForm(null)
        }
    }

    async function handleManagerEditSubmit(formData) {
        if (!showForm || !managerEditUser) {
            setLoadError('No user selected for manager edit')
            return
        }
        const weekIso = showForm.weekIso
        const reportName = showForm.name
        const userId = managerEditUser
        let monday = weekIso ? new Date(weekIso) : null
        let saturday = monday ? new Date(monday) : null
        if (saturday) saturday.setDate(monday.getDate() + 5)
        const upsertData = {
            report_name: reportName,
            user_id: userId,
            data: {...formData, week: weekIso},
            week: monday ? monday.toISOString() : null,
            completed: true,
            submitted_at: new Date().toISOString(),
            report_date_range_start: monday?.toISOString() || null,
            report_date_range_end: saturday?.toISOString() || null
        }
        let response
        const {data: existing, error: findError} = await supabase
            .from('reports')
            .select('id')
            .eq('report_name', reportName)
            .eq('user_id', userId)
            .eq('week', monday ? monday.toISOString() : null)
            .maybeSingle()
        if (findError) {
            setLoadError(findError.message || 'Error checking for existing report')
            return
        }
        if (existing && existing.id) {
            response = await supabase
                .from('reports')
                .update(upsertData)
                .eq('id', existing.id)
                .select('id,report_name,user_id,submitted_at,data,completed,report_date_range_start,report_date_range_end,week')
                .single()
        } else {
            response = await supabase
                .from('reports')
                .insert([upsertData])
                .select('id,report_name,user_id,submitted_at,data,completed,report_date_range_start,report_date_range_end,week')
                .single()
        }
        const {data, error} = response
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
                        title: (reportTypeMap[data.report_name] || {}).title || data.report_name,
                        completed: !!data.completed,
                        completedDate: data.submitted_at,
                        data: data.data,
                        userId: data.user_id,
                        week: data.week || data.data?.week || weekIso,
                        report_date_range_start: data.report_date_range_start ? new Date(data.report_date_range_start) : monday,
                        report_date_range_end: data.report_date_range_end ? new Date(data.report_date_range_end) : saturday
                    }
                ]
            })
            setShowForm(null)
            setManagerEditUser(null)
        }
    }

    function handleReview(report) {
        setReviewData(report)
        setShowReview(reportTypes.find(rt => rt.name === report.name))
    }

    function handleManagerEdit(reportType, reportData) {
        setShowReview(null)
        setReviewData(null)
        setShowForm({
            ...reportType,
            weekIso: reportData.week || reportData.data?.week,
            name: reportType.name
        })
        setSubmitInitialData({
            ...reportData,
            data: reportData.data
        })
        setManagerEditUser(reportData.userId)
    }

    async function handleShowForm(item) {
        setSubmitInitialData(null)
        if (!user || !item || !item.name || !item.weekIso) {
            setShowForm(item)
            return
        }
        const {data, error} = await supabase
            .from('reports')
            .select('id,report_name,user_id,submitted_at,data,completed,report_date_range_start,report_date_range_end,week')
            .eq('report_name', item.name)
            .eq('user_id', user.id)
            .eq('week', new Date(item.weekIso).toISOString())
            .maybeSingle()
        if (!error && data) {
            setSubmitInitialData({
                id: data.id,
                name: data.report_name,
                title: (reportTypeMap[data.report_name] || {}).title || data.report_name,
                completed: !!data.completed,
                completedDate: data.submitted_at,
                data: data.data,
                userId: data.user_id,
                week: data.week || data.data?.week || item.weekIso,
                report_date_range_start: data.report_date_range_start ? new Date(data.report_date_range_start) : null,
                report_date_range_end: data.report_date_range_end ? new Date(data.report_date_range_end) : null
            })
        } else {
            setSubmitInitialData(null)
        }
        setShowForm(item)
    }

    const filteredMyWeeks = sortedMyWeeks.filter(weekIso => {
        const weekItems = myReportsByWeek[weekIso]
        return weekItems.some(item => {
            let matchType = !filterReportType || item.name === filterReportType
            let matchPlant = true
            if (filterPlant) {
                const plant = ReportService.getPlantNameFromWeekItem(item)
                matchPlant = plant === filterPlant
            }
            return matchType && matchPlant
        })
    }).slice(0, myReportsVisibleWeeks)

    const filteredReviewWeeks = sortedReviewWeeks.filter(weekIso => {
        const weekReports = reviewReportsByWeek[weekIso]
        return weekReports.some(report => {
            let matchType = !filterReportType || report.name === filterReportType
            let matchPlant = true
            if (filterPlant) {
                const plant = ReportService.getPlantNameFromReport(report)
                matchPlant = plant === filterPlant
            }
            return matchType && matchPlant
        })
    }).slice(0, reviewVisibleWeeks)
    reportTypes.filter(rt =>
        (tab === 'all' && hasAssigned[rt.name]) ||
        (tab === 'review' && hasReviewPermission[rt.name])
    );
    return (
        <>
            <div className="reports-root">
                {loadError && <div style={{color: 'var(--error)', padding: 16}}>{loadError}</div>}
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
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: 16,
                            alignItems: 'center',
                            margin: '16px 24px 8px 0'
                        }}>
                            <select
                                value={filterReportType}
                                onChange={e => setFilterReportType(e.target.value)}
                                style={{
                                    background: 'var(--background)',
                                    border: '1.5px solid var(--divider)',
                                    borderRadius: 8,
                                    fontSize: 15,
                                    padding: '6px 14px',
                                    color: 'var(--text-primary)',
                                    minWidth: 180,
                                    boxShadow: '0 1px 4px var(--shadow-xs)',
                                    outline: 'none',
                                    appearance: 'none'
                                }}
                            >
                                <option value="">All Report Types</option>
                                {reportTypes
                                    .filter(rt =>
                                        (tab === 'all' && hasAssigned[rt.name]) ||
                                        (tab === 'review' && hasReviewPermission[rt.name])
                                    )
                                    .map(rt => (
                                        <option key={rt.name} value={rt.name}>{rt.title}</option>
                                    ))}
                            </select>
                            <select
                                value={filterPlant}
                                onChange={e => setFilterPlant(e.target.value)}
                                style={{
                                    background: 'var(--background)',
                                    border: '1.5px solid var(--divider)',
                                    borderRadius: 8,
                                    fontSize: 15,
                                    padding: '6px 14px',
                                    color: 'var(--text-primary)',
                                    minWidth: 180,
                                    boxShadow: '0 1px 4px var(--shadow-xs)',
                                    outline: 'none',
                                    appearance: 'none'
                                }}
                            >
                                <option value="">All Plants</option>
                                {plants.map(p => (
                                    <option key={p.plant_code} value={p.plant_code}>{p.plant_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="reports-content">
                            {tab === 'all' && (
                                <div className="reports-list">
                                    {filteredMyWeeks.length === 0 ? (
                                        <div className="reports-empty">
                                            <i className="fas fa-check-circle"></i>
                                            <div>No reports</div>
                                        </div>
                                    ) : (
                                        <>
                                            {filteredMyWeeks.map(weekIso => {
                                                const weekItems = myReportsByWeek[weekIso].filter(item => {
                                                    let matchType = !filterReportType || item.name === filterReportType
                                                    let matchPlant = true
                                                    if (filterPlant) {
                                                        const plant = ReportService.getPlantNameFromWeekItem(item)
                                                        matchPlant = plant === filterPlant
                                                    }
                                                    return matchType && matchPlant
                                                })
                                                if (weekItems.length === 0) return null
                                                const weekStart = new Date(weekIso)
                                                weekStart.setDate(weekStart.getDate() + 1)
                                                const weekEnd = new Date(weekStart)
                                                weekEnd.setDate(weekStart.getDate() + 5)
                                                const weekRange = ReportService.getWeekRangeString(weekStart, weekEnd)
                                                return (
                                                    <div key={weekIso} style={{marginBottom: 32}}>
                                                        <div
                                                            style={{
                                                                fontWeight: 700,
                                                                fontSize: '1.08rem',
                                                                color: 'var(--accent)',
                                                                margin: '18px 0 8px 0',
                                                                letterSpacing: '0.01em',
                                                                paddingLeft: 24
                                                            }}
                                                        >
                                                            {weekRange}
                                                        </div>
                                                        {weekItems.map(item => {
                                                            const today = new Date()
                                                            const endDateStr = item.range.split(' through ')[1]
                                                            const [mm, dd, yy] = endDateStr.split('-')
                                                            const endDate = new Date(`20${yy.length === 2 ? yy : yy.slice(-2)}`, mm - 1, dd)
                                                            let statusText
                                                            let statusColor
                                                            let hasSavedData = !!(item.report && item.report.data)
                                                            let buttonLabel = item.completed ? 'View' : (hasSavedData ? 'Edit' : 'Submit')
                                                            if (item.completed) {
                                                                statusText = 'Completed'
                                                                statusColor = 'var(--success)'
                                                            } else if (hasSavedData) {
                                                                statusText = 'Continue Editing'
                                                                statusColor = 'var(--blue)'
                                                            } else if (endDate >= today) {
                                                                statusText = 'Current Week'
                                                                statusColor = 'var(--accent)'
                                                            } else {
                                                                statusText = 'Past Due'
                                                                statusColor = 'var(--error)'
                                                            }
                                                            return (
                                                                <div className="reports-list-item"
                                                                     key={item.name + item.weekIso}>
                                                                    <div className="reports-list-title">
                                                                        {item.title}
                                                                        <span style={{
                                                                            marginLeft: 12,
                                                                            color: statusColor,
                                                                            fontWeight: 600
                                                                        }}>
                                                                            {statusText}
                                                                        </span>
                                                                    </div>
                                                                    <button className="reports-list-action"
                                                                            onClick={() => handleShowForm(item)}>
                                                                        {buttonLabel}
                                                                    </button>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )
                                            })}
                                            {(myReportsVisibleWeeks < sortedMyWeeks.length || myReportsVisibleWeeks > 2) && (
                                                <div style={{
                                                    textAlign: 'center',
                                                    marginTop: 16,
                                                    paddingBottom: 32,
                                                    display: 'flex',
                                                    flexDirection: 'row',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    gap: 16
                                                }}>
                                                    {myReportsVisibleWeeks < sortedMyWeeks.length && (
                                                        <button
                                                            type="button"
                                                            style={{
                                                                background: 'var(--accent)',
                                                                color: 'var(--text-light)',
                                                                border: 'none',
                                                                borderRadius: 8,
                                                                padding: '8px 22px',
                                                                fontWeight: 600,
                                                                fontSize: 15,
                                                                cursor: 'pointer',
                                                                marginTop: 8,
                                                                marginBottom: 8
                                                            }}
                                                            onClick={() => setMyReportsVisibleWeeks(w => w + 2)}
                                                        >
                                                            Show More
                                                        </button>
                                                    )}
                                                    {myReportsVisibleWeeks > 2 && (
                                                        <button
                                                            type="button"
                                                            style={{
                                                                background: 'var(--divider)',
                                                                color: 'var(--text-primary)',
                                                                border: 'none',
                                                                borderRadius: 8,
                                                                padding: '8px 22px',
                                                                fontWeight: 600,
                                                                fontSize: 15,
                                                                cursor: 'pointer',
                                                                marginTop: 8,
                                                                marginBottom: 8
                                                            }}
                                                            onClick={() => setMyReportsVisibleWeeks(2)}
                                                        >
                                                            Show Less
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                            {tab === 'review' && (
                                <div className="reports-list">
                                    {filteredReviewWeeks.length === 0 ? (
                                        <div className="reports-empty">
                                            <i className="fas fa-user-check"></i>
                                            <div>No reports to review</div>
                                        </div>
                                    ) : (
                                        <>
                                            {filteredReviewWeeks.map(weekIso => {
                                                const weekReports = reviewReportsByWeek[weekIso].filter(report => {
                                                    let matchType = !filterReportType || report.name === filterReportType
                                                    let matchPlant = true
                                                    if (filterPlant) {
                                                        const plant = ReportService.getPlantNameFromReport(report)
                                                        matchPlant = plant === filterPlant
                                                    }
                                                    return matchType && matchPlant
                                                })
                                                if (weekReports.length === 0) return null
                                                const weekStart = new Date(weekIso)
                                                weekStart.setDate(weekStart.getDate() + 1)
                                                const weekEnd = new Date(weekStart)
                                                weekEnd.setDate(weekStart.getDate() + 5)
                                                const weekRange = ReportService.getWeekRangeString(weekStart, weekEnd)
                                                return (
                                                    <div key={weekIso} style={{marginBottom: 32}}>
                                                        <div
                                                            style={{
                                                                fontWeight: 700,
                                                                fontSize: '1.08rem',
                                                                color: 'var(--accent)',
                                                                margin: '18px 0 8px 0',
                                                                letterSpacing: '0.01em',
                                                                paddingLeft: 24
                                                            }}
                                                        >
                                                            {weekRange}
                                                        </div>
                                                        {weekReports.map(report => (
                                                            <div className="reports-list-item" key={report.id}>
                                                                <div className="reports-list-title">
                                                                    {report.title}
                                                                </div>
                                                                <div className="reports-list-date">Completed
                                                                    By: {getUserName(report.userId)}</div>
                                                                <button className="reports-list-action"
                                                                        onClick={() => handleReview(report)}>
                                                                    Review
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )
                                            })}
                                            {(reviewVisibleWeeks < sortedReviewWeeks.length || reviewVisibleWeeks > 2) && (
                                                <div style={{
                                                    textAlign: 'center',
                                                    marginTop: 16,
                                                    paddingBottom: 32,
                                                    display: 'flex',
                                                    flexDirection: 'row',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    gap: 16
                                                }}>
                                                    {reviewVisibleWeeks < sortedReviewWeeks.length && (
                                                        <button
                                                            type="button"
                                                            style={{
                                                                background: 'var(--accent)',
                                                                color: 'var(--text-light)',
                                                                border: 'none',
                                                                borderRadius: 8,
                                                                padding: '8px 22px',
                                                                fontWeight: 600,
                                                                fontSize: 15,
                                                                cursor: 'pointer',
                                                                marginTop: 8,
                                                                marginBottom: 8
                                                            }}
                                                            onClick={() => setReviewVisibleWeeks(w => w + 2)}
                                                        >
                                                            Show More
                                                        </button>
                                                    )}
                                                    {reviewVisibleWeeks > 2 && (
                                                        <button
                                                            type="button"
                                                            style={{
                                                                background: 'var(--divider)',
                                                                color: 'var(--text-primary)',
                                                                border: 'none',
                                                                borderRadius: 8,
                                                                padding: '8px 22px',
                                                                fontWeight: 600,
                                                                fontSize: 15,
                                                                cursor: 'pointer',
                                                                marginTop: 8,
                                                                marginBottom: 8
                                                            }}
                                                            onClick={() => setReviewVisibleWeeks(2)}
                                                        >
                                                            Show Less
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
                {showForm && (
                    <ReportsSubmitView
                        report={reportTypeMap[showForm.name] || showForm}
                        initialData={submitInitialData}
                        onBack={() => {
                            setShowForm(null)
                            setManagerEditUser(null)
                        }}
                        onSubmit={(form, submitType) => {
                            if (managerEditUser) {
                                handleManagerEditSubmit(form)
                            } else {
                                handleSubmitReport(form, submitType === 'submit')
                            }
                        }}
                        user={user}
                        readOnly={showReview === null && reviewData !== null}
                        managerEditUser={managerEditUser}
                        userProfiles={userProfiles}
                    />
                )}
                {showReview && (
                    <ReportsReviewView
                        report={reportTypeMap[showReview.name] || showReview}
                        initialData={reviewData}
                        onBack={() => {
                            setShowReview(null)
                            setReviewData(null)
                        }}
                        user={user}
                        completedByUser={reviewData?.userId ? userProfiles[reviewData.userId] : undefined}
                        onManagerEdit={handleManagerEdit}
                    />
                )}
            </div>
            <div style={{
                width: '100%',
                textAlign: 'center',
                marginTop: 48,
                marginBottom: 32,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                paddingBottom: 32
            }}>
                Weekly Reports are due Saturday by end of day.
            </div>
        </>
    )
}

export default ReportsView
