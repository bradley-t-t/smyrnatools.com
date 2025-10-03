import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {usePreferences} from '../../app/context/PreferencesContext';
import LoadingScreen from '../common/LoadingScreen';
import TrailerCard from './TrailerCard';
import '../../styles/FilterStyles.css';
import './styles/TrailersView.css';
import {TrailerService} from '../../services/TrailerService';
import {TrailerUtility} from '../../utils/TrailerUtility';
import {PlantService} from '../../services/PlantService';
import {TractorService} from '../../services/TractorService';
import TrailerAddView from './TrailerAddView';
import TrailerDetailView from './TrailerDetailView';
import TrailerIssueModal from './TrailerIssueModal'
import TrailerCommentModal from './TrailerCommentModal'
import {RegionService} from '../../services/RegionService'
import AsyncUtility from '../../utils/AsyncUtility'
import LookupUtility from '../../utils/LookupUtility'
import FleetUtility from '../../utils/FleetUtility'
import TopSection from '../sections/TopSection'

function TrailersView({title = 'Trailer Fleet', onSelectTrailer}) {
    const {preferences, saveLastViewedFilters, updateTrailerFilter, updatePreferences} = usePreferences()
    const [trailers, setTrailers] = useState([])
    const [tractors, setTractors] = useState([])
    const [plants, setPlants] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchText, setSearchText] = useState(preferences.trailerFilters?.searchText || '')
    const [searchInput, setSearchInput] = useState(preferences.trailerFilters?.searchText || '')
    const [selectedPlant, setSelectedPlant] = useState(preferences.trailerFilters?.selectedPlant || '')
    const [typeFilter, setTypeFilter] = useState(preferences.trailerFilters?.typeFilter || '')
    const [viewMode, setViewMode] = useState(() => {
        if (preferences.trailerFilters?.viewMode !== undefined && preferences.trailerFilters?.viewMode !== null) return preferences.trailerFilters.viewMode
        if (preferences.defaultViewMode !== undefined && preferences.defaultViewMode !== null) return preferences.defaultViewMode
        const lastUsed = localStorage.getItem('trailers_last_view_mode')
        return lastUsed || 'grid'
    })
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [selectedTrailer, setSelectedTrailer] = useState(null)
    const [reloadTrailers, setReloadTrailers] = useState(false)
    const [showIssueModal, setShowIssueModal] = useState(false)
    const [showCommentModal, setShowCommentModal] = useState(false)
    const [modalTrailerId, setModalTrailerId] = useState(null)
    const [modalTrailerNumber, setModalTrailerNumber] = useState('')
    const [regionPlantCodes, setRegionPlantCodes] = useState(null)
    const filterOptions = ['All Types', 'Cement', 'End Dump', 'Past Due Service', 'Verified', 'Not Verified', 'Open Issues']
    const headerRef = useRef(null)

    useEffect(() => {
        async function fetchAllData() {
            setIsLoading(true)
            try {
                await Promise.all([fetchTrailers(), fetchTractors(), fetchPlants()])
            } finally {
                setIsLoading(false)
            }
        }

        fetchAllData()
        if (preferences?.trailerFilters) {
            setSearchText(preferences.trailerFilters.searchText || '')
            setSearchInput(preferences.trailerFilters.searchText || '')
            setSelectedPlant(preferences.trailerFilters.selectedPlant || '')
            setTypeFilter(preferences.trailerFilters.typeFilter || '')
            setViewMode(preferences.trailerFilters.viewMode || preferences.defaultViewMode || 'grid')
        }
    }, [preferences, reloadTrailers])

    useEffect(() => {
        if (preferences.trailerFilters?.viewMode !== undefined && preferences.trailerFilters?.viewMode !== null) {
            setViewMode(preferences.trailerFilters.viewMode)
        } else if (preferences.defaultViewMode !== undefined && preferences.defaultViewMode !== null) {
            setViewMode(preferences.defaultViewMode)
        } else {
            const lastUsed = localStorage.getItem('trailers_last_view_mode')
            if (lastUsed) setViewMode(lastUsed)
        }
    }, [preferences.trailerFilters?.viewMode, preferences.defaultViewMode])

    useEffect(() => {
        const code = preferences.selectedRegion?.code || ''
        let cancelled = false

        async function loadRegionPlants() {
            if (!code) {
                setRegionPlantCodes(null)
                return
            }
            try {
                const regionPlants = await RegionService.fetchRegionPlants(code)
                if (cancelled) return
                const codes = new Set(regionPlants.map(p => p.plantCode || p.plant_code))
                setRegionPlantCodes(codes)
                if (selectedPlant && !codes.has(selectedPlant)) {
                    setSelectedPlant('')
                    updatePreferences('trailerFilters', { ...preferences.trailerFilters, selectedPlant: '' })
                }
            } catch {
                setRegionPlantCodes(null)
            }
        }

        loadRegionPlants()
        return () => { cancelled = true }
    }, [preferences.selectedRegion?.code])

    useEffect(() => {
        function updateStickyCoverHeight() {
            const el = headerRef.current
            const h = el ? Math.ceil(el.getBoundingClientRect().height) : 0
            const root = document.querySelector('.dashboard-container.trailers-view')
            if (root && h) root.style.setProperty('--sticky-cover-height', h + 'px')
        }
        updateStickyCoverHeight()
        window.addEventListener('resize', updateStickyCoverHeight)
        return () => window.removeEventListener('resize', updateStickyCoverHeight)
    }, [viewMode, searchInput, selectedPlant, typeFilter])

    function handleViewModeChange(mode) {
        if (viewMode === mode) {
            setViewMode(null)
            updateTrailerFilter('viewMode', null)
            localStorage.removeItem('trailers_last_view_mode')
        } else {
            setViewMode(mode)
            updateTrailerFilter('viewMode', mode)
            localStorage.setItem('trailers_last_view_mode', mode)
        }
    }

    async function fetchTrailers() {
        try {
            const data = await TrailerService.fetchTrailers()
            const base = data.map(t => {
                const trailer = {...t}
                trailer.isVerified = () => TrailerUtility.isVerified(trailer.updatedLast, trailer.updatedAt, trailer.updatedBy, trailer.latestHistoryDate)
                if (typeof trailer.openIssuesCount !== 'number') trailer.openIssuesCount = 0
                if (typeof trailer.commentsCount !== 'number') trailer.commentsCount = 0
                return trailer
            })
            setTrailers(base)
            ;(async () => {
                const items = base.slice()
                let index = 0
                const concurrency = 6

                async function worker() {
                    while (index < items.length) {
                        const current = index++
                        const tr = items[current]
                        try {
                            const [comments, issues] = await Promise.all([
                                TrailerService.fetchComments(tr.id).catch(() => []),
                                TrailerService.fetchIssues(tr.id).catch(() => [])
                            ])
                            const openIssuesCount = Array.isArray(issues) ? issues.filter(i => !i.time_completed).length : 0
                            const commentsCount = Array.isArray(comments) ? comments.length : 0
                            setTrailers(prev => {
                                const arr = prev.slice()
                                const idx = arr.findIndex(x => x.id === tr.id)
                                if (idx >= 0) arr[idx] = {...arr[idx], comments, issues, openIssuesCount, commentsCount}
                                return arr
                            })
                        } catch {}
                    }
                }

                await Promise.all(Array.from({length: concurrency}, () => worker()))
            })()
        } catch {}
    }

    async function fetchTractors() {
        try {
            const data = await TractorService.fetchTractors();
            setTractors(Array.isArray(data) ? data : []);
        } catch { setTractors([]) }
    }

    async function fetchPlants() {
        try { const data = await PlantService.fetchPlants(); setPlants(data); } catch {}
    }

    function handleSelectTrailer(trailerId) {
        saveLastViewedFilters();
        const trailerObj = trailers.find(t => t.id === trailerId);
        setSelectedTrailer(trailerObj);
        if (onSelectTrailer) onSelectTrailer(trailerId);
    }

    function handleBackFromDetail() {
        setSelectedTrailer(null)
        setReloadTrailers(r => !r)
    }

    const debouncedSetSearchText = useCallback(AsyncUtility.debounce(value => {
        setSearchText(value)
        updatePreferences(prev => ({ ...prev, trailerFilters: { ...prev.trailerFilters, searchText: value } }))
    }, 300), [updatePreferences])

    const filteredTrailers = useMemo(() => trailers.filter(trailer => {
        const matchesSearch = !searchText.trim() || trailer.trailerNumber?.toLowerCase().includes(searchText.toLowerCase()) || (trailer.assignedTractor && tractors.find(t => t.id === trailer.assignedTractor)?.truckNumber.toLowerCase().includes(searchText.toLowerCase()))
        const matchesPlant = !selectedPlant || trailer.assignedPlant === selectedPlant
        const matchesRegion = !preferences.selectedRegion?.code || !regionPlantCodes || regionPlantCodes.size === 0 || regionPlantCodes.has(trailer.assignedPlant)
        let matchesType = true
        if (typeFilter && typeFilter !== 'All Types') {
            matchesType = ['Cement', 'End Dump'].includes(typeFilter) ? trailer.trailerType === typeFilter : typeFilter === 'Past Due Service' ? TrailerUtility.isServiceOverdue(trailer.lastServiceDate) : typeFilter === 'Verified' ? trailer.isVerified() : typeFilter === 'Not Verified' ? !trailer.isVerified() : typeFilter === 'Open Issues' ? (Number(trailer.openIssuesCount || 0) > 0) : false
        }
        return matchesSearch && matchesPlant && matchesRegion && matchesType
    }).sort((a, b) => FleetUtility.compareByStatusThenNumber(a, b, 'status', 'trailerNumber')), [trailers, tractors, selectedPlant, searchText, typeFilter, preferences.selectedRegion?.code, regionPlantCodes])

    const content = useMemo(() => {
        if (isLoading) return <div className="loading-container"><LoadingScreen message="Loading trailers..." inline={true}/></div>
        if (filteredTrailers.length === 0) return <div className="no-results-container"><div className="no-results-icon"><i className="fas fa-trailer"></i></div><h3>No Trailers Found</h3><p>{searchText || selectedPlant || (typeFilter && typeFilter !== 'All Types') ? "No trailers match your search criteria." : "There are no trailers in the system yet."}</p><button className="primary-button" onClick={() => setShowAddSheet(true)}>Add Trailer</button></div>
        if (viewMode === 'grid') return <div className={`trailers-grid ${searchText ? 'search-results' : ''}`}>{filteredTrailers.map(trailer => <TrailerCard key={trailer.id} trailer={trailer} tractorName={LookupUtility.getTractorTruckNumber(tractors, trailer.assignedTractor)} plantName={LookupUtility.getPlantName(plants, trailer.assignedPlant)} showTractorWarning={LookupUtility.isIdAssignedToMultiple(trailers, 'assignedTractor', trailer.assignedTractor)} onSelect={() => handleSelectTrailer(trailer.id)}/> )}</div>
        if (viewMode === 'list') return <div className="trailers-list-table-container"><table className="trailers-list-table"><colgroup><col style={{width: '12%'}}/><col style={{width: '14%'}}/><col style={{width: '12%'}}/><col style={{width: '18%'}}/><col style={{width: '14%'}}/><col style={{width: '22%'}}/><col style={{width: '8%'}}/></colgroup><tbody>{filteredTrailers.map(trailer => { const commentsCount = Number(trailer.commentsCount || 0); const issuesCount = Number(trailer.openIssuesCount || 0); return <tr key={trailer.id} onClick={() => handleSelectTrailer(trailer.id)} style={{cursor: 'pointer'}}><td>{trailer.assignedPlant ? trailer.assignedPlant : "---"}</td><td>{trailer.trailerNumber ? trailer.trailerNumber : "---"}</td><td><span className="item-status-dot" style={{display: 'inline-block', verticalAlign: 'middle', marginRight: '8px', backgroundColor: trailer.status === 'Active' ? 'var(--status-active)' : trailer.status === 'Spare' ? 'var(--status-spare)' : trailer.status === 'In Shop' ? 'var(--status-inshop)' : trailer.status === 'Retired' ? 'var(--status-retired)' : 'var(--accent)'}}></span>{trailer.status ? trailer.status : "---"}</td><td>{trailer.trailerType ? trailer.trailerType : "---"}</td><td>{(() => { const rating = Math.round(trailer.cleanlinessRating || 0); const stars = rating > 0 ? rating : 1; return Array.from({length: stars}).map((_, i) => <i key={i} className="fas fa-star" style={{color: 'var(--accent)'}}></i>) })()}</td><td>{LookupUtility.getTractorTruckNumber(tractors, trailer.assignedTractor) ? LookupUtility.getTractorTruckNumber(tractors, trailer.assignedTractor) : "---"}{LookupUtility.isIdAssignedToMultiple(trailers, 'assignedTractor', trailer.assignedTractor) && <span className="warning-badge"><i className="fas fa-exclamation-triangle"></i></span>}</td><td><div style={{display: 'flex', alignItems: 'center', gap: 12}}><button type="button" onClick={e => { e.stopPropagation(); setModalTrailerId(trailer.id); setModalTrailerNumber(trailer.trailerNumber || ''); setShowCommentModal(true) }} style={{background: 'transparent', border: 'none', padding: 0, display: 'inline-flex', alignItems: 'center', cursor: 'pointer'}} title="View comments"><i className="fas fa-comments" style={{color: 'var(--accent)', marginRight: 4}}></i><span>{commentsCount}</span></button><button type="button" onClick={e => { e.stopPropagation(); setModalTrailerId(trailer.id); setModalTrailerNumber(trailer.trailerNumber || ''); setShowIssueModal(true) }} style={{background: 'transparent', border: 'none', padding: 0, display: 'inline-flex', alignItems: 'center', cursor: 'pointer', marginLeft: 12}} title="View issues"><i className="fas fa-tools" style={{color: 'var(--accent)', marginRight: 4}}></i><span>{issuesCount}</span></button></div></td></tr> })}</tbody></table></div>
        return null
    }, [isLoading, filteredTrailers, viewMode, searchText, selectedPlant, typeFilter, tractors, plants, trailers])

    const showReset = (searchText || selectedPlant || (typeFilter && typeFilter !== 'All Types'))

    return (
        <div className="dashboard-container trailers-view">
            {selectedTrailer ? (
                <TrailerDetailView trailer={selectedTrailer} onClose={handleBackFromDetail}/>
            ) : (
                <>
                    <TopSection
                        title={title}
                        addButtonLabel="Add Trailer"
                        onAddClick={() => setShowAddSheet(true)}
                        searchInput={searchInput}
                        onSearchInputChange={v => { setSearchInput(v); debouncedSetSearchText(v) }}
                        onClearSearch={() => { setSearchInput(''); debouncedSetSearchText('') }}
                        searchPlaceholder="Search by trailer or tractor..."
                        viewMode={viewMode}
                        onViewModeChange={handleViewModeChange}
                        plants={plants}
                        regionPlantCodes={regionPlantCodes}
                        selectedPlant={selectedPlant}
                        onSelectedPlantChange={v => { setSelectedPlant(v); updatePreferences('trailerFilters', { ...preferences.trailerFilters, selectedPlant: v }) }}
                        statusFilter={typeFilter}
                        statusOptions={filterOptions}
                        onStatusFilterChange={v => { setTypeFilter(v); updatePreferences('trailerFilters', { ...preferences.trailerFilters, typeFilter: v }) }}
                        showReset={showReset}
                        onReset={() => { setSearchText(''); setSearchInput(''); setSelectedPlant(''); setTypeFilter(''); updatePreferences('trailerFilters', { ...preferences.trailerFilters, searchText: '', selectedPlant: '', typeFilter: '' }) }}
                        listHeaderLabels={['Plant','Trailer #','Status','Type','Cleanliness','Tractor','More']}
                        showListHeader={viewMode === 'list'}
                        listHeaderClassName="trailers-list-header-row"
                        forwardedRef={headerRef}
                    />
                    <div className="content-container">{content}</div>
                    {showAddSheet && <TrailerAddView plants={plants} onClose={() => setShowAddSheet(false)} onTrailerAdded={newTrailer => setTrailers([...trailers, newTrailer])}/>}
                    {showCommentModal && <TrailerCommentModal trailerId={modalTrailerId} trailerNumber={modalTrailerNumber} onClose={() => setShowCommentModal(false)}/>}
                    {showIssueModal && <TrailerIssueModal trailerId={modalTrailerId} trailerNumber={modalTrailerNumber} onClose={() => setShowIssueModal(false)}/>}
                </>
            )}
        </div>
    )
}

export default TrailersView
