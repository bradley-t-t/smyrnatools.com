import React, {useEffect, useState} from 'react'
import {MixerService} from '../../../services/MixerService'
import {MixerUtility} from '../../../utils/MixerUtility'
import {PlantService} from '../../../services/PlantService'
import {supabase} from '../../../services/DatabaseService'
import LoadingScreen from '../common/LoadingScreen'
import './styles/MixerOverview.css'
import { getWeekRangeFromIso } from '../reports/ReportsView'
import { UserService } from '../../../services/UserService'

const MixerOverview = ({
    filteredMixers = null,
    selectedPlant = '',
    unverifiedCount = 0,
    neverVerifiedCount = 0,
    onStatusClick
}) => {
    const [mixers, setMixers] = useState([])
    const [plants, setPlants] = useState([])
    const [operators, setOperators] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [statusCounts, setStatusCounts] = useState({})
    const [plantCounts, setPlantCounts] = useState({})
    const [plantDistributionByStatus, setPlantDistributionByStatus] = useState({})
    const [trainingCount, setTrainingCount] = useState(0)
    const [trainersCount, setTrainersCount] = useState(0)
    const [cleanlinessAvg, setCleanlinessAvg] = useState(0)
    const [needServiceCount, setNeedServiceCount] = useState(0)
    const [openMaintenanceIssues, setOpenMaintenanceIssues] = useState(0)
    const [verifiedCount, setVerifiedCount] = useState(0)
    const [notVerifiedCount, setNotVerifiedCount] = useState(0)
    const [duplicateOperatorNames, setDuplicateOperatorNames] = useState(new Set())
    const [plantReportMetrics, setPlantReportMetrics] = useState(null)
    const [plantReportNote, setPlantReportNote] = useState('')
    const [plantReportRange, setPlantReportRange] = useState('')
    const [lastReport, setLastReport] = useState(null)
    const [lastReportRange, setLastReportRange] = useState('')

    useEffect(() => {
        fetchData()
    }, [filteredMixers])

    useEffect(() => {
        if (filteredMixers && operators.length > 0) {
            updateStatistics(filteredMixers)
        }
    }, [filteredMixers, operators])

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

    useEffect(() => {
        if (selectedPlant) {
            fetchPlantManagerMetrics(selectedPlant)
        } else {
            setPlantReportMetrics(null)
            setPlantReportNote('')
            setPlantReportRange('')
            setLastReport(null)
            setLastReportRange('')
        }
    }, [selectedPlant, plants])

    const fetchPlantManagerMetrics = async (plantCode) => {
        setPlantReportMetrics(null)
        setPlantReportNote('')
        setPlantReportRange('')
        setLastReport(null)
        setLastReportRange('')
        const today = new Date()
        const day = today.getDay()
        const monday = new Date(today)
        monday.setDate(today.getDate() - ((day + 6) % 7))
        monday.setHours(0, 0, 0, 0)
        const prevMonday = new Date(monday)
        prevMonday.setDate(monday.getDate() - 7)
        prevMonday.setHours(0, 0, 0, 0)
        const prevMondayIso = prevMonday.toISOString().slice(0, 10)
        setPlantReportRange(getWeekRangeFromIso(prevMondayIso))
        const { data: usersData } = await supabase
            .from('users_profiles')
            .select('id')
        let userIdsForPlant = []
        if (Array.isArray(usersData)) {
            const plantMap = {}
            await Promise.all(usersData.map(async u => {
                const userPlant = await UserService.getUserPlant(u.id)
                plantMap[u.id] = userPlant
            }))
            userIdsForPlant = usersData.filter(u => plantMap[u.id] === plantCode).map(u => u.id)
        }
        if (!userIdsForPlant.length) {
            setPlantReportMetrics({
                yph: null,
                yphLabel: '',
                lost: null,
                lostLabel: ''
            })
            setPlantReportNote('Plant manager has not completed their weekly report. Click here to view the last report found.')
            return
        }
        const { data: reportsData, error } = await supabase
            .from('reports')
            .select('data,week,user_id')
            .eq('report_name', 'plant_manager')
            .eq('completed', true)
            .in('user_id', userIdsForPlant)
        let found = null
        if (!error && Array.isArray(reportsData)) {
            found = reportsData.find(r => {
                let weekField = r.data?.week || r.week
                let weekIso = ''
                if (weekField instanceof Date) {
                    weekIso = weekField.toISOString().slice(0, 10)
                } else if (typeof weekField === 'string') {
                    const d = new Date(weekField)
                    if (!isNaN(d)) {
                        weekIso = d.toISOString().slice(0, 10)
                    }
                }
                return weekIso === prevMondayIso
            })
        }
        if (found && found.data) {
            const form = found.data
            let yards =
                parseFloat(form.yardage) ||
                parseFloat(form.total_yards_delivered) ||
                parseFloat(form['Yardage']) ||
                parseFloat(form['yardage']) ||
                null
            let hours =
                parseFloat(form.total_hours) ||
                parseFloat(form.total_operator_hours) ||
                parseFloat(form['Total Hours']) ||
                parseFloat(form['total_operator_hours']) ||
                parseFloat(form['total_hours']) ||
                null
            let lost = null
            if (typeof form.total_yards_lost !== 'undefined' && form.total_yards_lost !== '' && !isNaN(Number(form.total_yards_lost))) {
                lost = Number(form.total_yards_lost)
            } else if (
                typeof form.yardage_lost !== 'undefined' && form.yardage_lost !== '' && !isNaN(Number(form.yardage_lost))
            ) {
                lost = Number(form.yardage_lost)
            } else if (
                typeof form.lost_yardage !== 'undefined' && form.lost_yardage !== '' && !isNaN(Number(form.lost_yardage))
            ) {
                lost = Number(form.lost_yardage)
            } else if (
                typeof form['Yardage Lost'] !== 'undefined' && form['Yardage Lost'] !== '' && !isNaN(Number(form['Yardage Lost']))
            ) {
                lost = Number(form['Yardage Lost'])
            } else if (
                typeof form['yardage_lost'] !== 'undefined' && form['yardage_lost'] !== '' && !isNaN(Number(form['yardage_lost']))
            ) {
                lost = Number(form['yardage_lost'])
            }
            let yph = !isNaN(yards) && !isNaN(hours) && hours > 0 ? yards / hours : null
            let yphGrade = ''
            if (yph !== null) {
                if (yph >= 6) yphGrade = 'excellent'
                else if (yph >= 4) yphGrade = 'good'
                else if (yph >= 3) yphGrade = 'average'
                else yphGrade = 'poor'
            }
            let yphLabel = ''
            if (yphGrade === 'excellent') yphLabel = 'Excellent'
            else if (yphGrade === 'good') yphLabel = 'Good'
            else if (yphGrade === 'average') yphLabel = 'Average'
            else if (yphGrade === 'poor') yphLabel = 'Poor'
            let lostGrade = ''
            if (lost !== null) {
                if (lost === 0) lostGrade = 'excellent'
                else if (lost < 5) lostGrade = 'good'
                else if (lost < 10) lostGrade = 'average'
                else lostGrade = 'poor'
            }
            let lostLabel = ''
            if (lostGrade === 'excellent') lostLabel = 'Excellent'
            else if (lostGrade === 'good') lostLabel = 'Good'
            else if (lostGrade === 'average') lostLabel = 'Average'
            else if (lostGrade === 'poor') lostLabel = 'Poor'
            setPlantReportMetrics({
                yph,
                yphLabel,
                lost,
                lostLabel
            })
            setPlantReportNote('')
        } else {
            let last = null
            let lastWeekIso = ''
            if (Array.isArray(reportsData) && reportsData.length > 0) {
                let sorted = reportsData
                    .map(r => {
                        let weekField = r.data?.week || r.week
                        let weekIso = ''
                        if (weekField instanceof Date) {
                            weekIso = weekField.toISOString().slice(0, 10)
                        } else if (typeof weekField === 'string') {
                            const d = new Date(weekField)
                            if (!isNaN(d)) {
                                weekIso = d.toISOString().slice(0, 10)
                            }
                        }
                        return { ...r, weekIso }
                    })
                    .filter(r => r.weekIso)
                    .sort((a, b) => new Date(b.weekIso) - new Date(a.weekIso))
                if (sorted.length > 0) {
                    last = sorted[0]
                    lastWeekIso = last.weekIso
                }
            }
            setPlantReportMetrics({
                yph: null,
                yphLabel: '',
                lost: null,
                lostLabel: ''
            })
            setPlantReportNote('Plant manager has not completed their weekly report. Click here to view the last report found.')
            setLastReport(last)
            setLastReportRange(lastWeekIso ? getWeekRangeFromIso(lastWeekIso) : '')
        }
    }

    const handleShowLastReport = () => {
        if (!lastReport) return
        const form = lastReport.data
        let yards =
            parseFloat(form.yardage) ||
            parseFloat(form.total_yards_delivered) ||
            parseFloat(form['Yardage']) ||
            parseFloat(form['yardage']) ||
            null
        let hours =
            parseFloat(form.total_hours) ||
            parseFloat(form.total_operator_hours) ||
            parseFloat(form['Total Hours']) ||
            parseFloat(form['total_operator_hours']) ||
            parseFloat(form['total_hours']) ||
            null
        let lost = null
        if (typeof form.total_yards_lost !== 'undefined' && form.total_yards_lost !== '' && !isNaN(Number(form.total_yards_lost))) {
            lost = Number(form.total_yards_lost)
        } else if (
            typeof form.yardage_lost !== 'undefined' && form.yardage_lost !== '' && !isNaN(Number(form.yardage_lost))
        ) {
            lost = Number(form.yardage_lost)
        } else if (
            typeof form.lost_yardage !== 'undefined' && form.lost_yardage !== '' && !isNaN(Number(form.lost_yardage))
        ) {
            lost = Number(form.lost_yardage)
        } else if (
            typeof form['Yardage Lost'] !== 'undefined' && form['Yardage Lost'] !== '' && !isNaN(Number(form['Yardage Lost']))
        ) {
            lost = Number(form['Yardage Lost'])
        } else if (
            typeof form['yardage_lost'] !== 'undefined' && form['yardage_lost'] !== '' && !isNaN(Number(form['yardage_lost']))
        ) {
            lost = Number(form['yardage_lost'])
        }
        let yph = !isNaN(yards) && !isNaN(hours) && hours > 0 ? yards / hours : null
        let yphGrade = ''
        if (yph !== null) {
            if (yph >= 6) yphGrade = 'excellent'
            else if (yph >= 4) yphGrade = 'good'
            else if (yph >= 3) yphGrade = 'average'
            else yphGrade = 'poor'
        }
        let yphLabel = ''
        if (yphGrade === 'excellent') yphLabel = 'Excellent'
        else if (yphGrade === 'good') yphLabel = 'Good'
        else if (yphGrade === 'average') yphLabel = 'Average'
        else if (yphGrade === 'poor') yphLabel = 'Poor'
        let lostGrade = ''
        if (lost !== null) {
            if (lost === 0) lostGrade = 'excellent'
            else if (lost < 5) lostGrade = 'good'
            else if (lost < 10) lostGrade = 'average'
            else lostGrade = 'poor'
        }
        let lostLabel = ''
        if (lostGrade === 'excellent') lostLabel = 'Excellent'
        else if (lostGrade === 'good') lostLabel = 'Good'
        else if (lostGrade === 'average') lostLabel = 'Average'
        else if (lostGrade === 'poor') lostLabel = 'Poor'
        setPlantReportMetrics({
            yph,
            yphLabel,
            lost,
            lostLabel
        })
        setPlantReportRange(lastReportRange)
        setPlantReportNote('')
    }

    const updateStatistics = (mixersData) => {
        const statsMixers = filteredMixers || mixersData
        const statusCounts = MixerUtility.getStatusCounts(statsMixers)
        setStatusCounts(statusCounts)
        setPlantCounts(MixerUtility.getPlantCounts(statsMixers))
        setCleanlinessAvg(MixerUtility.getCleanlinessAverage(statsMixers))
        setNeedServiceCount(MixerUtility.getNeedServiceCount(statsMixers))
        const totalNonRetired = statsMixers.filter(mixer => mixer.status !== 'Retired').length
        const verified = statsMixers.filter(mixer => {
            return MixerUtility.isVerified(mixer.updatedLast, mixer.updatedAt, mixer.updatedBy)
        }).length
        const notVerified = statsMixers.length - verified
        setVerifiedCount(verified)
        setNotVerifiedCount(notVerified)
        const assignedOperatorIds = new Set()
        statsMixers
            .filter(mixer => mixer.assignedOperator && mixer.assignedOperator !== '0')
            .forEach(mixer => assignedOperatorIds.add(mixer.assignedOperator))
        const assignedOperators = operators.filter(op => assignedOperatorIds.has(op.employeeId))
        const trainingCount = assignedOperators.filter(op => op.assignedTrainer && op.assignedTrainer !== '0').length
        const trainersCount = assignedOperators.filter(op => op.isTrainer === true).length
        setTrainingCount(trainingCount)
        setTrainersCount(trainersCount)
        calculatePlantDistributionByStatus(statsMixers)
        setStatusCounts(prev => ({ ...prev, Total: totalNonRetired }))
        let filteredForIssues = statsMixers
        if (selectedPlant) {
            filteredForIssues = statsMixers.filter(mixer => mixer.assignedPlant === selectedPlant)
        }
        setOpenMaintenanceIssues(
            filteredForIssues.filter(mixer =>
                mixer.issues?.some(issue => !issue.time_completed)
            ).length
        )
    }

    const calculatePlantDistributionByStatus = (mixersData) => {
        const distribution = {}
        const uniquePlants = [...new Set(mixersData.map(mixer => mixer.assignedPlant || 'Unassigned'))]
        uniquePlants.forEach(plant => {
            distribution[plant] = {
                Total: 0,
                Active: 0,
                Spare: 0,
                'In Shop': 0
            }
        })
        mixersData.forEach(mixer => {
            const plant = mixer.assignedPlant || 'Unassigned'
            const status = mixer.status || 'Unknown'
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
            const mixersData = await MixerService.getAllMixers()
            let maintenanceIssues = []
            try {
                const { data, error } = await supabase
                    .from('mixers_maintenance')
                    .select('id, mixer_id, time_completed')
                if (!error) {
                    maintenanceIssues = data || []
                }
            } catch (maintenanceError) {}
            const mixersWithMaintenance = mixersData.map(mixer => ({
                ...mixer,
                issues: maintenanceIssues.filter(issue => issue.mixer_id === mixer.id)
            }))
            setMixers(mixersWithMaintenance)
            const plantsData = await PlantService.fetchPlants()
            setPlants(plantsData)
            try {
                const { data: operatorsRawData, error: operatorsError } = await supabase
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
            } catch (operatorsError) {}
            if (!filteredMixers) {
                updateStatistics(mixersWithMaintenance)
            }
        } catch (error) {
        } finally {
            setIsLoading(false)
        }
    }

    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plantCode === plantCode)
        return plant ? plant.plantName : plantCode
    }

    const getTrainerTraineeRows = () => {
        const relevantMixers = filteredMixers || mixers
        const relevantOperatorIds = new Set()
        relevantMixers.forEach(mixer => {
            if (mixer.assignedOperator && mixer.assignedOperator !== '0') {
                relevantOperatorIds.add(mixer.assignedOperator)
            }
        })
        let filteredTrainers = operators.filter(op => op.isTrainer)
        if (selectedPlant) {
            filteredTrainers = filteredTrainers.filter(op => op.plantCode === selectedPlant || relevantOperatorIds.has(op.employeeId))
        }
        let filteredTrainees = operators.filter(
            op => op.assignedTrainer && op.assignedTrainer !== '0' && op.status === 'Training'
        )
        if (selectedPlant) {
            filteredTrainees = filteredTrainees.filter(op => op.plantCode === selectedPlant || relevantOperatorIds.has(op.employeeId))
        }
        const rows = []
        const trainerTraineeCount = {}
        filteredTrainees.forEach(trainee => {
            const trainerId = trainee.assignedTrainer
            trainerTraineeCount[trainerId] = (trainerTraineeCount[trainerId] || 0) + 1
        })
        filteredTrainers.forEach(trainer => {
            const assignedMixer = relevantMixers.find(
                m => m.assignedOperator === trainer.employeeId
            )
            const trainerTrainees = filteredTrainees.filter(t => t.assignedTrainer === trainer.employeeId)
            const hasMultipleTrainees = trainerTraineeCount[trainer.employeeId] > 1
            if (trainerTrainees.length === 0) {
                rows.push({
                    truckNumber: assignedMixer ? assignedMixer.truckNumber || assignedMixer.unitNumber || assignedMixer.id : '',
                    trainer: trainer.name,
                    trainerPlant: trainer.plantCode,
                    trainerPosition: (trainer.position === 'Mixer Operator' || trainer.position === 'Tractor Operator') ? trainer.position : '',
                    trainee: '',
                    traineePosition: '',
                    hasMultipleTrainees: false
                })
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
                    })
                })
            }
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
            <div className="mixer-overview">
                <LoadingScreen message="Loading mixer data..." inline={true} />
            </div>
        )
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
            {selectedPlant && (
                <div style={{margin: '24px 0 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                    <div style={{fontWeight: 600, color: 'var(--accent)', marginBottom: 8, fontSize: '1.08rem'}}>
                        {plantReportRange && `Metrics for ${plantReportRange}`}
                    </div>
                    <div style={{display: 'flex', gap: 18, width: '100%', maxWidth: 700, justifyContent: 'center'}}>
                        <div className="summary-metric-card" style={{ borderColor: 'var(--divider)', flex: 1, marginRight: 0 }}>
                            <div className="summary-metric-title">Yards per Man-Hour</div>
                            <div className="summary-metric-value" style={{ color: 'var(--primary)' }}>
                                {plantReportMetrics && plantReportMetrics.yph !== null ? plantReportMetrics.yph.toFixed(2) : '--'}
                            </div>
                            <div className="summary-metric-grade" style={{ color: 'var(--primary)' }}>
                                {plantReportMetrics && plantReportMetrics.yphLabel}
                            </div>
                        </div>
                        <div className="summary-metric-card" style={{ borderColor: 'var(--divider)', flex: 1, marginLeft: 0 }}>
                            <div className="summary-metric-title">Yardage Lost</div>
                            <div className="summary-metric-value" style={{ color: 'var(--primary)' }}>
                                {plantReportMetrics && plantReportMetrics.lost !== null ? plantReportMetrics.lost : '--'}
                            </div>
                            <div className="summary-metric-grade" style={{ color: 'var(--primary)' }}>
                                {plantReportMetrics && plantReportMetrics.lostLabel}
                            </div>
                        </div>
                    </div>
                    {plantReportNote && (
                        <div
                            style={{
                                marginTop: 8,
                                color: 'var(--text-secondary)',
                                fontWeight: 500,
                                fontSize: '1rem',
                                cursor: lastReport ? 'pointer' : 'default',
                                textDecoration: lastReport ? 'underline' : 'none'
                            }}
                            onClick={lastReport ? handleShowLastReport : undefined}
                            tabIndex={lastReport ? 0 : -1}
                        >
                            {plantReportNote}
                        </div>
                    )}
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
    )
}

export default MixerOverview
