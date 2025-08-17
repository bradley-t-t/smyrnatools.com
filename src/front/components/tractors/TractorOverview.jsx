import React, {useEffect, useState} from 'react'
import {TractorService} from '../../../services/TractorService'
import {TractorUtility} from '../../../utils/TractorUtility'
import {PlantService} from '../../../services/PlantService'
import {supabase} from '../../../services/DatabaseService'
import LoadingScreen from '../common/LoadingScreen'
import './styles/TractorOverview.css'

const TractorOverview = ({
                             filteredTractors = null,
                             selectedPlant = '',
                             onStatusClick
                         }) => {
    const [tractors, setTractors] = useState([])
    const [, setPlants] = useState([])
    const [operators, setOperators] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [statusCounts, setStatusCounts] = useState({})
    const [plantCounts, setPlantCounts] = useState({})
    const [plantDistributionByStatus, setPlantDistributionByStatus] = useState({})
    const [cleanlinessAvg, setCleanlinessAvg] = useState(0)
    const [needServiceCount, setNeedServiceCount] = useState(0)
    const [openMaintenanceIssues, setOpenMaintenanceIssues] = useState(0)
    const [verifiedCount, setVerifiedCount] = useState(0)
    const [notVerifiedCount, setNotVerifiedCount] = useState(0)
    const [duplicateOperatorNames, setDuplicateOperatorNames] = useState(new Set())

    useEffect(() => {
        fetchData()
    }, [filteredTractors])

    useEffect(() => {
        if (filteredTractors && operators.length > 0) {
            updateStatistics(filteredTractors)
        }
    }, [filteredTractors, operators])

    useEffect(() => {
        const nameCount = {}
        operators.forEach(op => {
            const name = op.name?.trim()
            if (!name) return
            nameCount[name] = (nameCount[name] || 0) + 1
        })
        const duplicates = new Set(Object.keys(nameCount).filter(name => nameCount[name] > 1))
        setDuplicateOperatorNames(duplicates)
    }, [operators])

    const updateStatistics = (tractorsData) => {
        const statsTractors = filteredTractors || tractorsData
        const statusCounts = TractorUtility.getStatusCounts(statsTractors)
        setStatusCounts(statusCounts)
        setPlantCounts(TractorUtility.getPlantCounts(statsTractors))
        setCleanlinessAvg(TractorUtility.getCleanlinessAverage(statsTractors))
        setNeedServiceCount(TractorUtility.getNeedServiceCount(statsTractors))
        const totalNonRetired = statsTractors.filter(tractor => tractor.status !== 'Retired').length
        const verified = statsTractors.filter(tractor => {
            return TractorUtility.isVerified(tractor.updatedLast, tractor.updatedAt, tractor.updatedBy)
        }).length
        const notVerified = statsTractors.length - verified
        setVerifiedCount(verified)
        setNotVerifiedCount(notVerified)
        calculatePlantDistributionByStatus(statsTractors)
        setStatusCounts(prev => ({...prev, Total: totalNonRetired}))
        let filteredForIssues = statsTractors
        if (selectedPlant) {
            filteredForIssues = statsTractors.filter(tractor => tractor.assignedPlant === selectedPlant)
        }
        setOpenMaintenanceIssues(
            filteredForIssues.filter(tractor =>
                tractor.issues?.some(issue => !issue.time_completed)
            ).length
        )
    }

    const calculatePlantDistributionByStatus = (tractorsData) => {
        const distribution = {}
        const uniquePlants = [...new Set(tractorsData.map(tractor => tractor.assignedPlant || 'Unassigned'))]
        uniquePlants.forEach(plant => {
            distribution[plant] = {
                Total: 0,
                Active: 0,
                Spare: 0,
                'In Shop': 0
            }
        })
        tractorsData.forEach(tractor => {
            const plant = tractor.assignedPlant || 'Unassigned'
            const status = tractor.status || 'Unknown'
            distribution[plant].Total++
            if (['Active', 'Spare', 'In Shop', 'Retired'].includes(status)) {
                distribution[plant][status]++
            } else {
                distribution[plant].Active++
            }
        })
        setPlantDistributionByStatus(distribution)
    }

    const fetchData = async () => {
        setIsLoading(true)
        try {
            const tractorsData = await TractorService.getAllTractors()
            let maintenanceIssues = []
            try {
                const {data, error} = await supabase
                    .from('tractors_maintenance')
                    .select('id, tractor_id, time_completed')
                if (!error) {
                    maintenanceIssues = data || []
                }
            } catch (maintenanceError) {
            }
            const tractorsWithMaintenance = tractorsData.map(tractor => ({
                ...tractor,
                issues: maintenanceIssues.filter(issue => issue.tractor_id === tractor.id)
            }))
            setTractors(tractorsWithMaintenance)
            const plantsData = await PlantService.fetchPlants()
            setPlants(plantsData)
            try {
                const {data: operatorsRawData, error: operatorsError} = await supabase
                    .from('operators')
                    .select('*')
                if (operatorsError) throw operatorsError
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
                    }))
                setOperators(operatorsData || [])
            } catch (operatorsError) {
            }
            if (!filteredTractors) {
                updateStatistics(tractorsWithMaintenance)
            }
        } catch (error) {
        } finally {
            setIsLoading(false)
        }
    }

    const getPlantName = (plantCode) => {
        return plantCode
    }

    const getTrainerTraineeRows = () => {
        const relevantTractors = filteredTractors || tractors
        const relevantOperatorIds = new Set()
        relevantTractors.forEach(tractor => {
            if (tractor.assignedOperator && tractor.assignedOperator !== '0') {
                relevantOperatorIds.add(tractor.assignedOperator)
            }
        })
        let filteredTrainers = operators.filter(op => op.isTrainer)
        if (selectedPlant) {
            filteredTrainers = filteredTrainers.filter(op => op.plantCode === selectedPlant || relevantOperatorIds.has(op.employeeId))
        }
        let allTrainees = operators.filter(op => op.status === 'Training')
        let filteredTrainees
        if (selectedPlant) {
            filteredTrainees = allTrainees.filter(
                op => filteredTrainers.some(tr => tr.employeeId === op.assignedTrainer)
            )
        } else {
            filteredTrainees = allTrainees
        }
        const rows = []
        const trainerTraineeCount = {}
        filteredTrainees.forEach(trainee => {
            const trainerId = trainee.assignedTrainer
            if (trainerId) {
                trainerTraineeCount[trainerId] = (trainerTraineeCount[trainerId] || 0) + 1
            }
        })
        filteredTrainers.forEach(trainer => {
            const assignedTractor = relevantTractors.find(
                m => m.assignedOperator === trainer.employeeId
            )
            const trainerTrainees = filteredTrainees.filter(t => t.assignedTrainer === trainer.employeeId)
            const hasMultipleTrainees = trainerTraineeCount[trainer.employeeId] > 1
            if (trainerTrainees.length === 0) {
                rows.push({
                    truckNumber: assignedTractor ? assignedTractor.truckNumber || assignedTractor.unitNumber || assignedTractor.id : '',
                    trainer: trainer.name,
                    trainerPlant: trainer.plantCode,
                    trainerPosition: (trainer.position === 'Mixer Operator' || trainer.position === 'Tractor Operator') ? trainer.position : '',
                    trainee: '',
                    traineePosition: '',
                    traineePlant: '',
                    hasMultipleTrainees: false
                })
            } else {
                trainerTrainees.forEach(trainee => {
                    rows.push({
                        truckNumber: assignedTractor ? assignedTractor.truckNumber || assignedTractor.unitNumber || assignedTractor.id : '',
                        trainer: trainer.name,
                        trainerPlant: trainer.plantCode,
                        trainerPosition: (trainer.position === 'Mixer Operator' || trainer.position === 'Tractor Operator') ? trainer.position : '',
                        trainee: trainee.name,
                        traineePosition: (trainee.position === 'Mixer Operator' || trainee.position === 'Tractor Operator') ? trainee.position : '',
                        traineePlant: trainee.plantCode,
                        hasMultipleTrainees
                    })
                })
            }
        })
        const traineesWithoutTrainer = filteredTrainees.filter(t => !t.assignedTrainer)
        traineesWithoutTrainer.forEach(trainee => {
            rows.push({
                truckNumber: '',
                trainer: '',
                trainerPlant: trainee.plantCode,
                trainerPosition: '',
                trainee: trainee.name,
                traineePosition: (trainee.position === 'Mixer Operator' || trainee.position === 'Tractor Operator') ? trainee.position : '',
                traineePlant: trainee.plantCode,
                hasMultipleTrainees: false
            })
        })
        rows.sort((a, b) => {
            if (a.trainerPlant < b.trainerPlant) return -1
            if (a.trainerPlant > b.trainerPlant) return 1
            return 0
        })
        return rows
    }

    if (isLoading) {
        return (
            <div className="tractor-overview">
                <LoadingScreen message="Loading tractor data..." inline={true}/>
            </div>
        )
    }

    return (
        <div className="tractor-overview">
            {filteredTractors && tractors.length !== filteredTractors.length && (
                <div style={{textAlign: 'center', marginBottom: '10px'}}>
                    <span className="filtered-indicator">(Filtered: {filteredTractors.length}/{tractors.length})</span>
                </div>
            )}
            {filteredTractors && (
                <div style={{textAlign: 'center', marginBottom: '15px'}}>
                    <div className="filter-indicator">
                        Showing statistics
                        for {filteredTractors.length} tractor{filteredTractors.length !== 1 ? 's' : ''}
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
                            <div className="status-label">Total Tractors</div>
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
                                        return aIsTractor ? -1 : 1;
                                    }
                                    return a.name.localeCompare(b.name);
                                })
                                .map(op => {
                                    const tractorSource = filteredTractors || tractors;
                                    const assignedTractor = tractorSource.find(m =>
                                        m.assignedOperator === op.employeeId &&
                                        m.assignedPlant === selectedPlant
                                    );
                                    const isTractorOperator = op.position === 'Tractor Operator';
                                    const isDuplicateName = duplicateOperatorNames.has(op.name?.trim());
                                    return (
                                        <tr key={op.employeeId}>
                                            <td className="plant-name">
                                                <span style={{
                                                    position: 'relative',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}>
                                                    {op.name}
                                                    {isTractorOperator && assignedTractor && (
                                                        <span tabIndex="0" style={{
                                                            position: 'relative',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            marginLeft: '6px'
                                                        }}>
                                                            <i className="fas fa-exclamation-triangle tractor-warning-icon"></i>
                                                            <span className="trainer-warning-tooltip right-tooltip">
                                                                Tractor Operator assigned to a tractor
                                                            </span>
                                                        </span>
                                                    )}
                                                    {isDuplicateName && (
                                                        <span tabIndex="0" style={{
                                                            position: 'relative',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            marginLeft: '6px'
                                                        }}>
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
                                                {assignedTractor ? assignedTractor.truckNumber || assignedTractor.unitNumber || assignedTractor.id :
                                                    <span className="inactive-dash">—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            {operators.filter(op => op.plantCode === selectedPlant && op.status === 'Active').length === 0 && (
                                <tr>
                                    <td colSpan={3} className="inactive-dash"
                                        style={{fontStyle: 'italic', padding: '8px 12px'}}>No active operators found for
                                        this plant.
                                    </td>
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
                            <th>&rarr; Plant</th>
                        </tr>
                        </thead>
                        <tbody>
                        {getTrainerTraineeRows().length === 0 && (
                            <tr>
                                <td colSpan={7} className="inactive-dash"
                                    style={{fontStyle: 'italic', padding: '8px 12px'}}>No trainers or trainees found.
                                </td>
                            </tr>
                        )}
                        {getTrainerTraineeRows().map((row, idx) => (
                            <tr key={row.trainer + '-' + row.trainee + '-' + idx}>
                                <td>{row.trainerPlant || <span className="inactive-dash">-</span>}</td>
                                <td>{row.truckNumber || <span className="inactive-dash">—</span>}</td>
                                <td>{row.trainerPosition || <span className="inactive-dash">—</span>}</td>
                                <td>
                                    {row.hasMultipleTrainees ? (
                                        <span tabIndex="0" style={{
                                            position: 'relative',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
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
                                <td>{row.traineePlant ? getPlantName(row.traineePlant) :
                                    <span className="inactive-dash">—</span>}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default TractorOverview
