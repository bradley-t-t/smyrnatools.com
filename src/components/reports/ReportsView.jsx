import React, {useEffect, useMemo, useState} from 'react'
import {reportTypeMap, reportTypes} from '../../config/types/ReportTypes'
import './styles/ReportsView.css'
import ReportsSubmitView from './ReportsSubmitView'
import ReportsReviewView from './ReportsReviewView'
import {supabase} from '../../services/DatabaseService'
import {UserService} from '../../services/UserService'
import {ReportService} from '../../services/ReportService'
import LoadingScreen from '../common/LoadingScreen'
import {usePreferences} from '../../app/context/PreferencesContext'
import {RegionService} from '../../services/RegionService'
import {ReportUtility} from '../../utils/ReportUtility'

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

    const {preferences} = usePreferences()
    const [regionPlantCodes, setRegionPlantCodes] = useState(null)
    const [reporterPlantMap, setReporterPlantMap] = useState({})
    const [loadingReporterPlants, setLoadingReporterPlants] = useState(false)

    const [overdueItems, setOverdueItems] = useState([])
    const [isLoadingOverdue, setIsLoadingOverdue] = useState(false)

    const [hasAnyReviewPermissionPrefix, setHasAnyReviewPermissionPrefix] = useState(false)

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
                setHasAnyReviewPermissionPrefix(false)
                setIsLoadingPermissions(false)
                return
            }
            const assigned = {}
            const review = {}
            await Promise.all(reportTypes.map(async rt => {
                const a = await UserService.hasAnyPermission(user.id, rt.assignment)
                assigned[rt.name] = !!a
                review[rt.name] = false
                const checks = await Promise.all(rt.review.map(perm => UserService.hasPermission(user.id, perm)))
                review[rt.name] = checks.some(Boolean)
            }))
            setHasAssigned(assigned)
            setHasReviewPermission(review)
            try {
                const permissions = await UserService.getUserPermissions(user.id)
                const anyReview = Array.isArray(permissions) && permissions.some(p => typeof p === 'string' && p.startsWith('reports.review.'))
                setHasAnyReviewPermissionPrefix(!!anyReview)
            } catch {
                setHasAnyReviewPermissionPrefix(false)
            }
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
        const initialMyWeeks = ReportUtility.getLastNWeekIsos(2, HARDCODED_TODAY)

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
        const desiredWeeks = new Set(ReportUtility.getLastNWeekIsos(reviewVisibleWeeks, HARDCODED_TODAY))
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
        const desiredWeeks = new Set(ReportUtility.getLastNWeekIsos(myReportsVisibleWeeks, HARDCODED_TODAY))
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

    useEffect(() => {
        const code = preferences.selectedRegion?.code || ''
        let cancelled = false

        async function loadRegionPlants() {
            if (!code) {
                setRegionPlantCodes(null)
                return
            }
            try {
                const list = await RegionService.fetchRegionPlants(code)
                if (cancelled) return
                const codes = new Set(list.map(p => p.plantCode))
                setRegionPlantCodes(codes)
                if (filterPlant && !codes.has(filterPlant)) setFilterPlant('')
            } catch {
                setRegionPlantCodes(new Set())
            }
        }

        loadRegionPlants()
        return () => {
            cancelled = true
        }
    }, [preferences.selectedRegion?.code])

    useEffect(() => {
        const idsFromReview = Array.from(new Set(localReports.filter(r => r.completed && r.userId && r.userId !== user?.id).map(r => r.userId)))
        const idsFromOverdue = Array.from(new Set((overdueItems || []).map(o => o.userId).filter(Boolean)))
        const ids = Array.from(new Set([...idsFromReview, ...idsFromOverdue]))
        const missing = ids.filter(id => !(id in reporterPlantMap))
        if (missing.length === 0) return
        let cancelled = false

        async function loadReporterPlants() {
            try {
                setLoadingReporterPlants(true)
                const entries = await Promise.all(missing.map(async id => {
                    try {
                        const plantCode = await UserService.getUserPlant(id)
                        return [id, plantCode || '']
                    } catch {
                        return [id, '']
                    }
                }))
                if (cancelled) return
                setReporterPlantMap(prev => {
                    const next = {...prev}
                    entries.forEach(([id, code]) => {
                        next[id] = code || ''
                    })
                    return next
                })
            } finally {
                if (!cancelled) setLoadingReporterPlants(false)
            }
        }

        loadReporterPlants()
        return () => {
            cancelled = true
        }
    }, [localReports, user, overdueItems])

    useEffect(() => {
        if (tab !== 'overdue' || isLoadingPermissions) return
        let cancelled = false

        async function loadOverdue() {
            setIsLoadingOverdue(true)
            try {
                const allowedReview = reportTypes.filter(rt => hasReviewPermission[rt.name]).map(rt => rt.name)
                const items = await ReportService.fetchOverdueAssignments(HARDCODED_TODAY, {force: true, allowedReview})
                if (!cancelled) setOverdueItems(items || [])
                const ids = Array.from(new Set((items || []).map(i => i.userId).filter(Boolean)))
                if (ids.length > 0) await fetchProfilesFor(ids)
            } catch (e) {
                if (!cancelled) setOverdueItems([])
            } finally {
                if (!cancelled) setIsLoadingOverdue(false)
            }
        }

        loadOverdue()
        return () => {
            cancelled = true
        }
    }, [tab, isLoadingPermissions, hasReviewPermission])

    useEffect(() => {
        if (tab === 'overdue' && !hasAnyReviewPermissionPrefix) setTab('all')
    }, [tab, hasAnyReviewPermissionPrefix])

    const totalMyWeeks = ReportUtility.getTotalWeeksSince(REPORTS_START_DATE, HARDCODED_TODAY)
    const weeksToShow = useMemo(() => ReportUtility.getLastNWeekIsos(Math.min(myReportsVisibleWeeks, totalMyWeeks), HARDCODED_TODAY), [myReportsVisibleWeeks, totalMyWeeks])

    const myReportsByWeek = useMemo(() => {
        const grouped = {}
        weeksToShow.forEach(weekIso => {
            reportTypes.forEach(rt => {
                if (!user || !hasAssigned[rt.name]) return
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

    const filteredMyWeeks = sortedMyWeeks
        .filter(weekIso => (myReportsByWeek[weekIso] || []).length > 0)
        .slice(0, myReportsVisibleWeeks)

    const filteredReviewWeeks = useMemo(() => sortedReviewWeeks.filter(weekIso => {
        const weekReports = reviewReportsByWeek[weekIso] || []
        return weekReports.some(report => {
            const reporterPlant = reporterPlantMap[report.userId] || ''
            const matchPlant = !filterPlant || reporterPlant === filterPlant
            const matchRegion = !preferences.selectedRegion?.code || !regionPlantCodes || regionPlantCodes.has(reporterPlant)
            return (!filterReportType || report.name === filterReportType) && matchPlant && matchRegion
        })
    }).slice(0, reviewVisibleWeeks), [sortedReviewWeeks, reportTypes, filterReportType, filterPlant, reviewVisibleWeeks, preferences.selectedRegion?.code, regionPlantCodes, reporterPlantMap])

    const filteredOverdueItems = useMemo(() => {
        return (overdueItems || []).filter(item => {
            const matchType = !filterReportType || item.report_name === filterReportType
            const reporterPlant = reporterPlantMap[item.userId] || ''
            const matchPlant = !filterPlant || reporterPlant === filterPlant
            const matchRegion = !preferences.selectedRegion?.code || !regionPlantCodes || regionPlantCodes.has(reporterPlant)
            return matchType && matchPlant && matchRegion
        })
    }, [overdueItems, filterReportType, filterPlant, preferences.selectedRegion?.code, regionPlantCodes, reporterPlantMap])

    const overdueByWeek = useMemo(() => {
        const grouped = {}
        filteredOverdueItems.forEach(item => {
            const key = item.week
            if (!grouped[key]) grouped[key] = []
            grouped[key].push(item)
        })
        return grouped
    }, [filteredOverdueItems])

    const sortedOverdueWeeks = useMemo(() => Object.keys(overdueByWeek).sort((a, b) => new Date(b) - new Date(a)), [overdueByWeek])

    const myCounts = useMemo(() => {
        const items = []
        weeksToShow.forEach(w => (myReportsByWeek[w] || []).forEach(i => items.push(i)))
        const completed = items.filter(i => i.completed).length
        const pending = items.filter(i => !i.completed).length
        return {total: items.length, completed, pending}
    }, [weeksToShow, myReportsByWeek])

    const reviewCount = reviewableReports.length
    const overdueCount = overdueItems.length

    return (
        <>
            <div className="rpts-root">
                {loadError && <div className="rpts-load-error">{loadError}</div>}
                {!showForm && !showReview && (
                    <>
                        <div className="rpts-toolbar">
                            <div className="rpts-toolbar-left">
                                <div className="rpts-toolbar-title">
                                    <i className="fas fa-file-alt"></i>
                                    <span>Reports</span>
                                </div>
                                {tab === 'all' && (
                                    <div className="rpts-metrics">
                                        <div className="rpts-metric">
                                            <div className="rpts-metric-value">{myCounts.completed}</div>
                                            <div className="rpts-metric-label">Completed</div>
                                        </div>
                                        <div className="rpts-metric">
                                            <div className="rpts-metric-value">{myCounts.pending}</div>
                                            <div className="rpts-metric-label">Pending</div>
                                        </div>
                                        <div className="rpts-metric">
                                            <div className="rpts-metric-value">{myCounts.total}</div>
                                            <div className="rpts-metric-label">Total</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="rpts-toolbar-right">
                                <div className="rpts-tabs">
                                    <button
                                        className={tab === 'all' ? 'active' : ''}
                                        onClick={() => setTab('all')}
                                        type="button"
                                    >
                                        My Reports {myCounts.pending > 0 && <span className="rpts-badge"
                                                                                  aria-label={`${myCounts.pending} pending`}>{myCounts.pending}</span>}
                                    </button>
                                    <button
                                        className={tab === 'review' ? 'active' : ''}
                                        onClick={() => setTab('review')}
                                        type="button"
                                    >
                                        Review {reviewCount > 0 && <span className="rpts-badge"
                                                                         aria-label={`${reviewCount} to review`}>{reviewCount}</span>}
                                    </button>
                                    {hasAnyReviewPermissionPrefix && (
                                        <button
                                            className={tab === 'overdue' ? 'active' : ''}
                                            onClick={() => setTab('overdue')}
                                            type="button"
                                        >
                                            Overdue {overdueCount > 0 && <span className="rpts-badge"
                                                                               aria-label={`${overdueCount} overdue`}>{overdueCount}</span>}
                                        </button>
                                    )}
                                </div>
                                {tab !== 'all' && (
                                    <div className="rpts-filters">
                                        <select
                                            value={filterReportType}
                                            onChange={e => setFilterReportType(e.target.value)}
                                            className="rpts-select-control"
                                        >
                                            <option value="">All Report Types</option>
                                            {reportTypes
                                                .filter(rt =>
                                                    (tab === 'review' && hasReviewPermission[rt.name]) ||
                                                    (tab === 'overdue' && hasReviewPermission[rt.name])
                                                )
                                                .map(rt => (
                                                    <option key={rt.name} value={rt.name}>{rt.title}</option>
                                                ))}
                                        </select>
                                        <select
                                            value={filterPlant}
                                            onChange={e => setFilterPlant(e.target.value)}
                                            className="rpts-select-control"
                                        >
                                            <option value="">All Plants</option>
                                            {plants
                                                .filter(p => !preferences.selectedRegion?.code || !regionPlantCodes || regionPlantCodes.has(p.plant_code))
                                                .map(p => (
                                                    <option key={p.plant_code}
                                                            value={p.plant_code}>{p.plant_name}</option>
                                                ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="rpts-content">
                            {tab === 'all' && (
                                <div className="rpts-list">
                                    {(isLoadingUser || isLoadingMy || isLoadingPermissions) && weeksToShow.length === 0 ? (
                                        <div className="rpts-loading">
                                            <LoadingScreen message="Loading your reports..." inline/>
                                        </div>
                                    ) : (
                                        <>
                                            {weeksToShow.length === 0 ? (
                                                <div className="rpts-empty">
                                                    <i className="fas fa-check-circle"></i>
                                                    <div>No reports</div>
                                                </div>
                                            ) : (
                                                <>
                                                    {filteredMyWeeks.map(weekIso => {
                                                        const weekItemsAll = (myReportsByWeek[weekIso] || [])
                                                        if (weekItemsAll.length === 0) return null
                                                        const {
                                                            monday: weekStart,
                                                            saturday: weekEnd
                                                        } = ReportUtility.getWeekDatesFromIso(weekIso)
                                                        const weekRange = ReportService.getWeekRangeString(weekStart, weekEnd)
                                                        const pmItem = weekItemsAll.find(i => i.name === 'plant_manager')
                                                        const peItem = weekItemsAll.find(i => i.name === 'plant_production')
                                                        const otherItems = weekItemsAll.filter(i => i.name !== 'plant_manager' && i.name !== 'plant_production')
                                                        return (
                                                            <div key={weekIso} className="rpts-week-group">
                                                                <div className="rpts-week-header"
                                                                     data-range={weekRange}>{weekRange}</div>
                                                                {(pmItem || peItem) && (
                                                                    <div className="rpts-pair">
                                                                        <div className="rpts-pair-header">
                                                                            <div>{[pmItem?.title, peItem?.title].filter(Boolean).join(' & ')}</div>
                                                                            <div className="rpts-pair-meta">Week
                                                                                of {weekStart.toLocaleDateString()}</div>
                                                                        </div>
                                                                        <div
                                                                            className={`rpts-pair-cols ${(pmItem && peItem) ? '' : 'single'}`}>
                                                                            {pmItem && (() => {
                                                                                const today = new Date()
                                                                                const hasSavedData = !!(pmItem.report && pmItem.report.data)
                                                                                const {
                                                                                    statusText,
                                                                                    statusClass,
                                                                                    buttonLabel
                                                                                } = ReportUtility.computeMyReportStatus({
                                                                                    completed: pmItem.completed,
                                                                                    hasSavedData,
                                                                                    weekIso: pmItem.weekIso,
                                                                                    today
                                                                                })
                                                                                return (
                                                                                    <div className="rpts-pair-tile">
                                                                                        <div
                                                                                            className="rpts-pair-title">
                                                                                            <i className="fas fa-user-tie"></i>
                                                                                            <span>{pmItem.title}</span>
                                                                                            <span
                                                                                                className={`rpts-status ${statusClass}`}>{statusText}</span>
                                                                                        </div>
                                                                                        <div
                                                                                            className="rpts-pair-actions">
                                                                                            <button
                                                                                                className="rpts-list-action"
                                                                                                onClick={() => handleShowForm(pmItem)}>{buttonLabel}</button>
                                                                                        </div>
                                                                                    </div>
                                                                                )
                                                                            })()}
                                                                            {peItem && (() => {
                                                                                const today = new Date()
                                                                                const hasSavedData = !!(peItem.report && peItem.report.data)
                                                                                const {
                                                                                    statusText,
                                                                                    statusClass,
                                                                                    buttonLabel
                                                                                } = ReportUtility.computeMyReportStatus({
                                                                                    completed: peItem.completed,
                                                                                    hasSavedData,
                                                                                    weekIso: peItem.weekIso,
                                                                                    today
                                                                                })
                                                                                return (
                                                                                    <div className="rpts-pair-tile">
                                                                                        <div
                                                                                            className="rpts-pair-title">
                                                                                            <i className="fas fa-industry"></i>
                                                                                            <span>{peItem.title}</span>
                                                                                            <span
                                                                                                className={`rpts-status ${statusClass}`}>{statusText}</span>
                                                                                        </div>
                                                                                        <div
                                                                                            className="rpts-pair-actions">
                                                                                            <button
                                                                                                className="rpts-list-action"
                                                                                                onClick={() => handleShowForm(peItem)}>{buttonLabel}</button>
                                                                                        </div>
                                                                                    </div>
                                                                                )
                                                                            })()}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {otherItems.length > 0 && (
                                                                    <div className="rpts-pair">
                                                                        <div className="rpts-pair-header">
                                                                            <div>{otherItems.map(i => i.title).join(' & ')}</div>
                                                                            <div className="rpts-pair-meta">Week
                                                                                of {weekStart.toLocaleDateString()}</div>
                                                                        </div>
                                                                        <div
                                                                            className={`rpts-pair-cols ${otherItems.length === 1 ? 'single' : ''}`}>
                                                                            {otherItems.map(item => {
                                                                                const today = new Date()
                                                                                const hasSavedData = !!(item.report && item.report.data)
                                                                                const {
                                                                                    statusText,
                                                                                    statusClass,
                                                                                    buttonLabel
                                                                                } = ReportUtility.computeMyReportStatus({
                                                                                    completed: item.completed,
                                                                                    hasSavedData,
                                                                                    weekIso: item.weekIso,
                                                                                    today
                                                                                })
                                                                                return (
                                                                                    <div className="rpts-pair-tile"
                                                                                         key={item.name + item.weekIso}>
                                                                                        <div
                                                                                            className="rpts-pair-title">
                                                                                            <i className="fas fa-file-alt"></i>
                                                                                            <span>{item.title}</span>
                                                                                            <span
                                                                                                className={`rpts-status ${statusClass}`}>{statusText}</span>
                                                                                        </div>
                                                                                        <div
                                                                                            className="rpts-pair-actions">
                                                                                            <button
                                                                                                className="rpts-list-action"
                                                                                                onClick={() => handleShowForm(item)}>
                                                                                                {buttonLabel}
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                    {(myReportsVisibleWeeks < totalMyWeeks || myReportsVisibleWeeks > 2) && (
                                                        <div className="rpts-cta-row">
                                                            {myReportsVisibleWeeks < totalMyWeeks && (
                                                                <button
                                                                    type="button"
                                                                    className="rpts-cta-primary"
                                                                    onClick={() => setMyReportsVisibleWeeks(w => w + 2)}
                                                                >
                                                                    Show More
                                                                </button>
                                                            )}
                                                            {myReportsVisibleWeeks > 2 && (
                                                                <button
                                                                    type="button"
                                                                    className="rpts-cta-secondary"
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
                                <div className="rpts-list">
                                    {(isLoadingUser || isLoadingPermissions || loadingReporterPlants || (isLoadingReview && filteredReviewWeeks.length === 0)) ? (
                                        <div className="rpts-loading">
                                            <LoadingScreen message="Loading reports to review..." inline/>
                                        </div>
                                    ) : (
                                        <>
                                            {filteredReviewWeeks.length === 0 ? (
                                                <div className="rpts-empty">
                                                    <i className="fas fa-user-check"></i>
                                                    <div>No reports to review</div>
                                                </div>
                                            ) : (
                                                <>
                                                    {filteredReviewWeeks.map(weekIso => {
                                                        const weekReportsAll = (reviewReportsByWeek[weekIso] || []).filter(report => {
                                                            const reporterPlant = reporterPlantMap[report.userId] || ''
                                                            const matchPlant = !filterPlant || reporterPlant === filterPlant
                                                            const matchRegion = !preferences.selectedRegion?.code || !regionPlantCodes || regionPlantCodes.has(reporterPlant)
                                                            return (!filterReportType || report.name === filterReportType) && matchPlant && matchRegion
                                                        })
                                                        if (weekReportsAll.length === 0) return null
                                                        const {
                                                            monday: weekStart,
                                                            saturday: weekEnd
                                                        } = ReportUtility.getWeekDatesFromIso(weekIso)
                                                        const weekRange = ReportService.getWeekRangeString(weekStart, weekEnd)
                                                        const byUser = new Map()
                                                        weekReportsAll.forEach(r => {
                                                            const list = byUser.get(r.userId) || []
                                                            list.push(r)
                                                            byUser.set(r.userId, list)
                                                        })
                                                        const pairs = []
                                                        const singles = []
                                                        byUser.forEach(list => {
                                                            const pm = list.find(r => r.name === 'plant_manager')
                                                            const pe = list.find(r => r.name === 'plant_production')
                                                            if (pm || pe) pairs.push({pm, pe})
                                                            const remaining = list.filter(r => r.name !== 'plant_manager' && r.name !== 'plant_production')
                                                            remaining.forEach(r => singles.push(r))
                                                        })
                                                        return (
                                                            <div key={weekIso} className="rpts-week-group">
                                                                <div className="rpts-week-header"
                                                                     data-range={weekRange}>{weekRange}</div>
                                                                {pairs.map((pair, idx) => (
                                                                    <div className="rpts-pair"
                                                                         key={`pair-${weekIso}-${idx}`}>
                                                                        <div className="rpts-pair-header">
                                                                            <div>{[pair.pm?.title, pair.pe?.title].filter(Boolean).join(' & ')}</div>
                                                                            <div className="rpts-pair-meta">Completed
                                                                                By {getUserName((pair.pm || pair.pe).userId)}</div>
                                                                        </div>
                                                                        <div
                                                                            className={`rpts-pair-cols ${(pair.pm && pair.pe) ? '' : 'single'}`}>
                                                                            {pair.pm && (
                                                                                <div className="rpts-pair-tile">
                                                                                    <div className="rpts-pair-title">
                                                                                        <i className="fas fa-user-tie"></i>
                                                                                        <span>{pair.pm.title}</span>
                                                                                    </div>
                                                                                    <div className="rpts-pair-actions">
                                                                                        <button
                                                                                            className="rpts-list-action"
                                                                                            onClick={() => handleReview(pair.pm)}>Review
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {pair.pe && (
                                                                                <div className="rpts-pair-tile">
                                                                                    <div className="rpts-pair-title">
                                                                                        <i className="fas fa-industry"></i>
                                                                                        <span>{pair.pe.title}</span>
                                                                                    </div>
                                                                                    <div className="rpts-pair-actions">
                                                                                        <button
                                                                                            className="rpts-list-action"
                                                                                            onClick={() => handleReview(pair.pe)}>Review
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {singles.length > 0 && (
                                                                    <div className="rpts-pair">
                                                                        <div className="rpts-pair-header">
                                                                            <div>{Array.from(new Set(singles.map(r => r.title))).join(' & ')}</div>
                                                                            <div className="rpts-pair-meta">Week
                                                                                of {weekStart.toLocaleDateString()}</div>
                                                                        </div>
                                                                        <div
                                                                            className={`rpts-pair-cols ${singles.length === 1 ? 'single' : ''}`}>
                                                                            {singles.map(report => (
                                                                                <div className="rpts-pair-tile"
                                                                                     key={report.id}>
                                                                                    <div className="rpts-pair-title">
                                                                                        <i className="fas fa-file-alt"></i>
                                                                                        <span>{report.title}</span>
                                                                                        <span
                                                                                            className="rpts-pair-meta">Completed By: {getUserName(report.userId)}</span>
                                                                                    </div>
                                                                                    <div className="rpts-pair-actions">
                                                                                        <button
                                                                                            className="rpts-list-action"
                                                                                            onClick={() => handleReview(report)}>Review
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                    {(reviewVisibleWeeks < totalMyWeeks || reviewVisibleWeeks > 2) && (
                                                        <div className="rpts-cta-row">
                                                            {reviewVisibleWeeks < totalMyWeeks && (
                                                                <button
                                                                    type="button"
                                                                    className="rpts-cta-primary"
                                                                    onClick={() => setReviewVisibleWeeks(w => w + 2)}
                                                                >
                                                                    Show More
                                                                </button>
                                                            )}
                                                            {reviewVisibleWeeks > 2 && (
                                                                <button
                                                                    type="button"
                                                                    className="rpts-cta-secondary"
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
                            {tab === 'overdue' && (
                                <div className="rpts-list">
                                    {(isLoadingUser || isLoadingPermissions || isLoadingOverdue || loadingReporterPlants) ? (
                                        <div className="rpts-loading">
                                            <LoadingScreen message="Loading overdue reports..." inline/>
                                        </div>
                                    ) : (
                                        <>
                                            {filteredOverdueItems.length === 0 ? (
                                                <div className="rpts-empty">
                                                    <i className="fas fa-exclamation-circle"></i>
                                                    <div>No overdue reports</div>
                                                </div>
                                            ) : (
                                                <>
                                                    {sortedOverdueWeeks.map(weekIso => {
                                                        const itemsAll = overdueByWeek[weekIso] || []
                                                        if (itemsAll.length === 0) return null
                                                        const {
                                                            monday: weekStart,
                                                            saturday: weekEnd
                                                        } = ReportUtility.getWeekDatesFromIso(weekIso)
                                                        const weekRange = ReportService.getWeekRangeString(weekStart, weekEnd)
                                                        const byUser = new Map()
                                                        itemsAll.forEach(i => {
                                                            const list = byUser.get(i.userId) || []
                                                            list.push(i)
                                                            byUser.set(i.userId, list)
                                                        })
                                                        const pairs = []
                                                        const singles = []
                                                        byUser.forEach(list => {
                                                            const pm = list.find(r => r.report_name === 'plant_manager')
                                                            const pe = list.find(r => r.report_name === 'plant_production')
                                                            if (pm || pe) pairs.push({pm, pe})
                                                            const remaining = list.filter(r => r.report_name !== 'plant_manager' && r.report_name !== 'plant_production')
                                                            remaining.forEach(r => singles.push(r))
                                                        })
                                                        return (
                                                            <div key={weekIso} className="rpts-week-group">
                                                                <div className="rpts-week-header"
                                                                     data-range={weekRange}>{weekRange}</div>
                                                                {pairs.map((pair, idx) => (
                                                                    <div className="rpts-pair"
                                                                         key={`od-pair-${weekIso}-${idx}`}>
                                                                        <div className="rpts-pair-header">
                                                                            <div>{[pair.pm ? (reportTypeMap[pair.pm.report_name]?.title || pair.pm.report_name) : null, pair.pe ? (reportTypeMap[pair.pe.report_name]?.title || pair.pe.report_name) : null].filter(Boolean).join(' & ')}</div>
                                                                            <div className="rpts-pair-meta">Owed
                                                                                By {(pair.pm || pair.pe) ? `${(pair.pm?.first_name || pair.pe?.first_name || '')} ${(pair.pm?.last_name || pair.pe?.last_name || '')}`.trim() : ''}</div>
                                                                        </div>
                                                                        <div
                                                                            className={`rpts-pair-cols ${(pair.pm && pair.pe) ? '' : 'single'}`}>
                                                                            {pair.pm && (
                                                                                <div className="rpts-pair-tile">
                                                                                    <div className="rpts-pair-title">
                                                                                        <i className="fas fa-user-tie"></i>
                                                                                        <span>{(reportTypeMap[pair.pm.report_name] || {}).title || pair.pm.report_name}</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {pair.pe && (
                                                                                <div className="rpts-pair-tile">
                                                                                    <div className="rpts-pair-title">
                                                                                        <i className="fas fa-industry"></i>
                                                                                        <span>{(reportTypeMap[pair.pe.report_name] || {}).title || pair.pe.report_name}</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {singles.length > 0 && (
                                                                    <div className="rpts-pair">
                                                                        <div className="rpts-pair-header">
                                                                            <div>{Array.from(new Set(singles.map(item => (reportTypeMap[item.report_name]?.title || item.report_name)))).join(' & ')}</div>
                                                                            <div className="rpts-pair-meta">Week
                                                                                of {weekStart.toLocaleDateString()}</div>
                                                                        </div>
                                                                        <div
                                                                            className={`rpts-pair-cols ${singles.length === 1 ? 'single' : ''}`}>
                                                                            {singles
                                                                                .sort((a, b) => a.report_name.localeCompare(b.report_name))
                                                                                .map((item, idx) => (
                                                                                    <div className="rpts-pair-tile"
                                                                                         key={`${item.userId}-${item.report_name}-${item.week}-${idx}`}>
                                                                                        <div
                                                                                            className="rpts-pair-title">
                                                                                            <i className="fas fa-file-alt"></i>
                                                                                            <span>{(reportTypeMap[item.report_name] || {}).title || item.report_name}</span>
                                                                                            <span
                                                                                                className="rpts-pair-meta">Owed By: {(item.first_name || '') + ' ' + (item.last_name || '')}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
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
                        report={reportTypeMap[showForm.name] ? {
                            ...reportTypeMap[showForm.name],
                            weekIso: showForm.weekIso
                        } : showForm}
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
            <div className="rpts-footer">
                Weekly Reports are due Saturday by end of day.
            </div>
        </>
    )
}

export default ReportsView
