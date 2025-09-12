import React, {useEffect, useMemo, useState} from 'react'
import './styles/DashboardView.css'
import {usePreferences} from '../../app/context/PreferencesContext'
import {RegionService} from '../../services/RegionService'
import {MixerService} from '../../services/MixerService'
import {TractorService} from '../../services/TractorService'
import TrailerService from '../../services/TrailerService'
import {EquipmentService} from '../../services/EquipmentService'
import {PickupTruckService} from '../../services/PickupTruckService'
import {OperatorService} from '../../services/OperatorService'
import {ReportService} from '../../services/ReportService'
import {supabase} from '../../services/DatabaseService'
import VerifiedUtility from '../../utils/VerifiedUtility'

export default function DashboardView() {
    const {preferences, setSelectedRegion} = usePreferences()
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState('')
    const [regions, setRegions] = useState([])
    const [regionPlants, setRegionPlants] = useState([])
    const [allPlantsCount, setAllPlantsCount] = useState(0)
    const [selectedPlant, setSelectedPlant] = useState('')
    const [mixers, setMixers] = useState([])
    const [tractors, setTractors] = useState([])
    const [trailers, setTrailers] = useState([])
    const [equipment, setEquipment] = useState([])
    const [pickups, setPickups] = useState([])
    const [operators, setOperators] = useState([])
    const [managersCount, setManagersCount] = useState(0)
    const [uncompletedListCount, setUncompletedListCount] = useState(0)
    const [overdueListCount, setOverdueListCount] = useState(0)
    const [reportsCompletedCount, setReportsCompletedCount] = useState(0)
    const [reportsPastDueCount, setReportsPastDueCount] = useState(0)
    const [reportsWeekLabel, setReportsWeekLabel] = useState('')
    const [mixersIssuesTotal, setMixersIssuesTotal] = useState(0)
    const [mixersCommentsTotal, setMixersCommentsTotal] = useState(0)
    const [tractorsIssuesTotal, setTractorsIssuesTotal] = useState(0)
    const [tractorsCommentsTotal, setTractorsCommentsTotal] = useState(0)
    const [trailersIssuesTotal, setTrailersIssuesTotal] = useState(0)
    const [trailersCommentsTotal, setTrailersCommentsTotal] = useState(0)
    const [equipmentIssuesTotal, setEquipmentIssuesTotal] = useState(0)
    const [equipmentCommentsTotal, setEquipmentCommentsTotal] = useState(0)
    const [refreshKey, setRefreshKey] = useState(0)
    const [lastUpdated, setLastUpdated] = useState(null)

    const regionCode = preferences.selectedRegion?.code || ''
    const regionName = preferences.selectedRegion?.name || ''

    useEffect(() => {
        let cancelled = false
        let intervalId
        async function init() {
            const isInitial = !lastUpdated
            if (isInitial) setLoading(true)
            else setRefreshing(true)
            setError('')
            try {
                const [allRegions, plantsForRegion, allPlants] = await Promise.all([
                    RegionService.fetchRegions().catch(() => []),
                    regionCode ? RegionService.fetchRegionPlants(regionCode).catch(() => []) : Promise.resolve([]),
                    ReportService.fetchPlantsSorted().catch(() => [])
                ])
                if (cancelled) return
                setRegions(allRegions)
                setRegionPlants(plantsForRegion)
                setAllPlantsCount(Array.isArray(allPlants) ? allPlants.length : 0)
                const basePlantCodes = new Set((plantsForRegion || []).map(p => String(p.plantCode || '').trim()).filter(Boolean))
                const effectivePlantCodes = selectedPlant ? new Set([String(selectedPlant).trim()]) : basePlantCodes
                const [mix, trac, trail, equip, pick, ops] = await Promise.all([
                    MixerService.getAllMixers().catch(() => []),
                    TractorService.getAllTractors().catch(() => []),
                    TrailerService.fetchTrailers().catch(() => []),
                    EquipmentService.getAllEquipments().catch(() => []),
                    PickupTruckService.getAll().catch(() => []),
                    OperatorService.getAllOperators().catch(() => [])
                ])
                if (cancelled) return
                const filterByPlants = arr => {
                    if (!effectivePlantCodes || effectivePlantCodes.size === 0) return arr || []
                    return (arr || []).filter(a => {
                        const code = a.assignedPlant || a.plantCode || ''
                        return code && effectivePlantCodes.has(String(code).trim())
                    })
                }
                const fMix = filterByPlants(mix)
                const fTrac = filterByPlants(trac)
                const fTrail = filterByPlants(trail)
                const fEquip = filterByPlants(equip)
                const fPick = filterByPlants(pick)
                const fOps = (ops || []).filter(o => {
                    if (!effectivePlantCodes || effectivePlantCodes.size === 0) return true
                    const code = o.plantCode || ''
                    return code && effectivePlantCodes.has(String(code).trim())
                })
                setMixers(fMix)
                setTractors(fTrac)
                setTrailers(fTrail)
                setEquipment(fEquip)
                setPickups(fPick)
                setOperators(fOps)
                let mgrCount
                try {
                    const [{data: permissions}, {data: roles}, {data: profiles}] = await Promise.all([
                        supabase.from('users_permissions').select('user_id, role_id'),
                        supabase.from('users_roles').select('id, name'),
                        supabase.from('users_profiles').select('id, plant_code')
                    ])
                    const managerRoleIds = new Set((roles || []).filter(r => String(r.name || '').toLowerCase().includes('manager')).map(r => r.id))
                    const userIdsWithManagerRole = new Set((permissions || []).filter(p => managerRoleIds.has(p.role_id)).map(p => p.user_id))
                    const plantCodesSet = (effectivePlantCodes && effectivePlantCodes.size > 0) ? effectivePlantCodes : null
                    mgrCount = (profiles || []).filter(pr => userIdsWithManagerRole.has(pr.id) && (!plantCodesSet || plantCodesSet.has(String(pr.plant_code || '').trim()))).length
                } catch { mgrCount = 0 }
                setManagersCount(mgrCount)
                try {
                    const listBase = supabase.from('list_items')
                    let uncompletedQuery = listBase.select('id,deadline', {count: 'exact'}).eq('completed', false)
                    let overdueQuery = listBase.select('id', {count: 'exact'}).eq('completed', false)
                    if (effectivePlantCodes && effectivePlantCodes.size > 0) {
                        const codes = Array.from(effectivePlantCodes)
                        uncompletedQuery = uncompletedQuery.in('plant_code', codes)
                        overdueQuery = overdueQuery.in('plant_code', codes)
                    }
                    const nowIso = new Date().toISOString()
                    overdueQuery = overdueQuery.lt('deadline', nowIso)
                    const [uncompletedRes, overdueRes] = await Promise.all([uncompletedQuery, overdueQuery])
                    setUncompletedListCount(uncompletedRes?.count || 0)
                    setOverdueListCount(overdueRes?.count || 0)
                } catch {
                    setUncompletedListCount(0)
                    setOverdueListCount(0)
                }
                try {
                    const {monday: currMon} = ReportService.getMondayAndSaturday(new Date())
                    const prevMonday = new Date(currMon)
                    prevMonday.setDate(prevMonday.getDate() - 7)
                    const prevSaturday = new Date(prevMonday)
                    prevSaturday.setDate(prevMonday.getDate() + 5)
                    setReportsWeekLabel(ReportService.getWeekRangeString(prevMonday, prevSaturday))
                    const prevMonStr = prevMonday.toISOString().slice(0, 10)
                    const prevSatStr = prevSaturday.toISOString().slice(0, 10)
                    let userIds = null
                    if (effectivePlantCodes && effectivePlantCodes.size > 0) {
                        const {data: profiles} = await supabase.from('users_profiles').select('id, plant_code')
                        const codes = Array.from(effectivePlantCodes)
                        userIds = (profiles || []).filter(pr => pr.plant_code && codes.includes(String(pr.plant_code).trim())).map(pr => pr.id)
                    }
                    let reportsCompleted = supabase
                        .from('reports')
                        .select('id', {count: 'exact'})
                        .eq('completed', true)
                        .gte('week', prevMonStr)
                        .lte('week', prevSatStr)
                    let reportsPastDue = supabase
                        .from('reports')
                        .select('id', {count: 'exact'})
                        .eq('completed', false)
                        .gte('week', prevMonStr)
                        .lte('week', prevSatStr)
                    if (userIds && userIds.length > 0) {
                        reportsCompleted = reportsCompleted.in('user_id', userIds)
                        reportsPastDue = reportsPastDue.in('user_id', userIds)
                    }
                    const [completedQuery, pastDueQuery] = await Promise.all([reportsCompleted, reportsPastDue])
                    setReportsCompletedCount(completedQuery?.count || 0)
                    setReportsPastDueCount(pastDueQuery?.count || 0)
                } catch {
                    setReportsCompletedCount(0)
                    setReportsPastDueCount(0)
                    setReportsWeekLabel('')
                }
                try {
                    const mixerIds = (fMix || []).map(m => m.id).filter(Boolean)
                    const tractorIds = (fTrac || []).map(t => t.id).filter(Boolean)
                    const trailerIds = (fTrail || []).map(t => t.id).filter(Boolean)
                    const equipmentIds = (fEquip || []).map(e => e.id).filter(Boolean)
                    if (mixerIds.length > 0) {
                        const [issuesRes, commentsRes] = await Promise.all([
                            supabase.from('mixers_maintenance').select('id', {count: 'exact'}).in('mixer_id', mixerIds).is('time_completed', null),
                            supabase.from('mixers_comments').select('id', {count: 'exact'}).in('mixer_id', mixerIds)
                        ])
                        setMixersIssuesTotal(issuesRes?.count || 0)
                        setMixersCommentsTotal(commentsRes?.count || 0)
                    } else {
                        setMixersIssuesTotal(0)
                        setMixersCommentsTotal(0)
                    }
                    if (tractorIds.length > 0) {
                        const [tIssues, tComments] = await Promise.all([
                            supabase.from('tractors_maintenance').select('id', {count: 'exact'}).in('tractor_id', tractorIds).is('time_completed', null),
                            supabase.from('tractors_comments').select('id', {count: 'exact'}).in('tractor_id', tractorIds)
                        ])
                        setTractorsIssuesTotal(tIssues?.count || 0)
                        setTractorsCommentsTotal(tComments?.count || 0)
                    } else {
                        setTractorsIssuesTotal(0)
                        setTractorsCommentsTotal(0)
                    }
                    if (trailerIds.length > 0) {
                        const [rIssues, rComments] = await Promise.all([
                            supabase.from('trailers_maintenance').select('id', {count: 'exact'}).in('trailer_id', trailerIds).is('time_completed', null),
                            supabase.from('trailers_comments').select('id', {count: 'exact'}).in('trailer_id', trailerIds)
                        ])
                        setTrailersIssuesTotal(rIssues?.count || 0)
                        setTrailersCommentsTotal(rComments?.count || 0)
                    } else {
                        setTrailersIssuesTotal(0)
                        setTrailersCommentsTotal(0)
                    }
                    if (equipmentIds.length > 0) {
                        const [eIssues, eComments] = await Promise.all([
                            supabase.from('heavy_equipment_maintenance').select('id', {count: 'exact'}).in('equipment_id', equipmentIds).is('time_completed', null),
                            supabase.from('heavy_equipment_comments').select('id', {count: 'exact'}).in('equipment_id', equipmentIds)
                        ])
                        setEquipmentIssuesTotal(eIssues?.count || 0)
                        setEquipmentCommentsTotal(eComments?.count || 0)
                    } else {
                        setEquipmentIssuesTotal(0)
                        setEquipmentCommentsTotal(0)
                    }
                } catch {
                    setMixersIssuesTotal(0)
                    setMixersCommentsTotal(0)
                    setTractorsIssuesTotal(0)
                    setTractorsCommentsTotal(0)
                    setTrailersIssuesTotal(0)
                    setTrailersCommentsTotal(0)
                    setEquipmentIssuesTotal(0)
                    setEquipmentCommentsTotal(0)
                }
                setLastUpdated(new Date())
            } catch (e) {
                setError('Failed to load dashboard data')
            } finally {
                if (!cancelled) {
                    setLoading(false)
                    setRefreshing(false)
                }
            }
        }
        init()
        intervalId = setInterval(() => {
            setRefreshKey(v => v + 1)
        }, 600000)
        return () => {
            cancelled = true
            if (intervalId) clearInterval(intervalId)
        }
    }, [regionCode, selectedPlant, refreshKey])

    const activeMixers = useMemo(() => mixers.filter(m => m.status === 'Active'), [mixers])
    const shopMixers = useMemo(() => mixers.filter(m => m.status === 'In Shop'), [mixers])

    const activeTractors = useMemo(() => tractors.filter(t => t.status === 'Active'), [tractors])
    const shopTractors = useMemo(() => tractors.filter(t => t.status === 'In Shop'), [tractors])

    const activeTrailers = useMemo(() => trailers.filter(t => t.status === 'Active'), [trailers])
    const shopTrailers = useMemo(() => trailers.filter(t => t.status === 'In Shop'), [trailers])

    const activeEquipment = useMemo(() => equipment.filter(e => e.status === 'Active'), [equipment])
    const shopEquipment = useMemo(() => equipment.filter(e => e.status === 'In Shop'), [equipment])

    const activePickups = useMemo(() => pickups.filter(p => p.status === 'Active'), [pickups])

    const assignedOperatorIds = useMemo(() => new Set(activeMixers.map(m => m.assignedOperator).filter(Boolean)), [activeMixers])
    const activeOperators = useMemo(() => operators.filter(o => o.status === 'Active'), [operators])
    const assignedOperators = useMemo(() => activeOperators.filter(o => assignedOperatorIds.has(o.employeeId)), [activeOperators, assignedOperatorIds])
    const unassignedActiveOperators = useMemo(() => Math.max(0, activeOperators.length - assignedOperators.length), [activeOperators, assignedOperators])

    const daysSince = d => d ? Math.ceil((Date.now() - new Date(d).getTime()) / 86400000) : null

    const overdueDays = 90
    const isServiceOverdue = d => {
        if (!d) return true
        const diff = daysSince(d)
        return typeof diff === 'number' ? diff > overdueDays : true
    }

    const countOverdue = arr => (arr || []).reduce((s, x) => s + (isServiceOverdue(x.lastServiceDate) ? 1 : 0), 0)

    const verifiedFor = arr => {
        const total = arr.length
        if (!total) return {count: 0, percent: 0}
        const verifiedCount = arr.filter(a => VerifiedUtility.isVerified(a.updatedLast, a.updatedAt, a.updatedBy)).length
        return {count: verifiedCount, percent: Math.round((verifiedCount / total) * 100)}
    }

    const mixersVerified = useMemo(() => verifiedFor(mixers), [mixers])
    const tractorsVerified = useMemo(() => verifiedFor(tractors), [tractors])

    const mixersOverdue = useMemo(() => countOverdue(mixers), [mixers])
    const tractorsOverdue = useMemo(() => countOverdue(tractors), [tractors])
    const trailersOverdue = useMemo(() => countOverdue(trailers), [trailers])
    const equipmentOverdue = useMemo(() => countOverdue(equipment), [equipment])

    const plantCount = selectedPlant ? 1 : (regionCode ? regionPlants.length : allPlantsCount)

    const onRegionChange = e => {
        const code = e.target.value
        const r = regions.find(x => x.regionCode === code)
        if (r) setSelectedRegion(r.regionCode, r.regionName)
        else setSelectedRegion('', '')
        setSelectedPlant('')
    }

    const onPlantChange = e => {
        setSelectedPlant(e.target.value)
    }

    const onRetry = () => setRefreshKey(v => v + 1)
    const onRefresh = () => setRefreshKey(v => v + 1)

    const timeAgo = d => {
        if (!d) return ''
        const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
        if (diff < 60) return 'just now'
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
        return `${Math.floor(diff / 86400)}d ago`
    }

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h1>Dashboard</h1>
                <div className="dashboard-actions">
                    <div className="toolbar-group">
                        <select className="ios-select" value={regionCode} onChange={onRegionChange} aria-label="Region">
                            <option value="">All Regions</option>
                            {regions.map(r => (
                                <option key={r.regionCode} value={r.regionCode}>{r.regionName} ({r.regionCode})</option>
                            ))}
                        </select>
                        {regionCode ? (
                            <select className="ios-select" value={selectedPlant} onChange={onPlantChange} aria-label="Plant">
                                <option value="">All Plants</option>
                                {regionPlants.map(p => {
                                    const code = p.plantCode
                                    const name = p.plantName || code
                                    return <option key={code} value={code}>{name} ({code})</option>
                                })}
                            </select>
                        ) : null}
                    </div>
                    <div className="toolbar-group">
                        <div className="updated-at"><span className="live-dot"></span><span>{lastUpdated ? `Updated ${timeAgo(lastUpdated)}` : 'Never updated'}</span></div>
                        <button className="btn ghost" onClick={onRefresh} aria-label="Refresh" disabled={refreshing}>
                            {refreshing ? <span className="mini-loader"/> : null}
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>
            </div>
            {error && (
                <div className="error-banner" role="alert">
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                        <span>{error}</span>
                        <button className="btn danger ghost" onClick={onRetry}>Retry</button>
                    </div>
                </div>
            )}
            <div className="content-container">
                {loading ? (
                    <div className="loading-container"><div className="loader"/></div>
                ) : (
                    <div className="dashboard-grid">
                        <div className="kpi-card">
                            <div className="kpi-title">Region</div>
                            <div className="kpi-value">{regionCode ? `${regionName || regionCode}` : 'All Regions'}</div>
                            <div className="kpi-sub">Plants {plantCount}{selectedPlant ? ` • Plant ${selectedPlant}` : ''}</div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-title">Mixers</div>
                            <div className="kpi-value">{mixers.length}</div>
                            <div className="kpi-row">
                                <div className="kpi-pill">Active {activeMixers.length}</div>
                                <div className="kpi-pill">In Shop {shopMixers.length}</div>
                            </div>
                            <div className="kpi-row">
                                <div className="kpi-pill">Verified {mixersVerified.percent}% ({mixersVerified.count}/{mixers.length})</div>
                                <div className="kpi-pill">Needing Service {mixersOverdue}</div>
                                <div className="kpi-pill">Open Issues {mixersIssuesTotal}</div>
                                <div className="kpi-pill">Comments {mixersCommentsTotal}</div>
                            </div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-title">Tractors</div>
                            <div className="kpi-value">{tractors.length}</div>
                            <div className="kpi-row">
                                <div className="kpi-pill">Active {activeTractors.length}</div>
                                <div className="kpi-pill">In Shop {shopTractors.length}</div>
                            </div>
                            <div className="kpi-row">
                                <div className="kpi-pill">Verified {tractorsVerified.percent}% ({tractorsVerified.count}/{tractors.length})</div>
                                <div className="kpi-pill">Needing Service {tractorsOverdue}</div>
                                <div className="kpi-pill">Open Issues {tractorsIssuesTotal}</div>
                                <div className="kpi-pill">Comments {tractorsCommentsTotal}</div>
                            </div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-title">Trailers</div>
                            <div className="kpi-value">{trailers.length}</div>
                            <div className="kpi-row">
                                <div className="kpi-pill">Active {activeTrailers.length}</div>
                                <div className="kpi-pill">In Shop {shopTrailers.length}</div>
                            </div>
                            <div className="kpi-row">
                                <div className="kpi-pill">Needing Service {trailersOverdue}</div>
                                <div className="kpi-pill">Open Issues {trailersIssuesTotal}</div>
                                <div className="kpi-pill">Comments {trailersCommentsTotal}</div>
                            </div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-title">Equipment</div>
                            <div className="kpi-value">{equipment.length}</div>
                            <div className="kpi-row">
                                <div className="kpi-pill">Active {activeEquipment.length}</div>
                                <div className="kpi-pill">In Shop {shopEquipment.length}</div>
                            </div>
                            <div className="kpi-row">
                                <div className="kpi-pill">Needing Service {equipmentOverdue}</div>
                                <div className="kpi-pill">Open Issues {equipmentIssuesTotal}</div>
                                <div className="kpi-pill">Comments {equipmentCommentsTotal}</div>
                            </div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-title">Pickup Trucks</div>
                            <div className="kpi-value">{pickups.length}</div>
                            <div className="kpi-row">
                                <div className="kpi-pill">Active {activePickups.length}</div>
                            </div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-title">Operators</div>
                            <div className="kpi-value">{operators.length}</div>
                            <div className="kpi-row">
                                <div className="kpi-pill">Active {activeOperators.length}</div>
                                <div className="kpi-pill">Assigned {assignedOperators.length}</div>
                                <div className="kpi-pill">Unassigned {unassignedActiveOperators}</div>
                            </div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-title">Managers</div>
                            <div className="kpi-value">{managersCount}</div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-title">List Items</div>
                            <div className="kpi-value">{uncompletedListCount}</div>
                            <div className="kpi-row">
                                <div className="kpi-pill">Overdue {overdueListCount}</div>
                            </div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-title">Reports</div>
                            <div className="kpi-value">{reportsCompletedCount + reportsPastDueCount}</div>
                            <div className="kpi-row">
                                <div className="kpi-pill">Completed {reportsCompletedCount}</div>
                                <div className="kpi-pill">Past Due {reportsPastDueCount}</div>
                                <div className="kpi-pill">{reportsWeekLabel || ''}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
