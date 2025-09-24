import React, {useCallback, useEffect, useRef, useState, useTransition} from 'react'
import './styles/DashboardView.css'
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
import {UserService} from '../../services/UserService'

export default function DashboardView() {
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState('')
    const [permittedRegions, setPermittedRegions] = useState([])
    const [hasAllRegionsPermission, setHasAllRegionsPermission] = useState(false)
    const [regionPlants, setRegionPlants] = useState([])
    const [allPlantsCount, setAllPlantsCount] = useState(0)
    const [dashboardRegionCode, setDashboardRegionCode] = useState('')
    const [dashboardRegionName, setDashboardRegionName] = useState('')
    const [dashboardPlant, setDashboardPlant] = useState('')
    const [lastUpdated, setLastUpdated] = useState(null)
    const [refreshKey, setRefreshKey] = useState(0)
    const [stats, setStats] = useState({
        mixers: {total: 0, active: 0, shop: 0, verified: 0, verifiedPercent: 0, issues: 0, comments: 0, overdue: 0},
        tractors: {total: 0, active: 0, shop: 0, verified: 0, verifiedPercent: 0, issues: 0, comments: 0, overdue: 0},
        trailers: {total: 0, active: 0, shop: 0, issues: 0, comments: 0, overdue: 0},
        equipment: {total: 0, active: 0, shop: 0, issues: 0, comments: 0, overdue: 0},
        pickups: {total: 0, active: 0, shop: 0, stationary: 0, spare: 0, sold: 0, retired: 0},
        operators: {total: 0, active: 0, assigned: 0, mixerAssigned: 0, tractorAssigned: 0, unassigned: 0, pending: 0},
        managers: 0,
        fleetTotal: 0,
        openIssuesTotal: 0,
        overdueTotal: 0,
        verificationAverage: 0
    })

    const allMixersRef = useRef([])
    const allTractorsRef = useRef([])
    const allTrailersRef = useRef([])
    const allEquipmentRef = useRef([])
    const allPickupsRef = useRef([])
    const allOperatorsRef = useRef([])
    const prevSnapshotRef = useRef(null)
    const initialLoadRef = useRef(true)
    const [isFiltering, startTransition] = useTransition()
    const filterTimeoutRef = useRef(null)
    const plantSetRef = useRef(new Set())
    const lastManagersFetchRef = useRef(0)
    const countsRef = useRef({mixers: {}, tractors: {}, trailers: {}, equipment: {}})

    const slimMixer = m => ({
        id: m.id,
        status: m.status,
        assignedOperator: m.assignedOperator,
        lastServiceDate: m.lastServiceDate,
        updatedLast: m.updatedLast,
        updatedAt: m.updatedAt,
        updatedBy: m.updatedBy,
        plantCode: m.assignedPlant || m.plantCode
    })
    const slimTractor = t => ({
        id: t.id,
        status: t.status,
        assignedOperator: t.assignedOperator,
        lastServiceDate: t.lastServiceDate,
        updatedLast: t.updatedLast,
        updatedAt: t.updatedAt,
        updatedBy: t.updatedBy,
        plantCode: t.assignedPlant || t.plantCode
    })
    const slimTrailer = t => ({
        id: t.id,
        status: t.status,
        lastServiceDate: t.lastServiceDate,
        plantCode: t.assignedPlant || t.plantCode
    })
    const slimEquipment = e => ({
        id: e.id,
        status: e.status,
        lastServiceDate: e.lastServiceDate,
        plantCode: e.assignedPlant || e.plantCode
    })
    const slimPickup = p => ({id: p.id, status: p.status, plantCode: p.assignedPlant || p.plantCode})
    const slimOperator = o => ({id: o.id, employeeId: o.employeeId, status: o.status, plantCode: o.plantCode})

    const isServiceOverdue = date => {
        if (!date) return true
        const diff = Math.ceil((Date.now() - new Date(date).getTime()) / 86400000)
        return diff > 90
    }

    const computeStats = useCallback(() => {
        const plantSet = new Set()
        if (dashboardPlant) plantSet.add(String(dashboardPlant).trim())
        else (regionPlants || []).forEach(p => {
            const c = p.plantCode || p.plant_code
            if (c) plantSet.add(String(c).trim())
        })
        plantSetRef.current = plantSet
        const filterActive = plantSet.size > 0
        let mixersTotals = {total: 0, active: 0, shop: 0, verified: 0, issues: 0, comments: 0, overdue: 0}
        let tractorsTotals = {total: 0, active: 0, shop: 0, verified: 0, issues: 0, comments: 0, overdue: 0}
        let trailersTotals = {total: 0, active: 0, shop: 0, issues: 0, comments: 0, overdue: 0}
        let equipmentTotals = {total: 0, active: 0, shop: 0, issues: 0, comments: 0, overdue: 0}
        let pickupsTotals = {total: 0, active: 0, shop: 0, stationary: 0, spare: 0, sold: 0, retired: 0}
        let operatorsTotals = {total: 0, active: 0, assigned: 0, mixerAssigned: 0, tractorAssigned: 0, unassigned: 0, pending: 0}
        const mixerAssignedIds = new Set()
        const tractorAssignedIds = new Set()
        const consider = (plantCode) => !filterActive || plantSet.has(String(plantCode || '').trim())
        const counts = countsRef.current
        for (const m of allMixersRef.current) {
            if (!consider(m.plantCode)) continue
            mixersTotals.total++
            if (m.status === 'Active') mixersTotals.active++; else if (m.status === 'In Shop') mixersTotals.shop++
            if (isServiceOverdue(m.lastServiceDate)) mixersTotals.overdue++
            if (VerifiedUtility.isVerified(m.updatedLast, m.updatedAt, m.updatedBy)) mixersTotals.verified++
            if (m.assignedOperator) mixerAssignedIds.add(m.assignedOperator)
            const mc = counts.mixers[m.id]
            if (mc) { mixersTotals.issues += mc.issues || 0; mixersTotals.comments += mc.comments || 0 }
        }
        for (const t of allTractorsRef.current) {
            if (!consider(t.plantCode)) continue
            tractorsTotals.total++
            if (t.status === 'Active') tractorsTotals.active++; else if (t.status === 'In Shop') tractorsTotals.shop++
            if (isServiceOverdue(t.lastServiceDate)) tractorsTotals.overdue++
            if (VerifiedUtility.isVerified(t.updatedLast, t.updatedAt, t.updatedBy)) tractorsTotals.verified++
            if (t.assignedOperator) tractorAssignedIds.add(t.assignedOperator)
            const tc = counts.tractors[t.id]
            if (tc) { tractorsTotals.issues += tc.issues || 0; tractorsTotals.comments += tc.comments || 0 }
        }
        for (const r of allTrailersRef.current) {
            if (!consider(r.plantCode)) continue
            trailersTotals.total++
            if (r.status === 'Active') trailersTotals.active++; else if (r.status === 'In Shop') trailersTotals.shop++
            if (isServiceOverdue(r.lastServiceDate)) trailersTotals.overdue++
            const rc = counts.trailers[r.id]
            if (rc) { trailersTotals.issues += rc.issues || 0; trailersTotals.comments += rc.comments || 0 }
        }
        for (const e of allEquipmentRef.current) {
            if (!consider(e.plantCode)) continue
            equipmentTotals.total++
            if (e.status === 'Active') equipmentTotals.active++; else if (e.status === 'In Shop') equipmentTotals.shop++
            if (isServiceOverdue(e.lastServiceDate)) equipmentTotals.overdue++
            const ec = counts.equipment[e.id]
            if (ec) { equipmentTotals.issues += ec.issues || 0; equipmentTotals.comments += ec.comments || 0 }
        }
        for (const p of allPickupsRef.current) {
            if (!consider(p.plantCode)) continue
            pickupsTotals.total++
            if (p.status === 'Active') pickupsTotals.active++; else if (p.status === 'In Shop') pickupsTotals.shop++; else if (p.status === 'Stationary') pickupsTotals.stationary++; else if (p.status === 'Spare') pickupsTotals.spare++; else if (p.status === 'Sold') pickupsTotals.sold++; else if (p.status === 'Retired') pickupsTotals.retired++
        }
        for (const o of allOperatorsRef.current) {
            if (!consider(o.plantCode)) continue
            operatorsTotals.total++
            if (o.status === 'Active') {
                operatorsTotals.active++
                if (mixerAssignedIds.has(o.employeeId)) {
                    operatorsTotals.assigned++
                    operatorsTotals.mixerAssigned++
                } else if (tractorAssignedIds.has(o.employeeId)) {
                    operatorsTotals.assigned++
                    operatorsTotals.tractorAssigned++
                } else operatorsTotals.unassigned++
            } else if (o.status === 'Pending Start') operatorsTotals.pending++
        }
        const mixersVerifiedPercent = mixersTotals.total ? Math.round((mixersTotals.verified / mixersTotals.total) * 100) : 0
        const tractorsVerifiedPercent = tractorsTotals.total ? Math.round((tractorsTotals.verified / tractorsTotals.total) * 100) : 0
        const verifiedValues = []
        if (mixersTotals.total) verifiedValues.push(mixersVerifiedPercent)
        if (tractorsTotals.total) verifiedValues.push(tractorsVerifiedPercent)
        const verificationAvg = verifiedValues.length ? Math.round(verifiedValues.reduce((a, b) => a + b, 0) / verifiedValues.length) : 0
        const openIssuesTotal = mixersTotals.issues + tractorsTotals.issues + trailersTotals.issues + equipmentTotals.issues
        const overdueTotal = mixersTotals.overdue + tractorsTotals.overdue + trailersTotals.overdue + equipmentTotals.overdue
        const fleetTotal = mixersTotals.total + tractorsTotals.total + trailersTotals.total + equipmentTotals.total + pickupsTotals.total
        setStats(s => ({
            mixers: {...mixersTotals, verifiedPercent: mixersVerifiedPercent},
            tractors: {...tractorsTotals, verifiedPercent: tractorsVerifiedPercent},
            trailers: trailersTotals,
            equipment: equipmentTotals,
            pickups: pickupsTotals,
            operators: operatorsTotals,
            managers: s.managers,
            fleetTotal,
            openIssuesTotal,
            overdueTotal,
            verificationAverage: verificationAvg
        }))
        prevSnapshotRef.current = {fleet: fleetTotal}
    }, [dashboardPlant, regionPlants])

    const applyFilters = useCallback(() => {
        if (loading) {
            computeStats()
            return
        }
        if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current)
        filterTimeoutRef.current = setTimeout(() => startTransition(() => computeStats()), 30)
    }, [computeStats, loading])

    useEffect(() => () => {
        if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current)
    }, [])

    const fetchIssueCommentCounts = useCallback(async () => {
        try {
            const mixerIds = allMixersRef.current.map(m => m.id).filter(Boolean)
            const tractorIds = allTractorsRef.current.map(t => t.id).filter(Boolean)
            const trailerIds = allTrailersRef.current.map(t => t.id).filter(Boolean)
            const equipmentIds = allEquipmentRef.current.map(e => e.id).filter(Boolean)
            if (!mixerIds.length && !tractorIds.length && !trailerIds.length && !equipmentIds.length) return
            const [mMaint, mCom, tMaint, tCom, trMaint, trCom, eMaint, eCom] = await Promise.all([
                mixerIds.length ? supabase.from('mixers_maintenance').select('id,mixer_id,time_completed').in('mixer_id', mixerIds).is('time_completed', null) : Promise.resolve({data: []}),
                mixerIds.length ? supabase.from('mixers_comments').select('id,mixer_id').in('mixer_id', mixerIds) : Promise.resolve({data: []}),
                tractorIds.length ? supabase.from('tractors_maintenance').select('id,tractor_id,time_completed').in('tractor_id', tractorIds).is('time_completed', null) : Promise.resolve({data: []}),
                tractorIds.length ? supabase.from('tractors_comments').select('id,tractor_id').in('tractor_id', tractorIds) : Promise.resolve({data: []}),
                trailerIds.length ? supabase.from('trailers_maintenance').select('id,trailer_id,time_completed').in('trailer_id', trailerIds).is('time_completed', null) : Promise.resolve({data: []}),
                trailerIds.length ? supabase.from('trailers_comments').select('id,trailer_id').in('trailer_id', trailerIds) : Promise.resolve({data: []}),
                equipmentIds.length ? supabase.from('heavy_equipment_maintenance').select('id,equipment_id,time_completed').in('equipment_id', equipmentIds).is('time_completed', null) : Promise.resolve({data: []}),
                equipmentIds.length ? supabase.from('heavy_equipment_comments').select('id,equipment_id').in('equipment_id', equipmentIds) : Promise.resolve({data: []})
            ])
            const counts = {mixers: {}, tractors: {}, trailers: {}, equipment: {}}
            ;(mMaint.data || []).forEach(r => { counts.mixers[r.mixer_id] = counts.mixers[r.mixer_id] || {issues: 0, comments: 0}; counts.mixers[r.mixer_id].issues++ })
            ;(mCom.data || []).forEach(r => { counts.mixers[r.mixer_id] = counts.mixers[r.mixer_id] || {issues: 0, comments: 0}; counts.mixers[r.mixer_id].comments++ })
            ;(tMaint.data || []).forEach(r => { counts.tractors[r.tractor_id] = counts.tractors[r.tractor_id] || {issues: 0, comments: 0}; counts.tractors[r.tractor_id].issues++ })
            ;(tCom.data || []).forEach(r => { counts.tractors[r.tractor_id] = counts.tractors[r.tractor_id] || {issues: 0, comments: 0}; counts.tractors[r.tractor_id].comments++ })
            ;(trMaint.data || []).forEach(r => { counts.trailers[r.trailer_id] = counts.trailers[r.trailer_id] || {issues: 0, comments: 0}; counts.trailers[r.trailer_id].issues++ })
            ;(trCom.data || []).forEach(r => { counts.trailers[r.trailer_id] = counts.trailers[r.trailer_id] || {issues: 0, comments: 0}; counts.trailers[r.trailer_id].comments++ })
            ;(eMaint.data || []).forEach(r => { counts.equipment[r.equipment_id] = counts.equipment[r.equipment_id] || {issues: 0, comments: 0}; counts.equipment[r.equipment_id].issues++ })
            ;(eCom.data || []).forEach(r => { counts.equipment[r.equipment_id] = counts.equipment[r.equipment_id] || {issues: 0, comments: 0}; counts.equipment[r.equipment_id].comments++ })
            countsRef.current = counts
            computeStats()
        } catch {
        }
    }, [computeStats])

    useEffect(() => {
        let cancelled = false
        let intervalId
        async function initBase() {
            const isInitial = initialLoadRef.current
            if (isInitial) {
                setLoading(true)
            } else {
                setRefreshing(true)
            }
            setError('')
            try {
                const allPlants = await ReportService.fetchPlantsSorted().catch(() => [])
                if (cancelled) return
                setAllPlantsCount(Array.isArray(allPlants) ? allPlants.length : 0)
                const {data: sessionData} = await supabase.auth.getSession()
                const uid = sessionData?.session?.user?.id || sessionStorage.getItem('userId') || ''
                let allPerm = false
                try {
                    allPerm = await UserService.hasPermission(uid, 'region.select.all').catch(() => false)
                } catch {
                }
                if (cancelled) return
                setHasAllRegionsPermission(!!allPerm)
                let allFetched
                try {
                    allFetched = await RegionService.fetchRegions().catch(() => [])
                } catch {
                    allFetched = []
                }
                let regionsList = []
                if (allPerm) regionsList = allFetched
                else {
                    const {data: profile} = await supabase.from('users_profiles').select('plant_code, regions').eq('id', uid).maybeSingle()
                    const profileRegions = Array.isArray(profile?.regions) ? profile.regions.filter(r => typeof r === 'string' && r.trim()) : []
                    if (profileRegions.length) {
                        const codeSet = new Set(profileRegions.map(c => c.toLowerCase()))
                        regionsList = allFetched.filter(r => codeSet.has(String((r.regionCode || '').toLowerCase())))
                    }
                    if ((!regionsList || !regionsList.length) && profile?.plant_code) {
                        try {
                            regionsList = await RegionService.fetchRegionsByPlantCode(profile.plant_code).catch(() => [])
                        } catch {
                        }
                    }
                }
                if ((!regionsList || !regionsList.length) && allFetched.length) regionsList = allFetched
                if (cancelled) return
                setPermittedRegions(regionsList)
                if (!dashboardRegionCode && regionsList.length) {
                    const first = regionsList[0]
                    setDashboardRegionCode(first.regionCode)
                    setDashboardRegionName(first.regionName)
                }
            } catch {
                if (!cancelled) setError('Failed to load dashboard data')
            } finally {
                if (!cancelled) {
                    initialLoadRef.current = false
                    setLoading(false)
                    setRefreshing(false)
                }
            }
        }
        initBase()
        intervalId = setInterval(() => setRefreshKey(v => v + 1), 600000)
        return () => {
            cancelled = true
            if (intervalId) clearInterval(intervalId)
        }
    }, [dashboardRegionCode])

    useEffect(() => {
        let cancelled = false
        async function fetchRegionPlants() {
            if (!dashboardRegionCode) {
                setRegionPlants([])
                return
            }
            setRefreshing(true)
            try {
                const list = await RegionService.fetchRegionPlants(dashboardRegionCode).catch(() => [])
                if (cancelled) return
                setRegionPlants(list)
            } finally {
                if (!cancelled) setRefreshing(false)
            }
        }
        fetchRegionPlants()
        return () => {
            cancelled = true
        }
    }, [dashboardRegionCode])

    useEffect(() => {
        let cancelled = false
        async function fetchAssets() {
            const CACHE_KEY = 'dashboard_assets_cache_v1'
            const CACHE_TTL_MS = 120000
            setError('')
            const now = Date.now()
            if (initialLoadRef.current) {
                try {
                    const raw = sessionStorage.getItem(CACHE_KEY)
                    if (raw) {
                        const parsed = JSON.parse(raw)
                        if (parsed && (now - (parsed.savedAt || 0)) < CACHE_TTL_MS) {
                            allMixersRef.current = (parsed.mixers || []).map(slimMixer)
                            allTractorsRef.current = (parsed.tractors || []).map(slimTractor)
                            allTrailersRef.current = (parsed.trailers || []).map(slimTrailer)
                            allEquipmentRef.current = (parsed.equipment || []).map(slimEquipment)
                            allPickupsRef.current = (parsed.pickups || []).map(slimPickup)
                            allOperatorsRef.current = (parsed.operators || []).map(slimOperator)
                            computeStats()
                            setLastUpdated(parsed.lastUpdated ? new Date(parsed.lastUpdated) : new Date(parsed.savedAt || now))
                            setLoading(false)
                        }
                    }
                } catch {
                }
            }
            setRefreshing(true)
            try {
                const [mix, trac, trail, equip, pick, ops] = await Promise.all([
                    MixerService.getAllMixers().catch(() => []),
                    TractorService.getAllTractors().catch(() => []),
                    TrailerService.fetchTrailers().catch(() => []),
                    EquipmentService.getAllEquipments().catch(() => []),
                    PickupTruckService.getAll().catch(() => []),
                    OperatorService.getAllOperators().catch(() => [])
                ])
                if (cancelled) return
                allMixersRef.current = mix.map(slimMixer)
                allTractorsRef.current = trac.map(slimTractor)
                allTrailersRef.current = trail.map(slimTrailer)
                allEquipmentRef.current = equip.map(slimEquipment)
                allPickupsRef.current = pick.map(slimPickup)
                allOperatorsRef.current = ops.map(slimOperator)
                computeStats()
                const fetchedAt = new Date()
                setLastUpdated(fetchedAt)
                try {
                    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                        savedAt: Date.now(),
                        lastUpdated: fetchedAt.toISOString(),
                        mixers: allMixersRef.current,
                        tractors: allTractorsRef.current,
                        trailers: allTrailersRef.current,
                        equipment: allEquipmentRef.current,
                        pickups: allPickupsRef.current,
                        operators: allOperatorsRef.current
                    }))
                } catch {
                }
            } catch {
                if (!cancelled && !lastUpdated) setError('Failed to load dashboard data')
            } finally {
                if (!cancelled) {
                    setLoading(false)
                    setRefreshing(false)
                }
            }
        }
        fetchAssets()
        return () => {
            cancelled = true
        }
    }, [refreshKey, computeStats])

    useEffect(() => {
        applyFilters()
    }, [dashboardPlant, regionPlants, applyFilters])
    useEffect(() => {
        if (!loading) fetchIssueCommentCounts()
    }, [stats.fleetTotal, loading, fetchIssueCommentCounts])

    useEffect(() => {
        if (loading) return
        const now = Date.now()
        if (now - lastManagersFetchRef.current < 60000) return
        lastManagersFetchRef.current = now
        let cancelled = false
        async function loadManagers() {
            try {
                const [permRes, roleRes, profRes] = await Promise.all([
                    supabase.from('users_permissions').select('user_id, role_id'),
                    supabase.from('users_roles').select('id, name'),
                    supabase.from('users_profiles').select('id, plant_code')
                ])
                if (cancelled) return
                const managerRoleIds = new Set((roleRes.data || []).filter(r => String(r.name || '').toLowerCase().includes('manager')).map(r => r.id))
                const userIds = new Set((permRes.data || []).filter(p => managerRoleIds.has(p.role_id)).map(p => p.user_id))
                const plantSet = plantSetRef.current
                const managersCount = (profRes.data || []).filter(pr => userIds.has(pr.id) && (plantSet.size === 0 || plantSet.has(String(pr.plant_code || '').trim()))).length
                setStats(s => ({...s, managers: managersCount}))
            } catch {
            }
        }
        loadManagers()
        return () => {
            cancelled = true
        }
    }, [stats.fleetTotal, dashboardPlant, regionPlants, loading])

    const regionDisplayName = dashboardRegionCode ? (dashboardRegionName || dashboardRegionCode) : (hasAllRegionsPermission ? 'All Regions' : (permittedRegions[0]?.regionName || 'Region'))
    const diffBadge = (current) => {
        const prev = prevSnapshotRef.current?.fleet
        if (prev == null) return null
        const diff = current - prev
        if (!diff) return null
        const up = diff > 0
        return <span className={up ? 'delta-indicator up' : 'delta-indicator down'}
                     title={`Change since last refresh: ${diff}`}>{up ? '▲' : '▼'}{Math.abs(diff)}</span>
    }

    const onRegionChange = e => {
        const code = e.target.value
        if (!code && !hasAllRegionsPermission) return
        if (!code && hasAllRegionsPermission) {
            setDashboardRegionCode('')
            setDashboardRegionName('')
            setDashboardPlant('')
            return
        }
        const r = permittedRegions.find(x => (x.regionCode || x.region_code) === code)
        if (r) {
            setDashboardRegionCode(r.regionCode || r.region_code)
            setDashboardRegionName(r.regionName || r.region_name || '')
        }
        setDashboardPlant('')
    }
    const onPlantChange = e => setDashboardPlant(e.target.value)
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
    const showSkeleton = loading

    return (
        <div className="dashboard-container" data-filtering={isFiltering || undefined}>
            <div className="dashboard-header">
                <h1>Dashboard</h1>
                <div className="dashboard-actions">
                    <div className="toolbar-group">
                        <div className="updated-at"><span
                            className="live-dot"></span><span>{lastUpdated ? `Updated ${timeAgo(lastUpdated)}` : 'Never updated'}</span>
                        </div>
                        <select className="ios-select" value={dashboardRegionCode} onChange={onRegionChange}
                                disabled={refreshing} aria-label="Region">
                            {hasAllRegionsPermission && <option value="">All Regions</option>}
                            {permittedRegions.map(r => <option key={r.regionCode}
                                                               value={r.regionCode}>{r.regionName} ({r.regionCode})</option>)}
                        </select>
                        {dashboardRegionCode && (
                            <select className="ios-select" value={dashboardPlant} onChange={onPlantChange}
                                    disabled={refreshing} aria-label="Plant">
                                <option value="">All Plants</option>
                                {regionPlants.map(p => {
                                    const code = p.plantCode || p.plant_code
                                    const name = p.plantName || p.plant_name || code
                                    return <option key={code} value={code}>{name} ({code})</option>
                                })}
                            </select>
                        )}
                    </div>
                    <div className="toolbar-group">
                        <button className="btn ghost" onClick={onRefresh} disabled={refreshing}
                                aria-label="Refresh">{refreshing ?
                            <span className="mini-loader"/> : null}<span>Refresh</span></button>
                        {isFiltering && <div className="filtering-indicator">Filtering</div>}
                    </div>
                </div>
            </div>
            <div className="dashboard-hero simple">
                <div className="hero-left">
                    <div className="hero-region">
                        <div className="hero-region-name">{regionDisplayName}</div>
                        <div
                            className="hero-region-sub">{dashboardPlant ? `Plant ${dashboardPlant}` : (dashboardRegionCode ? `${regionPlants.length} Plants` : `${allPlantsCount} Plants`)}</div>
                    </div>
                    <div className="hero-metrics compact">
                        <div className="hero-metric">
                            <div className="metric-label">Fleet</div>
                            <div className="metric-value">{stats.fleetTotal}{diffBadge(stats.fleetTotal)}</div>
                            <div className="metric-sub">Assets</div>
                        </div>
                        <div className="hero-metric">
                            <div className="metric-label">Issues</div>
                            <div className="metric-value">{stats.openIssuesTotal}</div>
                            <div className="metric-sub">Open</div>
                        </div>
                        <div className="hero-metric">
                            <div className="metric-label">Overdue</div>
                            <div className="metric-value warn">{stats.overdueTotal}</div>
                            <div className="metric-sub">Service</div>
                        </div>
                        <div className="hero-metric wide"><div className="metric-label">Verified</div><div className="metric-value accent">{stats.verificationAverage}%</div><div className="metric-sub">Overall Verification</div></div>
                    </div>
                </div>
            </div>
            {error && <div className="error-banner">
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8}}>
                    <span>{error}</span>
                    <button className="btn danger ghost" onClick={onRetry}>Retry</button>
                </div>
            </div>}
            <div className="content-container" aria-busy={showSkeleton}>
                {showSkeleton ? (
                    <div className="dashboard-grid skeleton-grid">{Array.from({length: 8}).map((_, i) => <div
                        className="kpi-card skeleton-card" key={i}>
                        <div className="skeleton-line w40"/>
                        <div className="skeleton-line w60 tall"/>
                        <div className="skeleton-row">
                            <div className="skeleton-pill w30"/>
                            <div className="skeleton-pill w20"/>
                            <div className="skeleton-pill w25"/>
                        </div>
                    </div>)}</div>
                ) : (
                    <div className="group-grid">
                        <div className="group-section">
                            <div className="section-title">Fleet</div>
                            <div className="dashboard-grid inner-grid">
                                <div className="kpi-card">
                                    <div className="kpi-title">Mixers</div>
                                    <div className="kpi-value">{stats.mixers.total}</div>
                                    <div className="kpi-row">
                                        <div className="kpi-pill">Active {stats.mixers.active}</div>
                                        <div className="kpi-pill">In Shop {stats.mixers.shop}</div>
                                        <div className="kpi-pill">Verified {stats.mixers.verifiedPercent}%</div>
                                        <div className="kpi-pill">Issues {stats.mixers.issues}</div>
                                        <div className="kpi-pill">Comments {stats.mixers.comments}</div>
                                    </div>
                                </div>
                                <div className="kpi-card">
                                    <div className="kpi-title">Tractors</div>
                                    <div className="kpi-value">{stats.tractors.total}</div>
                                    <div className="kpi-row">
                                        <div className="kpi-pill">Active {stats.tractors.active}</div>
                                        <div className="kpi-pill">In Shop {stats.tractors.shop}</div>
                                        <div className="kpi-pill">Verified {stats.tractors.verifiedPercent}%</div>
                                        <div className="kpi-pill">Issues {stats.tractors.issues}</div>
                                        <div className="kpi-pill">Comments {stats.tractors.comments}</div>
                                    </div>
                                </div>
                                <div className="kpi-card">
                                    <div className="kpi-title">Trailers</div>
                                    <div className="kpi-value">{stats.trailers.total}</div>
                                    <div className="kpi-row">
                                        <div className="kpi-pill">Active {stats.trailers.active}</div>
                                        <div className="kpi-pill">In Shop {stats.trailers.shop}</div>
                                        <div className="kpi-pill">Issues {stats.trailers.issues}</div>
                                        <div className="kpi-pill">Overdue {stats.trailers.overdue}</div>
                                        <div className="kpi-pill">Comments {stats.trailers.comments}</div>
                                    </div>
                                </div>
                                <div className="kpi-card">
                                    <div className="kpi-title">Equipment</div>
                                    <div className="kpi-value">{stats.equipment.total}</div>
                                    <div className="kpi-row">
                                        <div className="kpi-pill">Active {stats.equipment.active}</div>
                                        <div className="kpi-pill">In Shop {stats.equipment.shop}</div>
                                        <div className="kpi-pill">Issues {stats.equipment.issues}</div>
                                        <div className="kpi-pill">Overdue {stats.equipment.overdue}</div>
                                        <div className="kpi-pill">Comments {stats.equipment.comments}</div>
                                    </div>
                                </div>
                                <div className="kpi-card">
                                    <div className="kpi-title">Pickup Trucks</div>
                                    <div className="kpi-value">{stats.pickups.total}</div>
                                    <div className="kpi-row">
                                        <div className="kpi-pill">Active {stats.pickups.active}</div>
                                        <div className="kpi-pill">In Shop {stats.pickups.shop}</div>
                                        <div className="kpi-pill">Stationary {stats.pickups.stationary}</div>
                                        <div className="kpi-pill">Spare {stats.pickups.spare}</div>
                                        <div className="kpi-pill">Sold {stats.pickups.sold}</div>
                                        <div className="kpi-pill">Retired {stats.pickups.retired}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="group-section">
                            <div className="section-title">People</div>
                            <div className="dashboard-grid inner-grid">
                                <div className="kpi-card">
                                    <div className="kpi-title">Operators</div>
                                    <div className="kpi-value">{stats.operators.total}</div>
                                    <div className="kpi-row">
                                        <div className="kpi-pill">Active {stats.operators.active}</div>
                                        <div className="kpi-pill">Assigned {stats.operators.assigned}</div>
                                        <div className="kpi-pill">Mixer Assign {stats.operators.mixerAssigned}</div>
                                        <div className="kpi-pill">Tractor Assign {stats.operators.tractorAssigned}</div>
                                        <div className="kpi-pill">Unassigned {stats.operators.unassigned}</div>
                                        <div className="kpi-pill">Pending {stats.operators.pending}</div>
                                    </div>
                                </div>
                                <div className="kpi-card">
                                    <div className="kpi-title">Managers</div>
                                    <div className="kpi-value">{stats.managers}</div>
                                </div>
                            </div>
                        </div>
                        <div className="group-section">
                            <div className="section-title">Maintenance & Quality</div>
                            <div className="dashboard-grid inner-grid">
                                <div className="kpi-card">
                                    <div className="kpi-title">Service Overdue</div>
                                    <div className="kpi-value warn">{stats.overdueTotal}</div>
                                    <div className="kpi-row">
                                        <div className="kpi-pill">Mixers {stats.mixers.overdue}</div>
                                        <div className="kpi-pill">Tractors {stats.tractors.overdue}</div>
                                        <div className="kpi-pill">Trailers {stats.trailers.overdue}</div>
                                        <div className="kpi-pill">Equipment {stats.equipment.overdue}</div>
                                    </div>
                                </div>
                                <div className="kpi-card">
                                    <div className="kpi-title">Open Issues</div>
                                    <div className="kpi-value">{stats.openIssuesTotal}</div>
                                    <div className="kpi-row">
                                        <div className="kpi-pill">Mixers {stats.mixers.issues}</div>
                                        <div className="kpi-pill">Tractors {stats.tractors.issues}</div>
                                        <div className="kpi-pill">Trailers {stats.trailers.issues}</div>
                                        <div className="kpi-pill">Equipment {stats.equipment.issues}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
