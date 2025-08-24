import React, {useEffect, useState} from 'react';
import {EquipmentService} from '../../services/EquipmentService';
import EquipmentUtility from '../../utils/EquipmentUtility';
import {PlantService} from '../../services/PlantService';
import {supabase} from '../../services/DatabaseService';
import LoadingScreen from '../common/LoadingScreen';
import './styles/EquipmentOverview.css';

const EquipmentOverview = ({
                               filteredEquipments = null,
                               selectedPlant = '',
                               onStatusClick
                           }) => {
    const [equipments, setEquipments] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusCounts, setStatusCounts] = useState({});
    const [plantCounts, setPlantCounts] = useState({});
    const [plantDistributionByStatus, setPlantDistributionByStatus] = useState({});
    const [cleanlinessAvg, setCleanlinessAvg] = useState(0);
    const [conditionAvg, setConditionAvg] = useState(0);
    const [needServiceCount, setNeedServiceCount] = useState(0);
    const [openMaintenanceIssues, setOpenMaintenanceIssues] = useState(0);

    useEffect(() => {
        fetchData();
    }, [filteredEquipments]);

    useEffect(() => {
        if (filteredEquipments) {
            updateStatistics(filteredEquipments);
        }
    }, [filteredEquipments]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const equipmentsData = await EquipmentService.getAllEquipments();
            let maintenanceIssues = [];
            try {
                const {data, error} = await supabase
                    .from('heavy_equipment_maintenance')
                    .select('id, equipment_id, time_completed');
                if (!error) {
                    maintenanceIssues = data || [];
                }
            } catch (maintenanceError) {
            }
            const equipmentsWithMaintenance = equipmentsData.map(equipment => ({
                ...equipment,
                issues: maintenanceIssues.filter(issue => issue.equipment_id === equipment.id)
            }));
            setEquipments(equipmentsWithMaintenance);
            const plantsData = await PlantService.fetchPlants();
            setPlants(plantsData);
            if (!filteredEquipments) {
                updateStatistics(equipmentsWithMaintenance);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateStatistics = (equipmentsData) => {
        const statsEquipments = filteredEquipments || equipmentsData;
        const statusCounts = EquipmentUtility.getStatusCounts(statsEquipments);
        setStatusCounts(statusCounts);
        setPlantCounts(EquipmentUtility.getPlantCounts(statsEquipments));
        setCleanlinessAvg(EquipmentUtility.getCleanlinessAverage(statsEquipments));
        setConditionAvg(EquipmentUtility.getConditionAverage(statsEquipments));
        setNeedServiceCount(EquipmentUtility.getNeedServiceCount(statsEquipments));
        const totalNonRetired = statsEquipments.filter(equipment => equipment.status !== 'Retired').length;
        setStatusCounts(prev => ({...prev, Total: totalNonRetired}));
        let filteredForIssues = statsEquipments;
        if (selectedPlant) {
            filteredForIssues = statsEquipments.filter(equipment => equipment.assignedPlant === selectedPlant);
        }
        setOpenMaintenanceIssues(
            filteredForIssues.filter(equipment =>
                equipment.issues?.some(issue => !issue.time_completed)
            ).length
        );
        calculatePlantDistributionByStatus(statsEquipments);
    };

    const calculatePlantDistributionByStatus = (equipmentsData) => {
        const distribution = {};
        const uniquePlants = [...new Set(equipmentsData.map(equipment => equipment.assignedPlant || 'Unassigned'))];
        uniquePlants.forEach(plant => {
            distribution[plant] = {
                Total: 0,
                Active: 0,
                Spare: 0,
                'In Shop': 0
            };
        });
        equipmentsData.forEach(equipment => {
            const plant = equipment.assignedPlant || 'Unassigned';
            const status = equipment.status || 'Unknown';
            distribution[plant].Total++;
            if (['Active', 'Spare', 'In Shop', 'Retired'].includes(status)) {
                distribution[plant][status]++;
            } else {
                distribution[plant].Active++;
            }
        });
        setPlantDistributionByStatus(distribution);
    };

    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plantCode === plantCode);
        return plant ? plant.plantName : plantCode || 'Unassigned';
    };

    if (isLoading) {
        return (
            <div className="equipment-overview">
                <LoadingScreen message="Loading equipment data..." inline={true}/>
            </div>
        );
    }

    return (
        <div className="equipment-overview">
            {filteredEquipments && equipments.length !== filteredEquipments.length && (
                <div style={{textAlign: 'center', marginBottom: '10px'}}>
                    <span
                        className="filtered-indicator">(Filtered: {filteredEquipments.length}/{equipments.length})</span>
                </div>
            )}
            {filteredEquipments && (
                <div style={{textAlign: 'center', marginBottom: '15px'}}>
                    <div className="filter-indicator">
                        Showing statistics
                        for {filteredEquipments.length} equipment {filteredEquipments.length !== 1 ? 'items' : 'item'}
                    </div>
                </div>
            )}
            <div className="overview-grid">
                <div className="overview-card status-card">
                    <h2>Status Overview</h2>
                    <div className="status-grid">
                        <div
                            className="status-item clickable"
                            onClick={() => onStatusClick && onStatusClick('All Statuses')}
                            tabIndex={0}
                            role="button"
                            style={{cursor: 'pointer'}}
                        >
                            <div className="status-count">{statusCounts.Total || 0}</div>
                            <div className="status-label">Total Equipment</div>
                        </div>
                        <div
                            className="status-item clickable"
                            onClick={() => onStatusClick && onStatusClick('Active')}
                            tabIndex={0}
                            role="button"
                            style={{cursor: 'pointer'}}
                        >
                            <div className="status-count">{statusCounts.Active || 0}</div>
                            <div className="status-label">Active</div>
                        </div>
                        <div
                            className="status-item clickable"
                            onClick={() => onStatusClick && onStatusClick('In Shop')}
                            tabIndex={0}
                            role="button"
                            style={{cursor: 'pointer'}}
                        >
                            <div className="status-count">{statusCounts['In Shop'] || 0}</div>
                            <div className="status-label">In Shop</div>
                        </div>
                        <div
                            className="status-item clickable"
                            onClick={() => onStatusClick && onStatusClick('Spare')}
                            tabIndex={0}
                            role="button"
                            style={{cursor: 'pointer'}}
                        >
                            <div className="status-count">{statusCounts.Spare || 0}</div>
                            <div className="status-label">Spare</div>
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
                                <i className="fas fa-star"></i>
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{conditionAvg}</div>
                                <div className="stat-label">Avg. Condition</div>
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
                                    <th>Active</th>
                                    <th>Spare</th>
                                    <th>In Shop</th>
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

export default EquipmentOverview;