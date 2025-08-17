import React, {useEffect, useState} from 'react';
import {TrailerService} from '../../../services/TrailerService';
import {TrailerUtility} from '../../../utils/TrailerUtility';
import {PlantService} from '../../../services/PlantService';
import {supabase} from '../../../services/DatabaseService';
import LoadingScreen from '../common/LoadingScreen';
import './styles/TrailerOverview.css';

const TrailerOverview = ({
                             filteredTrailers = null,
                             selectedPlant = '',
                             onTypeClick
                         }) => {
    const [trailers, setTrailers] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [typeCounts, setTypeCounts] = useState({});
    const [plantCounts, setPlantCounts] = useState({});
    const [plantDistributionByType, setPlantDistributionByType] = useState({});
    const [cleanlinessAvg, setCleanlinessAvg] = useState(0);
    const [needServiceCount, setNeedServiceCount] = useState(0);
    const [openMaintenanceIssues, setOpenMaintenanceIssues] = useState(0);
    const [verifiedCount, setVerifiedCount] = useState(0);
    const [notVerifiedCount, setNotVerifiedCount] = useState(0);
    const [statusCounts, setStatusCounts] = useState({});

    useEffect(() => {
        fetchData();
    }, [filteredTrailers]);

    useEffect(() => {
        if (filteredTrailers) {
            updateStatistics(filteredTrailers);
        }
    }, [filteredTrailers]);

    const updateStatistics = (trailersData) => {
        const statsTrailers = filteredTrailers || trailersData;
        const typeCounts = TrailerUtility.getStatusCounts(statsTrailers);
        setTypeCounts(typeCounts);
        setPlantCounts(TrailerUtility.getPlantCounts(statsTrailers));
        setCleanlinessAvg(TrailerUtility.getCleanlinessAverage(statsTrailers));
        setNeedServiceCount(TrailerUtility.getNeedServiceCount(statsTrailers));
        const verified = statsTrailers.filter(trailer => {
            return TrailerUtility.isVerified(trailer.updatedLast, trailer.updatedAt, trailer.updatedBy);
        }).length;
        const notVerified = statsTrailers.length - verified;
        setVerifiedCount(verified);
        setNotVerifiedCount(notVerified);
        calculatePlantDistributionByType(statsTrailers);
        setTypeCounts(prev => ({...prev, Total: statsTrailers.length}));
        let filteredForIssues = statsTrailers;
        if (selectedPlant) {
            filteredForIssues = statsTrailers.filter(trailer => trailer.assignedPlant === selectedPlant);
        }
        setOpenMaintenanceIssues(
            filteredForIssues.filter(trailer =>
                trailer.issues?.some(issue => !issue.time_completed)
            ).length
        );
        setStatusCounts(TrailerUtility.getStatusCountsByStatus(statsTrailers));
    };

    const calculatePlantDistributionByType = (trailersData) => {
        const distribution = {};
        const uniquePlants = [...new Set(trailersData.map(trailer => trailer.assignedPlant || 'Unassigned'))];
        uniquePlants.forEach(plant => {
            distribution[plant] = {
                Total: 0,
                Cement: 0,
                'End Dump': 0
            };
        });
        trailersData.forEach(trailer => {
            const plant = trailer.assignedPlant || 'Unassigned';
            const type = trailer.trailerType || 'Unknown';
            distribution[plant].Total++;
            if (['Cement', 'End Dump'].includes(type)) {
                distribution[plant][type]++;
            } else {
                distribution[plant].Cement++;
            }
        });
        setPlantDistributionByType(distribution);
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const trailersData = await TrailerService.fetchTrailers();
            let maintenanceIssues = [];
            try {
                const {data, error} = await supabase
                    .from('trailers_maintenance')
                    .select('id, trailer_id, time_completed');
                if (!error) {
                    maintenanceIssues = data || [];
                }
            } catch (maintenanceError) {
            }
            const trailersWithMaintenance = trailersData.map(trailer => ({
                ...trailer,
                issues: maintenanceIssues.filter(issue => issue.trailer_id === trailer.id)
            }));
            setTrailers(trailersWithMaintenance);
            const plantsData = await PlantService.fetchPlants();
            setPlants(plantsData);
            if (!filteredTrailers) {
                updateStatistics(trailersWithMaintenance);
            }
        } catch (error) {
        } finally {
            setIsLoading(false);
        }
    };

    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plantCode === plantCode);
        return plant ? plant.plantName : plantCode || 'Unassigned';
    };

    if (isLoading) {
        return (
            <div className="tractor-overview">
                <LoadingScreen message="Loading trailer data..." inline={true}/>
            </div>
        );
    }

    return (
        <div className="tractor-overview">
            {filteredTrailers && trailers.length !== filteredTrailers.length && (
                <div style={{textAlign: 'center', marginBottom: '10px'}}>
                    <span className="filtered-indicator">(Filtered: {filteredTrailers.length}/{trailers.length})</span>
                </div>
            )}
            {filteredTrailers && (
                <div style={{textAlign: 'center', marginBottom: '15px'}}>
                    <div className="filter-indicator">
                        Showing statistics
                        for {filteredTrailers.length} trailer{filteredTrailers.length !== 1 ? 's' : ''}
                    </div>
                </div>
            )}
            <div className="overview-grid">
                <div className="overview-card status-card">
                    <h2>Type Overview</h2>
                    <div className="status-grid">
                        <div
                            className="status-item clickable"
                            onClick={() => onTypeClick && onTypeClick('All Types')}
                            tabIndex={0}
                            role="button"
                            style={{cursor: 'pointer'}}
                        >
                            <div className="status-count">{typeCounts.Total || 0}</div>
                            <div className="status-label">Total Trailers</div>
                        </div>
                        <div
                            className="status-item clickable"
                            onClick={() => onTypeClick && onTypeClick('Cement')}
                            tabIndex={0}
                            role="button"
                            style={{cursor: 'pointer'}}
                        >
                            <div className="status-count">{typeCounts.Cement || 0}</div>
                            <div className="status-label">Cement</div>
                        </div>
                        <div
                            className="status-item clickable"
                            onClick={() => onTypeClick && onTypeClick('End Dump')}
                            tabIndex={0}
                            role="button"
                            style={{cursor: 'pointer'}}
                        >
                            <div className="status-count">{typeCounts['End Dump'] || 0}</div>
                            <div className="status-label">End Dump</div>
                        </div>
                        <div
                            className="status-item clickable"
                            onClick={() => onTypeClick && onTypeClick('Verified')}
                            tabIndex={0}
                            role="button"
                            style={{cursor: 'pointer'}}
                        >
                            <div className="status-count">{verifiedCount}</div>
                            <div className="status-label">Verified</div>
                        </div>
                        <div
                            className="status-item clickable"
                            onClick={() => onTypeClick && onTypeClick('Not Verified')}
                            tabIndex={0}
                            role="button"
                            style={{cursor: 'pointer'}}
                        >
                            <div className="status-count">{notVerifiedCount}</div>
                            <div className="status-label">Not Verified</div>
                        </div>
                    </div>
                    <div className="status-grid" style={{marginTop: 16}}>
                        <div className="status-item">
                            <div className="status-count">{statusCounts.Active || 0}</div>
                            <div className="status-label">Active</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{statusCounts.Spare || 0}</div>
                            <div className="status-label">Spare</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{statusCounts['In Shop'] || 0}</div>
                            <div className="status-label">In Shop</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{statusCounts.Retired || 0}</div>
                            <div className="status-label">Retired</div>
                        </div>
                    </div>
                </div>
                <div className="overview-card maintenance-card">
                    <h2>Maintenance</h2>
                    <div className="maintenance-stats">
                        <div className="maintenance-stat">
                            <div className="stat-icon">
                                <i className="fas fa-tools"></i>
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{needServiceCount}</div>
                                <div className="stat-label">Need Service</div>
                            </div>
                        </div>
                        <div className="maintenance-stat">
                            <div className="stat-icon">
                                <i className="fas fa-star"></i>
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{cleanlinessAvg}</div>
                                <div className="stat-label">Avg. Cleanliness</div>
                            </div>
                        </div>
                        <div className="maintenance-stat">
                            <div className="stat-icon">
                                <i className="fas fa-exclamation-triangle"></i>
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{openMaintenanceIssues}</div>
                                <div className="stat-label">Open Issues</div>
                            </div>
                        </div>
                    </div>
                </div>
                {(!selectedPlant || Object.keys(plantCounts).length > 1) && (
                    <div className="overview-card plant-card">
                        <h2 style={{marginLeft: 10}}>Plant Distribution</h2>
                        <div className="plant-distribution-table">
                            <table className="distribution-table">
                                <thead>
                                <tr>
                                    <th>Plant</th>
                                    <th>Total</th>
                                    <th>Cement</th>
                                    <th>End Dump</th>
                                </tr>
                                </thead>
                                <tbody>
                                {Object.entries(plantDistributionByType).map(([plantCode, counts]) => (
                                    <tr key={plantCode}>
                                        <td className="plant-name">{getPlantName(plantCode)}</td>
                                        <td>{counts.Total || 0}</td>
                                        <td>{counts.Cement || 0}</td>
                                        <td>{counts['End Dump'] || 0}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TrailerOverview;