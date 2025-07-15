import React, {useEffect, useState} from 'react';
import {supabase} from '../../services/DatabaseService';
import './OperatorsOverview.css';

const OperatorsOverview = ({ filteredOperators = null, selectedPlant = '' }) => {
    const [operators, setOperators] = useState([]);
    const [plants, setPlants] = useState([]);
    const [statusCounts, setStatusCounts] = useState({});
    const [positionCounts, setPositionCounts] = useState({});
    const [plantDistributionByStatus, setPlantDistributionByStatus] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchPlants();
    }, []);

    useEffect(() => {
        if (filteredOperators) {
            updateStatistics(filteredOperators);
            setOperators(filteredOperators);
        }
    }, [filteredOperators]);

    const fetchPlants = async () => {
        setIsLoading(true);
        try {
            const {data, error} = await supabase
                .from('plants')
                .select('*');

            if (error) throw error;
            setPlants(data);
        } catch (error) {
        } finally {
            setIsLoading(false);
        }
    };

    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plant_code === plantCode);
        return plant ? plant.plant_name : plantCode || 'No Plant';
    };

    const updateStatistics = (operatorsData) => {
        const counts = {
            Total: operatorsData.length,
            Active: operatorsData.filter(op => op.status === 'Active').length,
            'Light Duty': operatorsData.filter(op => op.status === 'Light Duty').length,
            'Pending Start': operatorsData.filter(op => op.status === 'Pending Start').length,
            'Terminated': operatorsData.filter(op => op.status === 'Terminated').length,
            'Training': operatorsData.filter(op => op.status === 'Training').length
        };
        setStatusCounts(counts);

        const positions = {
            'Mixer Operator': operatorsData.filter(op => op.position === 'Mixer Operator').length,
            'Tractor Operator': operatorsData.filter(op => op.position === 'Tractor Operator').length,
            'Other': operatorsData.filter(op => !['Mixer Operator', 'Tractor Operator'].includes(op.position)).length,
            'Trainers': operatorsData.filter(op => op.isTrainer === true).length
        };
        setPositionCounts(positions);

        calculatePlantDistributionByStatus(operatorsData);
    };

    const calculatePlantDistributionByStatus = (operatorsData) => {
        const distribution = {};
        const uniquePlants = [...new Set(operatorsData.map(op => op.plantCode || 'Unassigned'))];

        uniquePlants.forEach(plant => {
            distribution[plant] = {
                Total: 0,
                Active: 0,
                'Light Duty': 0,
                'Pending Start': 0,
                Terminated: 0,
                'Training': 0,
                'Mixer Operator': 0,
                'Tractor Operator': 0,
                'Trainers': 0
            };
        });

        operatorsData.forEach(operator => {
            const plant = operator.plantCode || 'Unassigned';
            const status = operator.status || 'Unknown';
            const position = operator.position || 'Unknown';

            distribution[plant].Total++;

            if (['Active', 'Light Duty', 'Pending Start', 'Terminated', 'Training'].includes(status)) {
                distribution[plant][status]++;
            }

            if (['Mixer Operator', 'Tractor Operator'].includes(position)) {
                distribution[plant][position]++;
            }

            if (operator.isTrainer === true) {
                distribution[plant]['Trainers']++;
            }
        });

        setPlantDistributionByStatus(distribution);
    };

    return (
        <div className="operators-overview">
            <h1>
                Operators Overview
            </h1>
            <div style={{textAlign: 'center', marginBottom: '10px'}}>
                <span className="filtered-indicator">(Filtered: 20/167)</span>
            </div>
            {filteredOperators && (
                <div style={{textAlign: 'center', marginBottom: '15px'}}>
                    <div className="filter-indicator">
                        Showing statistics for {filteredOperators.length} operator{filteredOperators.length !== 1 ? 's' : ''}
                    </div>
                </div>
            )}

            <div className="overview-grid">
                <div className="overview-card status-card">
                    <h2>Status Overview</h2>
                    <div className="status-grid">
                        <div className="status-item">
                            <div className="status-count">{statusCounts.Total || 0}</div>
                            <div className="status-label">Total Operators</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{statusCounts.Active || 0}</div>
                            <div className="status-label">Active</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{statusCounts['Light Duty'] || 0}</div>
                            <div className="status-label">Light Duty</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{statusCounts['Pending Start'] || 0}</div>
                            <div className="status-label">Pending Start</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{statusCounts.Training || 0}</div>
                            <div className="status-label">Training</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{statusCounts.Terminated || 0}</div>
                            <div className="status-label">Terminated</div>
                        </div>
                    </div>
                </div>

                <div className="overview-card positions-card">
                    <h2>Positions Overview</h2>
                    <div className="positions-grid">
                        <div className="position-item">
                            <div className="position-count">{positionCounts['Mixer Operator'] || 0}</div>
                            <div className="position-label">Mixer Operators</div>
                        </div>
                        <div className="position-item">
                            <div className="position-count">{positionCounts['Tractor Operator'] || 0}</div>
                            <div className="position-label">Tractor Operators</div>
                        </div>
                        <div className="position-item">
                            <div className="position-count">{positionCounts['Trainers'] || 0}</div>
                            <div className="position-label">Trainers</div>
                        </div>
                        {positionCounts['Other'] > 0 && (
                            <div className="position-item">
                                <div className="position-count">{positionCounts['Other'] || 0}</div>
                                <div className="position-label">Other Positions</div>
                            </div>
                        )}
                    </div>
                </div>

                {(!selectedPlant || Object.keys(plantDistributionByStatus).length > 1) && (
                    <div className="overview-card plant-card">
                        <h2>Plant Distribution</h2>
                        <div className="plant-distribution-table">
                            <table className="distribution-table">
                                <thead>
                                <tr>
                                    <th>Plant</th>
                                    <th>Total</th>
                                    <th>Active</th>
                                    <th>Light Duty</th>
                                    <th>Training</th>
                                    <th>Pending</th>
                                    <th>Terminated</th>
                                </tr>
                                </thead>
                                <tbody>
                                {Object.entries(plantDistributionByStatus).map(([plantCode, counts]) => (
                                    <tr key={plantCode}>
                                        <td className="plant-name">{getPlantName(plantCode)}</td>
                                        <td>{counts.Total}</td>
                                        <td>{counts.Active}</td>
                                        <td>{counts['Light Duty']}</td>
                                        <td>{counts.Training}</td>
                                        <td>{counts['Pending Start']}</td>
                                        <td>{counts.Terminated}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="overview-card position-distribution-card">
                    <h2>Position Distribution by Plant</h2>
                    <div className="plant-distribution-table">
                        <table className="distribution-table">
                            <thead>
                            <tr>
                                <th>Plant</th>
                                <th>Total</th>
                                <th>Mixer Operators</th>
                                <th>Tractor Operators</th>
                                <th>Trainers</th>
                            </tr>
                            </thead>
                            <tbody>
                            {Object.entries(plantDistributionByStatus).map(([plantCode, counts]) => (
                                <tr key={plantCode}>
                                    <td className="plant-name">{getPlantName(plantCode)}</td>
                                    <td>{counts.Total}</td>
                                    <td>{counts['Mixer Operator']}</td>
                                    <td>{counts['Tractor Operator']}</td>
                                    <td>{counts['Trainers']}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OperatorsOverview;