import React, {useEffect, useMemo, useState} from 'react'
import {reportTypeMap, reportTypes} from '../../../config/types/ReportTypes'
import './styles/ReportsView.css'
import ReportsSubmitView from './ReportsSubmitView'
import ReportsReviewView from './ReportsReviewView'
import {supabase} from '../../../services/DatabaseService'
import {UserService} from '../../../services/UserService'
import {ReportService} from '../../../services/ReportService'
import LoadingScreen from '../common/LoadingScreen'

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

    const [isLoadingUser, setIsLoadingUser] = useState(true)
    const [isLoadingMy, setIsLoadingMy] = useState(false)
    const [isLoadingReview, setIsLoadingReview] = useState(false)
    const [isLoadingPermissions, setIsLoadingPermissions] = useState(true)
    const [myLoadedWeeks, setMyLoadedWeeks] = useState(new Set())
    const [reviewLoadedWeeks, setReviewLoadedWeeks] = useState(new Set())

    function getLastNWeekIsos(n) {
        const weeks = []
        const currentMonday = ReportService.getMondayAndSaturday(HARDCODED_TODAY).monday
        let ptr = new Date(currentMonday)
        for (let i = 0; i < n; i++) {
            weeks.push(ReportService.getMondayISO(ptr))
            ptr.setDate(ptr.getDate() - 7)
        }
        return weeks
    }

    function getTotalWeeksSinceStart() {
        const currentMonday = ReportService.getMondayAndSaturday(HARDCODED_TODAY).monday
        const startMonday = ReportService.getMondayAndSaturday(REPORTS_START_DATE).monday
        const diffMs = currentMonday.getTime() - startMonday.getTime()
        const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
        return Math.max(weeks, 0)
    }

    async function fetchProfilesFor(userIds) {
        const missing = userIds.filter(id => !userProfiles[id])
        if (missing.length === 0) return
        const {data: profiles, error} = await supabase
            .from('users_profiles')
            .select('id, first_name, last_name')
            .in('id', missing)
        if (!error && Array.isArray(profiles)) {
            setUserProfiles(prev => profiles.reduce((map, p) => ({...map, [p.id]: p}), {...prev}))
        }
    }

    async function fetchReportsBatch({weeks, scope}) {
        if (!user || !Array.isArray(weeks) || weeks.length === 0) return
        const isoList = weeks.map(w => new Date(w).toISOString())
        let query = supabase
            .from('reports')
            .select('id,report_name,user_id,submitted_at,data,completed,report_date_range_start,report_date_range_end,week')
            .in('week', isoList)
        if (scope === 'my') {
            const allowedMy = reportTypes.filter(rt => hasAssigned[rt.name]).map(rt => rt.name)
            query = query.eq('user_id', user.id)
            if (allowedMy.length > 0) query = query.in('report_name', allowedMy)
        } else if (scope === 'review') {
            const allowedReview = reportTypes.filter(rt => hasReviewPermission[rt.name]).map(rt => rt.name)
            query = query.neq('user_id', user.id).eq('completed', true)
            if (allowedReview.length > 0) query = query.in('report_name', allowedReview)
        }
        const {data, error} = await query
        if (error) {
            setLoadError(error.message || 'Error fetching reports')
            return
        }
        if (!Array.isArray(data)) return
        setLocalReports(prev => {
            const existingIds = new Set(prev.map(r => r.id))
            const mapped = data
                .filter(r => !existingIds.has(r.id))
                .map(r => ({
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
            return [...prev, ...mapped]
        })
        const ids = Array.from(new Set(data.map(r => r.user_id).filter(Boolean)))
        await fetchProfilesFor(ids)
    }

    useEffect(() => {
        async function init() {
            setIsLoadingUser(true)
            try {
                const u = await UserService.getCurrentUser()
                if (u && typeof u.id === 'string') {
                    setUser(u)
                } else {
                    setUser(null)
                }
            } catch (err) {
                setLoadError(err?.message || 'Error fetching user')
                setUser(null)
            } finally {
                setIsLoadingUser(false)
            }
        }

        init()
    }, [])

    useEffect(() => {
        async function checkAssignedAndReview() {
            setIsLoadingPermissions(true)
            if (!user || !user.id) {
                setHasAssigned({})
                setHasReviewPermission({})
                setIsLoadingPermissions(false)
                return
            }
            const assigned = {}
            const review = {}
            await Promise.all(reportTypes.map(async rt => {
                const a = await UserService.hasPermission(user.id, rt.assignment[0])
                assigned[rt.name] = !!a
                review[rt.name] = false
                const checks = await Promise.all(rt.review.map(perm => UserService.hasPermission(user.id, perm)))
                review[rt.name] = checks.some(Boolean)
            }))
            setHasAssigned(assigned)
            setHasReviewPermission(review)
            setIsLoadingPermissions(false)
        }

        checkAssignedAndReview()
    }, [user])

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

    useEffect(() => {
        if (!user || isLoadingPermissions) return
        const initialMyWeeks = getLastNWeekIsos(2)

        async function loadInitial() {
            setIsLoadingMy(true)
            await fetchReportsBatch({weeks: initialMyWeeks, scope: 'my'})
            setMyLoadedWeeks(new Set(initialMyWeeks))
            setIsLoadingMy(false)
        }

        loadInitial()
    }, [user, isLoadingPermissions, hasAssigned])

    useEffect(() => {
        if (!user || isLoadingPermissions || tab !== 'review') return
        const desiredWeeks = new Set(getLastNWeekIsos(reviewVisibleWeeks))
        const toLoad = Array.from(desiredWeeks).filter(w => !reviewLoadedWeeks.has(w))
        if (toLoad.length === 0) return
        let cancelled = false

        async function loadReview() {
            setIsLoadingReview(true)
            await fetchReportsBatch({weeks: toLoad, scope: 'review'})
            if (!cancelled) setReviewLoadedWeeks(prev => new Set([...Array.from(prev), ...toLoad]))
            setIsLoadingReview(false)
        }

        loadReview()
        return () => {
            cancelled = true
        }
    }, [tab, user, isLoadingPermissions, reviewVisibleWeeks])

    useEffect(() => {
        if (!user || isLoadingPermissions) return
        const desiredWeeks = new Set(getLastNWeekIsos(myReportsVisibleWeeks))
        const toLoad = Array.from(desiredWeeks).filter(w => !myLoadedWeeks.has(w))
        if (toLoad.length === 0) return
        let cancelled = false

        async function loadMoreMy() {
            setIsLoadingMy(true)
            await fetchReportsBatch({weeks: toLoad, scope: 'my'})
            if (!cancelled) setMyLoadedWeeks(prev => new Set([...Array.from(prev), ...toLoad]))
            setIsLoadingMy(false)
        }

        loadMoreMy()
        return () => {
            cancelled = true
        }
    }, [myReportsVisibleWeeks, user, isLoadingPermissions])

    const totalMyWeeks = getTotalWeeksSinceStart()
    const weeksToShow = useMemo(() => getLastNWeekIsos(Math.min(myReportsVisibleWeeks, totalMyWeeks)), [myReportsVisibleWeeks, totalMyWeeks])

    const myReportsByWeek = useMemo(() => {
        const grouped = {}
        weeksToShow.forEach(weekIso => {
            reportTypes.forEach(rt => {
                if (!user || !hasAssigned[rt.name]) return
                const monday = new Date(weekIso)
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
                if (!grouped[weekIso]) grouped[weekIso] = []
                grouped[weekIso].push({
                    ...rt,
                    weekIso,
                    range: ReportService.getWeekRangeString(dividerMonday, dividerSaturday),
                    completed: !!(existing && existing.completed),
                    report: existing || null
                })
            })
        })
        return grouped
    }, [weeksToShow, reportTypes, user, hasAssigned, localReports])

    const sortedMyWeeks = weeksToShow

    const reviewableReports = useMemo(() => (
        localReports
            .filter(r => r.completed && r.week && hasReviewPermission[r.name] && r.userId !== user?.id)
            .sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())
    ), [localReports, hasReviewPermission, user])

    const reviewReportsByWeek = useMemo(() => {
        const grouped = {}
        reviewableReports.forEach(report => {
            const weekIso = report.week ? new Date(report.week).toISOString().slice(0, 10) : ''
            if (!grouped[weekIso]) grouped[weekIso] = []
            grouped[weekIso].push(report)
        })
        return grouped
    }, [reviewableReports])

    const sortedReviewWeeks = useMemo(() => Object.keys(reviewReportsByWeek).sort((a, b) => new Date(b) - new Date(a)), [reviewReportsByWeek])

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
        const weekItems = myReportsByWeek[weekIso] || []
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
        const weekReports = reviewReportsByWeek[weekIso] || []
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
                                    {(isLoadingUser || isLoadingMy || isLoadingPermissions) && filteredMyWeeks.length === 0 ? (
                                        <div style={{padding: 24}}>
                                            <LoadingScreen message="Loading your reports..." inline/>
                                        </div>
                                    ) : (
                                        <>
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
                                                    {(myReportsVisibleWeeks < totalMyWeeks || myReportsVisibleWeeks > 2) && (
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
                                                            {myReportsVisibleWeeks < totalMyWeeks && (
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
                                        </>
                                    )}
                                </div>
                            )}
                            {tab === 'review' && (
                                <div className="reports-list">
                                    {(isLoadingUser || isLoadingPermissions || (isLoadingReview && filteredReviewWeeks.length === 0)) ? (
                                        <div style={{padding: 24}}>
                                            <LoadingScreen message="Loading reports to review..." inline/>
                                        </div>
                                    ) : (
                                        <>
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
                                                    {(reviewVisibleWeeks < totalMyWeeks || reviewVisibleWeeks > 2) && (
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
                                                            {reviewVisibleWeeks < totalMyWeeks && (
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
