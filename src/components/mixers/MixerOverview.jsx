import React, {useEffect, useState} from 'react';
import {MixerService} from '../../services/mixers/MixerService';
import {MixerUtils} from '../../utils/MixerUtils';
import {PlantService} from '../../services/plants/PlantService';
import {OperatorService} from '../../services/operators/OperatorService';
import CleanlinessHistoryChart from './CleanlinessHistoryChart';
import {supabase} from '../../core/clients/SupabaseClient';
import './MixerOverview.css';

const MixerOverview = ({filteredMixers = null, selectedPlant = '', unverifiedCount = 0, neverVerifiedCount = 0}) => {
    const [mixers, setMixers] = useState([]);
    const [plants, setPlants] = useState([]);
    const [operators, setOperators] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusCounts, setStatusCounts] = useState({});
    const [plantCounts, setPlantCounts] = useState({});
    const [plantDistributionByStatus, setPlantDistributionByStatus] = useState({});
    const [trainingCount, setTrainingCount] = useState(0);
    const [trainersCount, setTrainersCount] = useState(0);
    const [cleanlinessAvg, setCleanlinessAvg] = useState(0);
    const [needServiceCount, setNeedServiceCount] = useState(0);
    const [openMaintenanceIssues, setOpenMaintenanceIssues] = useState(0);
    const [verifiedCount, setVerifiedCount] = useState(0);
    const [notVerifiedCount, setNotVerifiedCount] = useState(0);

    useEffect(() => {
        fetchData();
    }, [filteredMixers]);

    // Recalculate statistics when filtered mixers or operators change
    useEffect(() => {
        if (filteredMixers && operators.length > 0) {
            updateStatistics(filteredMixers);
        }
    }, [filteredMixers, operators]);

    const updateStatistics = (mixersData) => {
        const statusCounts = MixerUtils.getStatusCounts(mixersData);
        setStatusCounts(statusCounts);
        setPlantCounts(MixerUtils.getPlantCounts(mixersData));
        setCleanlinessAvg(MixerUtils.getCleanlinessAverage(mixersData));
        setNeedServiceCount(MixerUtils.getNeedServiceCount(mixersData));

        // Calculate verification counts
        const verified = mixersData.filter(mixer => {
            return MixerUtils.isVerified(mixer.updatedLast, mixer.updatedAt, mixer.updatedBy);
        }).length;
        const notVerified = mixersData.length - verified;
        setVerifiedCount(verified);
        setNotVerifiedCount(notVerified);

        // Get all unique operators assigned to mixers
        const assignedOperatorIds = new Set();
        mixersData
            .filter(mixer => mixer.assignedOperator && mixer.assignedOperator !== '0')
            .forEach(mixer => assignedOperatorIds.add(mixer.assignedOperator));

        // Find all assigned operators
        const assignedOperators = operators.filter(op => assignedOperatorIds.has(op.employeeId));

        // Count operators in training (those with an assigned trainer that isn't '0')
        const trainingCount = assignedOperators.filter(op => op.assignedTrainer && op.assignedTrainer !== '0').length;
        // Count trainers (operators with isTrainer === true)
        const trainersCount = assignedOperators.filter(op => op.isTrainer === true).length;

        // Set the counts
        setTrainingCount(trainingCount);
        setTrainersCount(trainersCount);

        // Update plant distribution
        calculatePlantDistributionByStatus(mixersData);
    };

    const calculatePlantDistributionByStatus = (mixersData) => {
        const distribution = {};

        // Get unique plants
        const uniquePlants = [...new Set(mixersData.map(mixer => mixer.assignedPlant || 'Unassigned'))];

        // Initialize structure
        uniquePlants.forEach(plant => {
            distribution[plant] = {
                Total: 0,
                Active: 0,
                Spare: 0,
                'In Shop': 0,
                Retired: 0
            };
        });

        // Count mixers by plant and status
        mixersData.forEach(mixer => {
            const plant = mixer.assignedPlant || 'Unassigned';
            const status = mixer.status || 'Unknown';

            // Increment total count
            distribution[plant].Total++;

            // Increment status-specific count
            if (['Active', 'Spare', 'In Shop', 'Retired'].includes(status)) {
                distribution[plant][status]++;
            } else {
                // Default to active if status is not recognized
                distribution[plant].Active++;
            }
        });

        // No longer counting operators by training status and trainer role

        setPlantDistributionByStatus(distribution);
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch mixers and plants
            const mixersData = await MixerService.getAllMixers();
            console.log('MixerOverview: Fetched mixers:', mixersData?.length || 0);

            // Fetch maintenance issues count
            try {
                const { data, error } = await supabase
                    .from('mixers_maintenance')
                    .select('id')
                    .is('time_completed', null);

                if (!error) {
                    setOpenMaintenanceIssues(data?.length || 0);
                }
            } catch (maintenanceError) {
                console.error('Error fetching maintenance issues:', maintenanceError);
            }

            setMixers(mixersData);

            const plantsData = await PlantService.fetchPlants();
            setPlants(plantsData);

            // Fetch operators directly from database for more reliable data
            try {
                // Get all operators from database
                const { data: operatorsRawData, error: operatorsError } = await supabase
                    .from('operators')
                    .select('*');

                if (operatorsError) throw operatorsError;

                // Map raw data to operator objects
                const operatorsData = operatorsRawData.map(op => ({
                    employeeId: op.employee_id,
                    smyrnaId: op.smyrna_id || '',
                    name: op.name,
                    plantCode: op.plant_code,
                    status: op.status,
                    isTrainer: op.is_trainer === true, // Ensure boolean
                    assignedTrainer: op.assigned_trainer,
                    position: op.position
                }));

                // Simply store the operators - updateStatistics will handle the counting
                setOperators(operatorsData || []);
            } catch (operatorsError) {
                console.error('Error fetching operators:', operatorsError);
            }

            // If no filtered mixers are provided, use all mixers for statistics
            if (!filteredMixers) {
                updateStatistics(mixersData);
            }
        } catch (error) {
            console.error('Error fetching overview data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plantCode === plantCode);
        return plant ? plant.plantName : plantCode;
    };

    if (isLoading) {
        return (
            <div className="mixer-overview">
                <h1>Mixer Fleet Overview</h1>
                <div className="loading-spinner"></div>
            </div>
        );
    }

    return (
        <div className="mixer-overview">
            <h1>
                Mixer Fleet Overview
            </h1>
            {filteredMixers && mixers.length !== filteredMixers.length && (
                <div style={{textAlign: 'center', marginBottom: '10px'}}>
                    <span className="filtered-indicator">(Filtered: {filteredMixers.length}/{mixers.length})</span>
                </div>
            )}
            {filteredMixers && (
                <div style={{textAlign: 'center', marginBottom: '15px'}}>
                    <div className="filter-indicator">
                        Showing statistics for {filteredMixers.length} mixer{filteredMixers.length !== 1 ? 's' : ''}
                    </div>
                </div>
            )}

            <div className="overview-grid">
                {/* Status Card */}
                <div className="overview-card status-card">
                    <h2>Status Overview</h2>
                    <div className="status-grid">
                        <div className="status-item">
                            <div className="status-count">{statusCounts.Total || 0}</div>
                            <div className="status-label">Total Mixers</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{statusCounts.Active || 0}</div>
                            <div className="status-label">Active</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{statusCounts['In Shop'] || 0}</div>
                            <div className="status-label">In Shop</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{statusCounts.Spare || 0}</div>
                            <div className="status-label">Spare</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{statusCounts.Retired || 0}</div>
                            <div className="status-label">Retired</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{verifiedCount}</div>
                            <div className="status-label">Verified</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{notVerifiedCount}</div>
                            <div className="status-label">Not Verified</div>
                        </div>
                    </div>
                </div>

                {/* Maintenance Card */}
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

                {/* Plant Distribution Card - only show if no specific plant is selected or multiple plants are present */}
                {(!selectedPlant || Object.keys(plantCounts).length > 1) && (
                    <div className="overview-card plant-card">
                        <h2>Plant Distribution</h2>
                        <div className="plant-distribution-table">
                            <table className="distribution-table">
                                <thead>
                                <tr>
                                    <th>Plant</th>
                                    <th>Total</th>
                                    <th>Active</th>
                                    <th>Spare</th>
                                    <th>In Shop</th>
                                    <th>Retired</th>
                                </tr>
                                </thead>
                                <tbody>
                                {Object.entries(plantDistributionByStatus).map(([plantCode, counts]) => (
                                    <tr key={plantCode}>
                                        <td className="plant-name">{getPlantName(plantCode)}</td>
                                        <td>{counts.Total || 0}</td>
                                        <td>{counts.Active || 0}</td>
                                        <td>{counts.Spare || 0}</td>
                                        <td>{counts['In Shop'] || 0}</td>
                                        <td>{counts.Retired || 0}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Cleanliness History Chart */}
                <div className="overview-card cleanliness-card">
                    <CleanlinessHistoryChart mixers={filteredMixers || mixers}/>
                </div>
            </div>
        </div>
    );
};

export default MixerOverview;
