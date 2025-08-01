import React, { useEffect, useState } from 'react';
import { usePreferences } from '../../../app/context/PreferencesContext';
import LoadingScreen from '../common/LoadingScreen';
import TrailerCard from './TrailerCard';
import TrailerOverview from './TrailerOverview';
import '../../styles/FilterStyles.css';
import './styles/TrailersView.css';
import { TrailerService } from "../../../services/TrailerService";
import { TrailerMaintenanceService } from "../../../services/TrailerMaintenanceService";
import { TrailerUtility } from "../../../utils/TrailerUtility";
import { PlantService } from "../../../services/PlantService";
import { TractorService } from "../../../services/TractorService";
import TrailerAddView from "./TrailerAddView";
import TrailerDetailView from "./TrailerDetailView";

function TrailersView({ title = 'Trailer Fleet', showSidebar, setShowSidebar, onSelectTrailer }) {
    const { preferences, resetTrailerFilters, saveLastViewedFilters, updatePreferences } = usePreferences();
    const [trailers, setTrailers] = useState([]);
    const [tractors, setTractors] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchText, setSearchText] = useState(preferences.trailerFilters?.searchText || '');
    const [selectedPlant, setSelectedPlant] = useState(preferences.trailerFilters?.selectedPlant || '');
    const [typeFilter, setTypeFilter] = useState(preferences.trailerFilters?.typeFilter || '');
    const [showAddSheet, setShowAddSheet] = useState(false);
    const [showOverview, setShowOverview] = useState(false);
    const [selectedTrailer, setSelectedTrailer] = useState(null);
    const [reloadTrailers, setReloadTrailers] = useState(false);
    const filterOptions = ['All Types', 'Cement', 'End Dump', 'Past Due Service', 'Verified', 'Not Verified', 'Open Issues'];

    useEffect(() => {
        async function fetchAllData() {
            setIsLoading(true);
            try {
                await Promise.all([fetchTrailers(), fetchTractors(), fetchPlants()]);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchAllData();
        if (preferences?.trailerFilters) {
            setSearchText(preferences.trailerFilters.searchText || '');
            setSelectedPlant(preferences.trailerFilters.selectedPlant || '');
            setTypeFilter(preferences.trailerFilters.typeFilter || '');
        }
    }, [preferences, reloadTrailers]);

    async function fetchTrailers() {
        try {
            const data = await TrailerService.fetchTrailers();
            const processedData = await Promise.all(data.map(async trailer => {
                let latestHistoryDate = null;
                try {
                    const history = await TrailerService.getTrailerHistory(trailer.id, 1);
                    latestHistoryDate = history[0]?.changedAt || null;
                } catch {}
                try {
                    const issues = await TrailerMaintenanceService.fetchIssues(trailer.id);
                    trailer.issues = issues || [];
                } catch {
                    trailer.issues = [];
                }
                trailer.isVerified = () => TrailerUtility.isVerified(trailer.updatedLast, trailer.updatedAt, trailer.updatedBy, latestHistoryDate);
                trailer.latestHistoryDate = latestHistoryDate;
                return trailer;
            }));
            setTrailers(processedData);
        } catch (error) {
            console.error('Error fetching trailers:', error);
        }
    }

    async function fetchTractors() {
        try {
            const data = await TractorService.fetchTractors();
            setTractors(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching tractors:', error);
            setTractors([]);
        }
    }

    async function fetchPlants() {
        try {
            const data = await PlantService.fetchPlants();
            setPlants(data);
        } catch (error) {
            console.error('Error fetching plants:', error);
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
            setTypeFilter('');
            updatePreferences(prev => ({
                ...prev,
                trailerFilters: {
                    ...prev.trailerFilters,
                    typeFilter: ''
                }
            }));
        } else {
            setTypeFilter(type);
            updatePreferences(prev => ({
                ...prev,
                trailerFilters: {
                    ...prev.trailerFilters,
                    typeFilter: type
                }
            }));
        }
        setShowOverview(false);
    }

    function handleBackFromDetail() {
        setSelectedTrailer(null);
        setReloadTrailers(r => !r);
    }

    const statusOrder = {
        'Active': 1,
        'Spare': 2,
        'In Shop': 3,
        'Retired': 4
    };

    const filteredTrailers = trailers
        .filter(trailer => {
            const matchesSearch = !searchText.trim() ||
                trailer.trailerNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
                (trailer.assignedTractor && tractors.find(t => t.id === trailer.assignedTractor)?.truckNumber.toLowerCase().includes(searchText.toLowerCase()));
            const matchesPlant = !selectedPlant || trailer.assignedPlant === selectedPlant;
            let matchesType = true;
            if (typeFilter && typeFilter !== 'All Types') {
                matchesType = ['Cement', 'End Dump'].includes(typeFilter) ? trailer.trailerType === typeFilter :
                    typeFilter === 'Past Due Service' ? TrailerUtility.isServiceOverdue(trailer.lastServiceDate) :
                        typeFilter === 'Verified' ? trailer.isVerified() :
                            typeFilter === 'Not Verified' ? !trailer.isVerified() :
                                typeFilter === 'Open Issues' ? trailer.issues?.some(issue => !issue.time_completed) : false;
            }
            return matchesSearch && matchesPlant && matchesType;
        })
        .sort((a, b) => {
            const statusA = statusOrder[a.status] || 99;
            const statusB = statusOrder[b.status] || 99;
            if (statusA !== statusB) return statusA - statusB;
            const aNum = parseInt(a.trailerNumber?.replace(/\D/g, '') || '0');
            const bNum = parseInt(b.trailerNumber?.replace(/\D/g, '') || '0');
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return (a.trailerNumber || '').localeCompare(b.trailerNumber || '');
        });

    const typeCounts = ['Cement', 'End Dump'].map(type => ({
        type,
        count: trailers.filter(t => t.trailerType === type).length
    }));
    const pastDueServiceCount = trailers.filter(t => TrailerUtility.isServiceOverdue(t.lastServiceDate)).length;
    const verifiedCount = trailers.filter(t => t.isVerified()).length;
    const unverifiedCount = trailers.length - verifiedCount;
    const neverVerifiedCount = trailers.filter(t => !t.updatedLast || !t.updatedBy).length;
    const openIssuesCount = trailers.filter(t => t.issues?.some(issue => !issue.time_completed)).length;

    function averageCleanliness() {
        const ratings = trailers.filter(t => t.cleanlinessRating).map(t => t.cleanlinessRating);
        return ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : 'Not Assigned';
    }

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
    );

    if (selectedTrailer) {
        return (
            <TrailerDetailView
                trailerId={selectedTrailer.id}
                onClose={handleBackFromDetail}
            />
        );
    }

    return (
        <div className="dashboard-container tractors-view">
            <div className="dashboard-header">
                <h1>{title}</h1>
                <div className="dashboard-actions">
                    <button
                        className="action-button primary rectangular-button"
                        onClick={() => setShowAddSheet(true)}
                        style={{ height: '44px', lineHeight: '1' }}
                    >
                        <i className="fas fa-plus" style={{ marginRight: '8px' }}></i> Add Trailer
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
                            setSearchText(e.target.value);
                            updatePreferences(prev => ({
                                ...prev,
                                trailerFilters: {
                                    ...prev.trailerFilters,
                                    searchText: e.target.value
                                }
                            }));
                        }}
                    />
                    {searchText && (
                        <button className="clear" onClick={() => {
                            setSearchText('');
                            updatePreferences(prev => ({
                                ...prev,
                                trailerFilters: {
                                    ...prev.trailerFilters,
                                    searchText: ''
                                }
                            }));
                        }}>
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                </div>
                <div className="filters">
                    <div className="filter-wrapper">
                        <select
                            className="ios-select"
                            value={selectedPlant}
                            onChange={e => {
                                setSelectedPlant(e.target.value);
                                updatePreferences(prev => ({
                                    ...prev,
                                    trailerFilters: {
                                        ...prev.trailerFilters,
                                        selectedPlant: e.target.value
                                    }
                                }));
                            }}
                            aria-label="Filter by plant"
                            style={{ '--select-active-border': preferences.accentColor === 'red' ? '#b80017' : '#003896', '--select-focus-border': preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                        >
                            <option value="">All Plants</option>
                            {plants.sort((a, b) => parseInt(a.plantCode?.replace(/\D/g, '') || '0') - parseInt(b.plantCode?.replace(/\D/g, '') || '0')).map(plant => (
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
                                setTypeFilter(e.target.value);
                                updatePreferences(prev => ({
                                    ...prev,
                                    trailerFilters: {
                                        ...prev.trailerFilters,
                                        typeFilter: e.target.value
                                    }
                                }));
                            }}
                            style={{ '--select-active-border': preferences.accentColor === 'red' ? '#b80017' : '#003896', '--select-focus-border': preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                        >
                            {filterOptions.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                    {(searchText || selectedPlant || (typeFilter && typeFilter !== 'All Types')) && (
                        <button className="filter-reset-button" onClick={() => {
                            setSearchText('');
                            setSelectedPlant('');
                            setTypeFilter('');
                            updatePreferences(prev => ({
                                ...prev,
                                trailerFilters: {
                                    ...prev.trailerFilters,
                                    searchText: '',
                                    selectedPlant: '',
                                    typeFilter: ''
                                }
                            }));
                        }}>
                            <i className="fas fa-undo"></i> Reset Filters
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
                        <LoadingScreen message="Loading trailers..." inline={true} />
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
                ) : (
                    <div className={`tractors-grid ${searchText ? 'search-results' : ''}`}>
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
                )}
            </div>
            {showAddSheet && (
                <TrailerAddView
                    plants={plants}
                    onClose={() => setShowAddSheet(false)}
                    onTrailerAdded={newTrailer => setTrailers([...trailers, newTrailer])}
                />
            )}
            {showOverview && <OverviewPopup />}
        </div>
    );
}

export default TrailersView;

