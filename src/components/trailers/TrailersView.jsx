import React, {useEffect, useState} from 'react';
import {usePreferences} from '../../app/context/PreferencesContext';
import LoadingScreen from '../common/LoadingScreen';
import TrailerCard from './TrailerCard';
import TrailerOverview from './TrailerOverview';
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

function TrailersView({title = 'Trailer Fleet', onSelectTrailer}) {
    const { preferences, saveLastViewedFilters, updateTrailerFilter, updatePreferences } = usePreferences()
    const [trailers, setTrailers] = useState([])
    const [tractors, setTractors] = useState([])
    const [plants, setPlants] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchText, setSearchText] = useState(preferences.trailerFilters?.searchText || '')
    const [selectedPlant, setSelectedPlant] = useState(preferences.trailerFilters?.selectedPlant || '')
    const [typeFilter, setTypeFilter] = useState(preferences.trailerFilters?.typeFilter || '')
    const [viewMode, setViewMode] = useState(() => {
        if (preferences.trailerFilters?.viewMode !== undefined && preferences.trailerFilters?.viewMode !== null) return preferences.trailerFilters.viewMode
        if (preferences.defaultViewMode !== undefined && preferences.defaultViewMode !== null) return preferences.defaultViewMode
        const lastUsed = localStorage.getItem('trailers_last_view_mode')
        return lastUsed || 'grid'
    })
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [showOverview, setShowOverview] = useState(false)
    const [selectedTrailer, setSelectedTrailer] = useState(null)
    const [reloadTrailers, setReloadTrailers] = useState(false)
    const [showIssueModal, setShowIssueModal] = useState(false)
    const [showCommentModal, setShowCommentModal] = useState(false)
    const [modalTrailerId, setModalTrailerId] = useState(null)
    const [modalTrailerNumber, setModalTrailerNumber] = useState('')
    const [regionPlantCodes, setRegionPlantCodes] = useState(null)
    const filterOptions = ['All Types', 'Cement', 'End Dump', 'Past Due Service', 'Verified', 'Not Verified', 'Open Issues']

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
            setSelectedPlant(preferences.trailerFilters.selectedPlant || '')
            setTypeFilter(preferences.trailerFilters.typeFilter || '')
            setViewMode(preferences.trailerFilters.viewMode || preferences.defaultViewMode || 'grid')
        }
        if (preferences?.autoOverview) setShowOverview(true)
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
                const codes = new Set(regionPlants.map(p => p.plantCode))
                setRegionPlantCodes(codes)
                if (selectedPlant && !codes.has(selectedPlant)) {
                    setSelectedPlant('')
                    updatePreferences('trailerFilters', {
                        ...preferences.trailerFilters,
                        selectedPlant: ''
                    })
                }
            } catch {
                setRegionPlantCodes(new Set())
            }
        }
        loadRegionPlants()
        return () => {
            cancelled = true
        }
    }, [preferences.selectedRegion?.code])

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
            const processed = data.map(t => {
                const trailer = {...t}
                trailer.isVerified = () => TrailerUtility.isVerified(trailer.updatedLast, trailer.updatedAt, trailer.updatedBy, trailer.latestHistoryDate)
                return trailer
            })
            setTrailers(processed)
        } catch {
        }
    }

    async function fetchTractors() {
        try {
            const data = await TractorService.fetchTractors();
            setTractors(Array.isArray(data) ? data : []);
        } catch {
            setTractors([]);
        }
    }

    async function fetchPlants() {
        try {
            const data = await PlantService.fetchPlants();
            setPlants(data);
        } catch {
        }
    }

    function getTractorNumber(tractorId) {
        if (!tractorId) return 'None';
        const tractor = tractors.find(t => t.id === tractorId);
        return tractor ? tractor.truckNumber : 'Unknown';
    }

    function getPlantName(plantCode) {
        const plant = plants.find(p => p.plantCode === plantCode);
        return plant ? plant.plantName : plantCode || 'No Plant';
    }

    function isTractorAssignedToMultipleTrailers(tractorId) {
        return tractorId && trailers.filter(t => t.assignedTractor === tractorId).length > 1;
    }

    function handleSelectTrailer(trailerId) {
        saveLastViewedFilters();
        const trailerObj = trailers.find(t => t.id === trailerId);
        setSelectedTrailer(trailerObj);
        if (onSelectTrailer) onSelectTrailer(trailerId);
    }

    function handleTypeClick(type) {
        if (type === 'All Types') {
            setTypeFilter('')
            updatePreferences(prev => ({
                ...prev,
                trailerFilters: {
                    ...prev.trailerFilters,
                    typeFilter: ''
                }
            }))
        } else {
            setTypeFilter(type)
            updatePreferences(prev => ({
                ...prev,
                trailerFilters: {
                    ...prev.trailerFilters,
                    typeFilter: type
                }
            }))
        }
        setShowOverview(false)
    }

    function handleBackFromDetail() {
        setSelectedTrailer(null)
        setReloadTrailers(r => !r)
    }

    function formatDate(dateStr) {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return ''
        const pad = n => n.toString().padStart(2, '0')
        const yyyy = date.getFullYear()
        const mm = pad(date.getMonth() + 1)
        const dd = pad(date.getDate())
        const hh = pad(date.getHours())
        const min = pad(date.getMinutes())
        return `${mm}/${dd}/${yyyy} ${hh}:${min}`
    }

    function getFiltersAppliedString() {
        const filters = []
        if (searchText) filters.push(`Search: ${searchText}`)
        if (selectedPlant) {
            const plant = plants.find(p => p.plantCode === selectedPlant)
            filters.push(`Plant: ${plant ? plant.plantName : selectedPlant}`)
        }
        if (typeFilter && typeFilter !== 'All Types') filters.push(`Type: ${typeFilter}`)
        return filters.length ? filters.join(', ') : 'No Filters'
    }

    function exportTrailersToCSV(trailersToExport) {
        if (!trailersToExport || trailersToExport.length === 0) return
        const now = new Date()
        const pad = n => n.toString().padStart(2, '0')
        const yyyy = now.getFullYear()
        const mm = pad(now.getMonth() + 1)
        const dd = pad(now.getDate())
        const hh = pad(now.getHours())
        const min = pad(now.getMinutes())
        const formattedNow = `${mm}-${dd}-${yyyy} ${hh}-${min}`
        const filtersApplied = getFiltersAppliedString()
        const fileName = `Trailer Export - ${formattedNow} - ${filtersApplied}.csv`
        const topHeader = `Trailer Export - ${formattedNow} - ${filtersApplied}`
        const headers = [
            'Trailer Number',
            'Status',
            'Trailer Type',
            'Assigned Tractor',
            'Assigned Plant',
            'Last Service Date',
            'Cleanliness Rating',
            'Open Issues'
        ]
        const rows = trailersToExport.map(trailer => [
            trailer.trailerNumber || '',
            trailer.status || '',
            trailer.trailerType || '',
            getTractorNumber(trailer.assignedTractor),
            getPlantName(trailer.assignedPlant),
            formatDate(trailer.lastServiceDate),
            trailer.cleanlinessRating || '',
            Number(trailer.openIssuesCount || 0)
        ])
        const csvContent = [
            `"${topHeader}"`,
            headers.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','),
            ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        ].join('\n')
        const blob = new Blob([csvContent], {type: 'text/csv'})
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const statusOrder = { 'Active': 1, 'Spare': 2, 'In Shop': 3, 'Retired': 4 }

    const filteredTrailers = trailers
        .filter(trailer => {
            const matchesSearch = !searchText.trim() ||
                trailer.trailerNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
                (trailer.assignedTractor && tractors.find(t => t.id === trailer.assignedTractor)?.truckNumber.toLowerCase().includes(searchText.toLowerCase()))
            const matchesPlant = !selectedPlant || trailer.assignedPlant === selectedPlant
            const matchesRegion = !preferences.selectedRegion?.code || !regionPlantCodes || regionPlantCodes.has(trailer.assignedPlant)
            let matchesType = true
            if (typeFilter && typeFilter !== 'All Types') {
                matchesType = ['Cement', 'End Dump'].includes(typeFilter) ? trailer.trailerType === typeFilter :
                    typeFilter === 'Past Due Service' ? TrailerUtility.isServiceOverdue(trailer.lastServiceDate) :
                        typeFilter === 'Verified' ? trailer.isVerified() :
                            typeFilter === 'Not Verified' ? !trailer.isVerified() :
                                typeFilter === 'Open Issues' ? (Number(trailer.openIssuesCount || 0) > 0) : false
            }
            return matchesSearch && matchesPlant && matchesRegion && matchesType
        })
        .sort((a, b) => {
            const statusA = statusOrder[a.status] || 99
            const statusB = statusOrder[b.status] || 99
            if (statusA !== statusB) return statusA - statusB
            const aNum = parseInt(a.trailerNumber?.replace(/\D/g, '') || '0')
            const bNum = parseInt(b.trailerNumber?.replace(/\D/g, '') || '0')
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
            return (a.trailerNumber || '').localeCompare(b.trailerNumber || '')
        })
    ;['Cement', 'End Dump'].map(type => ({ type, count: trailers.filter(t => t.trailerType === type).length }))
    trailers.filter(t => TrailerUtility.isServiceOverdue(t.lastServiceDate)).length
    trailers.filter(t => t.isVerified()).length
    trailers.filter(t => !t.updatedLast || !t.updatedBy).length
    trailers.filter(t => Number(t.openIssuesCount || 0) > 0).length

    const OverviewPopup = () => (
        <div className="modal-backdrop" onClick={() => setShowOverview(false)}>
            <div className="modal-content overview-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Trailers Overview</h2>
                    <button className="close-button" onClick={() => setShowOverview(false)}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <TrailerOverview
                        filteredTrailers={filteredTrailers}
                        selectedPlant={selectedPlant}
                        onTypeClick={handleTypeClick}
                    />
                </div>
                <div className="modal-footer">
                    <button className="primary-button" onClick={() => setShowOverview(false)}>Close</button>
                </div>
            </div>
        </div>
    )

    if (selectedTrailer) {
        return (
            <TrailerDetailView
                trailer={selectedTrailer}
                onClose={handleBackFromDetail}
            />
        )
    }

    return (
        <div className="dashboard-container trailers-view">
            <div className="dashboard-header">
                <h1>{title}</h1>
                <div className="dashboard-actions">
                    <button
                        className="action-button primary rectangular-button"
                        style={{marginRight: 8, minWidth: 210}}
                        onClick={() => exportTrailersToCSV(filteredTrailers)}
                    >
                        <i className="fas fa-file-export" style={{marginRight: 8}}></i> Export
                    </button>
                    <button
                        className="action-button primary rectangular-button"
                        onClick={() => setShowAddSheet(true)}
                        style={{height: '44px', lineHeight: '1'}}
                    >
                        <i className="fas fa-plus" style={{marginRight: '8px'}}></i> Add Trailer
                    </button>
                </div>
            </div>
            <div className="search-filters">
                <div className="search-bar">
                    <input
                        type="text"
                        className="ios-search-input"
                        placeholder="Search by trailer or tractor..."
                        value={searchText}
                        onChange={e => {
                            setSearchText(e.target.value)
                            updatePreferences(prev => ({
                                ...prev,
                                trailerFilters: {
                                    ...prev.trailerFilters,
                                    searchText: e.target.value
                                }
                            }))
                        }}
                    />
                    {searchText && (
                        <button className="clear" onClick={() => {
                            setSearchText('')
                            updatePreferences(prev => ({
                                ...prev,
                                trailerFilters: {
                                    ...prev.trailerFilters,
                                    searchText: ''
                                }
                            }))
                        }}>
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                </div>
                <div className="filters">
                    <div className="view-toggle-icons">
                        <button
                            className={`view-toggle-btn${viewMode === 'grid' ? ' active' : ''}`}
                            onClick={() => handleViewModeChange('grid')}
                            aria-label="Grid view"
                            type="button"
                        >
                            <i className="fas fa-th-large"></i>
                        </button>
                        <button
                            className={`view-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
                            onClick={() => handleViewModeChange('list')}
                            aria-label="List view"
                            type="button"
                        >
                            <i className="fas fa-list"></i>
                        </button>
                    </div>
                    <div className="filter-wrapper">
                        <select
                            className="ios-select"
                            value={selectedPlant}
                            onChange={e => {
                                setSelectedPlant(e.target.value)
                                updatePreferences('trailerFilters', {
                                    ...preferences.trailerFilters,
                                    selectedPlant: e.target.value
                                })
                            }}
                            aria-label="Filter by plant"
                        >
                            <option value="">All Plants</option>
                            {plants
                                .filter(p => !preferences.selectedRegion?.code || !regionPlantCodes || regionPlantCodes.has(p.plantCode))
                                .sort((a, b) => parseInt(a.plantCode?.replace(/\D/g, '') || '0') - parseInt(b.plantCode?.replace(/\D/g, '') || '0')).map(plant => (
                                <option key={plant.plantCode} value={plant.plantCode}>
                                    ({plant.plantCode}) {plant.plantName}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="filter-wrapper">
                        <select
                            className="ios-select"
                            value={typeFilter}
                            onChange={e => {
                                setTypeFilter(e.target.value)
                                updatePreferences('trailerFilters', {
                                    ...preferences.trailerFilters,
                                    typeFilter: e.target.value
                                })
                            }}
                        >
                            {filterOptions.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                    {(searchText || selectedPlant || (typeFilter && typeFilter !== 'All Types')) && (
                        <button className="filter-reset-button" onClick={() => {
                            setSearchText('')
                            setSelectedPlant('')
                            setTypeFilter('')
                            updatePreferences('trailerFilters', {
                                ...preferences.trailerFilters,
                                searchText: '',
                                selectedPlant: '',
                                typeFilter: ''
                            })
                        }}>
                            <i className="fas fa-undo"></i>
                        </button>
                    )}
                    <button className="ios-button" onClick={() => setShowOverview(true)}>
                        <i className="fas fa-chart-bar"></i> Overview
                    </button>
                </div>
            </div>
            <div className="content-container">
                {isLoading ? (
                    <div className="loading-container">
                        <LoadingScreen message="Loading trailers..." inline={true}/>
                    </div>
                ) : filteredTrailers.length === 0 ? (
                    <div className="no-results-container">
                        <div className="no-results-icon">
                            <i className="fas fa-trailer"></i>
                        </div>
                        <h3>No Trailers Found</h3>
                        <p>{searchText || selectedPlant || (typeFilter && typeFilter !== 'All Types') ? "No trailers match your search criteria." : "There are no trailers in the system yet."}</p>
                        <button className="primary-button" onClick={() => setShowAddSheet(true)}>Add Trailer</button>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className={`trailers-grid ${searchText ? 'search-results' : ''}`}>
                        {filteredTrailers.map(trailer => (
                            <TrailerCard
                                key={trailer.id}
                                trailer={trailer}
                                tractorName={getTractorNumber(trailer.assignedTractor)}
                                plantName={getPlantName(trailer.assignedPlant)}
                                showTractorWarning={isTractorAssignedToMultipleTrailers(trailer.assignedTractor)}
                                onSelect={() => handleSelectTrailer(trailer.id)}
                            />
                        ))}
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="trailers-list-table-container">
                        <table className="trailers-list-table">
                            <thead>
                            <tr>
                                <th>Plant</th>
                                <th>Trailer #</th>
                                <th>Status</th>
                                <th>Type</th>
                                <th>Cleanliness</th>
                                <th>Tractor</th>
                                <th>More</th>
                            </tr>
                            </thead>
                            <tbody>
                            {filteredTrailers.map(trailer => {
                                const commentsCount = Number(trailer.commentsCount || 0)
                                const issuesCount = Number(trailer.openIssuesCount || 0)
                                return (
                                    <tr key={trailer.id} onClick={() => handleSelectTrailer(trailer.id)}
                                        style={{cursor: 'pointer'}}>
                                        <td>{trailer.assignedPlant ? trailer.assignedPlant : "---"}</td>
                                        <td>{trailer.trailerNumber ? trailer.trailerNumber : "---"}</td>
                                        <td>
                                                <span
                                                    className="item-status-dot"
                                                    style={{
                                                        display: 'inline-block',
                                                        verticalAlign: 'middle',
                                                        marginRight: '8px',
                                                        backgroundColor:
                                                            trailer.status === 'Active' ? 'var(--status-active)' :
                                                                trailer.status === 'Spare' ? 'var(--status-spare)' :
                                                                    trailer.status === 'In Shop' ? 'var(--status-inshop)' :
                                                                        trailer.status === 'Retired' ? 'var(--status-retired)' :
                                                                            'var(--accent)',
                                                    }}
                                                ></span>
                                            {trailer.status ? trailer.status : "---"}
                                        </td>
                                        <td>{trailer.trailerType ? trailer.trailerType : "---"}</td>
                                        <td>
                                            {(() => {
                                                const rating = Math.round(trailer.cleanlinessRating || 0)
                                                const stars = rating > 0 ? rating : 1
                                                return Array.from({length: stars}).map((_, i) => (
                                                    <i key={i} className="fas fa-star"
                                                       style={{color: 'var(--accent)'}}></i>
                                                ))
                                            })()}
                                        </td>
                                        <td>
                                            {getTractorNumber(trailer.assignedTractor) ? getTractorNumber(trailer.assignedTractor) : "---"}
                                            {isTractorAssignedToMultipleTrailers(trailer.assignedTractor) && (
                                                <span className="warning-badge">
                                                        <i className="fas fa-exclamation-triangle"></i>
                                                    </span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setModalTrailerId(trailer.id)
                                                        setModalTrailerNumber(trailer.trailerNumber || '')
                                                        setShowCommentModal(true)
                                                    }}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        padding: 0,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        cursor: 'pointer'
                                                    }}
                                                    title="View comments"
                                                >
                                                    <i className="fas fa-comments"
                                                       style={{color: 'var(--accent)', marginRight: 4}}></i>
                                                    <span>{commentsCount}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setModalTrailerId(trailer.id)
                                                        setModalTrailerNumber(trailer.trailerNumber || '')
                                                        setShowIssueModal(true)
                                                    }}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        padding: 0,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        cursor: 'pointer',
                                                        marginLeft: 12
                                                    }}
                                                    title="View issues"
                                                >
                                                    <i className="fas fa-tools"
                                                       style={{color: 'var(--accent)', marginRight: 4}}></i>
                                                    <span>{issuesCount}</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="no-results-container">
                        <div className="no-results-icon">
                            <i className="fas fa-trailer"></i>
                        </div>
                        <h3>No Trailers Found</h3>
                        <p>{searchText || selectedPlant || (typeFilter && typeFilter !== 'All Types') ? "No trailers match your search criteria." : "There are no trailers in the system yet."}</p>
                        <button className="primary-button" onClick={() => setShowAddSheet(true)}>Add Trailer</button>
                    </div>
                )}
            </div>
            {showAddSheet && (
                <TrailerAddView
                    plants={plants}
                    onClose={() => setShowAddSheet(false)}
                    onTrailerAdded={newTrailer => setTrailers([...trailers, newTrailer])}
                />
            )}
            {showOverview && <OverviewPopup/>}
            {showCommentModal && (
                <TrailerCommentModal
                    trailerId={modalTrailerId}
                    trailerNumber={modalTrailerNumber}
                    onClose={() => setShowCommentModal(false)}
                />
            )}
            {showIssueModal && (
                <TrailerIssueModal
                    trailerId={modalTrailerId}
                    trailerNumber={modalTrailerNumber}
                    onClose={() => setShowIssueModal(false)}
                />
            )}
        </div>
    )
}

export default TrailersView
