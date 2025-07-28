import React, {useEffect, useState} from 'react';
import {MixerService} from '../../../services/MixerService';
import {MixerUtility} from '../../../utils/MixerUtility';
import {PlantService} from '../../../services/PlantService';
import {supabase} from '../../../services/DatabaseService';
import LoadingScreen from '../common/LoadingScreen';
import './styles/MixerOverview.css';

const MixerOverview = ({
    filteredMixers = null,
    selectedPlant = '',
    unverifiedCount = 0,
    neverVerifiedCount = 0,
    onStatusClick
}) => {
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
    const [duplicateOperatorNames, setDuplicateOperatorNames] = useState(new Set());

    useEffect(() => {
        fetchData();
    }, [filteredMixers]);

    useEffect(() => {
        if (filteredMixers && operators.length > 0) {
            updateStatistics(filteredMixers);
        }
    }, [filteredMixers, operators]);

    useEffect(() => {
        const nameCount = {};
        operators.forEach(op => {
            const name = op.name?.trim();
            if (!name) return;
            nameCount[name] = (nameCount[name] || 0) + 1;
        });
        const duplicates = new Set(Object.keys(nameCount).filter(name => nameCount[name] > 1));
        setDuplicateOperatorNames(duplicates);
    }, [operators]);

    const updateStatistics = (mixersData) => {
        const statsMixers = filteredMixers || mixersData;

        const statusCounts = MixerUtility.getStatusCounts(statsMixers);
        setStatusCounts(statusCounts);
        setPlantCounts(MixerUtility.getPlantCounts(statsMixers));
        setCleanlinessAvg(MixerUtility.getCleanlinessAverage(statsMixers));
        setNeedServiceCount(MixerUtility.getNeedServiceCount(statsMixers));

        const totalNonRetired = statsMixers.filter(mixer => mixer.status !== 'Retired').length;

        const verified = statsMixers.filter(mixer => {
            return MixerUtility.isVerified(mixer.updatedLast, mixer.updatedAt, mixer.updatedBy);
        }).length;
        const notVerified = statsMixers.length - verified;
        setVerifiedCount(verified);
        setNotVerifiedCount(notVerified);

        const assignedOperatorIds = new Set();
        statsMixers
            .filter(mixer => mixer.assignedOperator && mixer.assignedOperator !== '0')
            .forEach(mixer => assignedOperatorIds.add(mixer.assignedOperator));

        const assignedOperators = operators.filter(op => assignedOperatorIds.has(op.employeeId));
        const trainingCount = assignedOperators.filter(op => op.assignedTrainer && op.assignedTrainer !== '0').length;
        const trainersCount = assignedOperators.filter(op => op.isTrainer === true).length;

        setTrainingCount(trainingCount);
        setTrainersCount(trainersCount);

        calculatePlantDistributionByStatus(statsMixers);

        setStatusCounts(prev => ({ ...prev, Total: totalNonRetired }));

        let filteredForIssues = statsMixers;
        if (selectedPlant) {
            filteredForIssues = statsMixers.filter(mixer => mixer.assignedPlant === selectedPlant);
        }
        setOpenMaintenanceIssues(
            filteredForIssues.filter(mixer =>
                mixer.issues?.some(issue => !issue.time_completed)
            ).length
        );
    };

    const calculatePlantDistributionByStatus = (mixersData) => {
        const distribution = {};
        const uniquePlants = [...new Set(mixersData.map(mixer => mixer.assignedPlant || 'Unassigned'))];

        uniquePlants.forEach(plant => {
            distribution[plant] = {
                Total: 0,
                Active: 0,
                Spare: 0,
                'In Shop': 0
            };
        });

        mixersData.forEach(mixer => {
            const plant = mixer.assignedPlant || 'Unassigned';
            const status = mixer.status || 'Unknown';
            distribution[plant].Total++;
            if (['Active', 'Spare', 'In Shop', 'Retired'].includes(status)) {
                distribution[plant][status]++;
            } else {
                distribution[plant].Active++;
            }
        });

        setPlantDistributionByStatus(distribution);
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const mixersData = await MixerService.getAllMixers();
            let maintenanceIssues = [];
            try {
                const { data, error } = await supabase
                    .from('mixers_maintenance')
                    .select('id, mixer_id, time_completed');

                if (!error) {
                    maintenanceIssues = data || [];
                }
            } catch (maintenanceError) {}

            const mixersWithMaintenance = mixersData.map(mixer => ({
                ...mixer,
                issues: maintenanceIssues.filter(issue => issue.mixer_id === mixer.id)
            }));

            setMixers(mixersWithMaintenance);

            const plantsData = await PlantService.fetchPlants();
            setPlants(plantsData);

            try {
                const { data: operatorsRawData, error: operatorsError } = await supabase
                    .from('operators')
                    .select('*');

                if (operatorsError) throw operatorsError;

                const operatorsData = operatorsRawData
                    .map(op => ({
                        employeeId: op.employee_id,
                        smyrnaId: op.smyrna_id || '',
                        name: op.name,
                        plantCode: op.plant_code,
                        status: op.status,
                        isTrainer: op.is_trainer === true,
                        assignedTrainer: op.assigned_trainer,
                        position: op.position
                    }));

                setOperators(operatorsData || []);
            } catch (operatorsError) {}
            if (!filteredMixers) {
                updateStatistics(mixersWithMaintenance);
            }
        } catch (error) {
        } finally {
            setIsLoading(false);
        }
    };

    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plantCode === plantCode);
        return plant ? plant.plantName : plantCode;
    };

    const getTrainerTraineeRows = () => {
        const relevantMixers = filteredMixers || mixers;
        const relevantOperatorIds = new Set();
        relevantMixers.forEach(mixer => {
            if (mixer.assignedOperator && mixer.assignedOperator !== '0') {
                relevantOperatorIds.add(mixer.assignedOperator);
            }
        });
        let filteredTrainers = operators.filter(op => op.isTrainer);
        if (selectedPlant) {
            filteredTrainers = filteredTrainers.filter(op => op.plantCode === selectedPlant || relevantOperatorIds.has(op.employeeId));
        }
        let filteredTrainees = operators.filter(
            op => op.assignedTrainer && op.assignedTrainer !== '0' && op.status === 'Training'
        );
        if (selectedPlant) {
            filteredTrainees = filteredTrainees.filter(op => op.plantCode === selectedPlant || relevantOperatorIds.has(op.employeeId));
        }
        const rows = [];
        const trainerTraineeCount = {};
        filteredTrainees.forEach(trainee => {
            const trainerId = trainee.assignedTrainer;
            trainerTraineeCount[trainerId] = (trainerTraineeCount[trainerId] || 0) + 1;
        });
        filteredTrainers.forEach(trainer => {
            const assignedMixer = relevantMixers.find(
                m => m.assignedOperator === trainer.employeeId
            );
            const trainerTrainees = filteredTrainees.filter(t => t.assignedTrainer === trainer.employeeId);
            const hasMultipleTrainees = trainerTraineeCount[trainer.employeeId] > 1;
            if (trainerTrainees.length === 0) {
                rows.push({
                    truckNumber: assignedMixer ? assignedMixer.truckNumber || assignedMixer.unitNumber || assignedMixer.id : '',
                    trainer: trainer.name,
                    trainerPlant: trainer.plantCode,
                    trainerPosition: (trainer.position === 'Mixer Operator' || trainer.position === 'Tractor Operator') ? trainer.position : '',
                    trainee: '',
                    traineePosition: '',
                    hasMultipleTrainees: false
                });
            } else {
                trainerTrainees.forEach(trainee => {
                    rows.push({
                        truckNumber: assignedMixer ? assignedMixer.truckNumber || assignedMixer.unitNumber || assignedMixer.id : '',
                        trainer: trainer.name,
                        trainerPlant: trainer.plantCode,
                        trainerPosition: (trainer.position === 'Mixer Operator' || trainer.position === 'Tractor Operator') ? trainer.position : '',
                        trainee: trainee.name,
                        traineePosition: (trainee.position === 'Mixer Operator' || trainee.position === 'Tractor Operator') ? trainee.position : '',
                        hasMultipleTrainees
                    });
                });
            }
        });
        rows.sort((a, b) => {
            if (a.trainerPlant < b.trainerPlant) return -1;
            if (a.trainerPlant > b.trainerPlant) return 1;
            return 0;
        });
        return rows;
    };

    if (isLoading) {
        return (
            <div className="mixer-overview">
                <LoadingScreen message="Loading mixer data..." inline={true} />
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
                            <div className="status-label">Total Mixers</div>
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
                        <div
                            className="status-item clickable"
                            onClick={() => onStatusClick && onStatusClick('Verified')}
                            tabIndex={0}
                            role="button"
                            style={{cursor: 'pointer'}}
                        >
                            <div className="status-count">{verifiedCount}</div>
                            <div className="status-label">Verified</div>
                        </div>
                        <div
                            className="status-item clickable"
                            onClick={() => onStatusClick && onStatusClick('Not Verified')}
                            tabIndex={0}
                            role="button"
                            style={{cursor: 'pointer'}}
                        >
                            <div className="status-count">{notVerifiedCount}</div>
                            <div className="status-label">Not Verified</div>
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
            {selectedPlant && (
                <div className="overview-card plant-card full-width-operators" style={{marginTop: 32}}>
                    <h2 style={{marginLeft: 10}}>Active Operators ({getPlantName(selectedPlant)})</h2>
                    <div className="plant-distribution-table">
                        <table className="distribution-table">
                            <thead>
                            <tr>
                                <th>Name</th>
                                <th>Position</th>
                                <th>Truck #</th>
                            </tr>
                            </thead>
                            <tbody>
                            {operators
                                .filter(op => op.plantCode === selectedPlant && op.status === 'Active')
                                .sort((a, b) => {
                                    const aIsTractor = a.position === 'Tractor Operator';
                                    const bIsTractor = b.position === 'Tractor Operator';
                                    if (aIsTractor !== bIsTractor) {
                                        return aIsTractor ? 1 : -1;
                                    }
                                    return a.name.localeCompare(b.name);
                                })
                                .map(op => {
                                    const mixerSource = filteredMixers || mixers;
                                    const assignedMixer = mixerSource.find(m =>
                                        m.assignedOperator === op.employeeId &&
                                        m.assignedPlant === selectedPlant
                                    );
                                    const isTractorOperator = op.position === 'Tractor Operator';
                                    const isDuplicateName = duplicateOperatorNames.has(op.name?.trim());
                                    return (
                                        <tr key={op.employeeId}>
                                            <td className="plant-name">
                                                <span style={{position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px'}}>
                                                    {op.name}
                                                    {isTractorOperator && assignedMixer && (
                                                        <span tabIndex="0" style={{position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '6px'}}>
                                                            <i className="fas fa-exclamation-triangle tractor-warning-icon"></i>
                                                            <span className="trainer-warning-tooltip right-tooltip">
                                                                Tractor Operator assigned to a mixer
                                                            </span>
                                                        </span>
                                                    )}
                                                    {isDuplicateName && (
                                                        <span tabIndex="0" style={{position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '6px'}}>
                                                            <i className="fas fa-exclamation-triangle duplicate-warning-icon"></i>
                                                            <span className="trainer-warning-tooltip right-tooltip">
                                                                Duplicate operator name
                                                            </span>
                                                        </span>
                                                    )}
                                                </span>
                                            </td>
                                            <td>{op.position || ''}</td>
                                            <td>
                                                {assignedMixer ? assignedMixer.truckNumber || assignedMixer.unitNumber || assignedMixer.id : <span className="inactive-dash">—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            {operators.filter(op => op.plantCode === selectedPlant && op.status === 'Active').length === 0 && (
                                <tr>
                                    <td colSpan={3} className="inactive-dash" style={{fontStyle: 'italic', padding: '8px 12px'}}>No active operators found for this plant.</td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            <div className="overview-card plant-card" style={{marginTop: 32}}>
                <h2 style={{marginLeft: 10}}>Trainers & Trainees</h2>
                <div className="plant-distribution-table">
                    <table className="distribution-table">
                        <thead>
                        <tr>
                            <th>Plant</th>
                            <th>Truck #</th>
                            <th>Trainer Position</th>
                            <th>Trainer</th>
                            <th>Trainee</th>
                            <th>Trainee Position</th>
                        </tr>
                        </thead>
                        <tbody>
                        {getTrainerTraineeRows().length === 0 && (
                            <tr>
                                <td colSpan={6} className="inactive-dash" style={{fontStyle: 'italic', padding: '8px 12px'}}>No trainers or trainees found.</td>
                            </tr>
                        )}
                        {getTrainerTraineeRows().map((row, idx) => (
                            <tr key={row.trainer + '-' + row.trainee + '-' + idx}>
                                <td>{row.trainerPlant || <span className="inactive-dash">-</span>}</td>
                                <td>{row.truckNumber || <span className="inactive-dash">—</span>}</td>
                                <td>{row.trainerPosition || <span className="inactive-dash">—</span>}</td>
                                <td>
                                    {row.hasMultipleTrainees ? (
                                        <span tabIndex="0" style={{position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px'}}>
                                            {row.trainer}
                                            <i className="fas fa-exclamation-triangle"></i>
                                            <span className="trainer-warning-tooltip right-tooltip">
                                                Trainer has multiple trainees
                                            </span>
                                        </span>
                                    ) : (
                                        row.trainer
                                    )}
                                </td>
                                <td>{row.trainee || <span className="inactive-dash">—</span>}</td>
                                <td>{row.traineePosition || <span className="inactive-dash">—</span>}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default MixerOverview;
