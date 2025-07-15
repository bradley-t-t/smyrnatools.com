import React, {useEffect, useState} from 'react';
import {supabase} from '../../core/clients/SupabaseClient';
import './ListOverview.css';

const ListOverview = ({ totalItems = 0, overdueItems = 0, listItems = [], selectedPlant = '' }) => {
    const [plants, setPlants] = useState([]);
    const [plantDistribution, setPlantDistribution] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchPlants();
    }, []);

    useEffect(() => {
        if (listItems.length > 0) {
            updateStatistics(listItems);
        }
    }, [listItems]);

    const fetchPlants = async () => {
        setIsLoading(true);
        try {
            const {data, error} = await supabase
                .from('plants')
                .select('*');

            if (error) throw error;
            setPlants(data);
        } catch (error) {
            console.error('Error fetching plants:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plant_code === plantCode);
        return plant ? plant.plant_name : plantCode || 'No Plant';
    };

    const updateStatistics = (items) => {
        // Plant distribution
        const distribution = {};
        const uniquePlants = [...new Set(items.map(item => item.plantCode || 'Unassigned'))];

        uniquePlants.forEach(plant => {
            distribution[plant] = {
                Total: 0,
                Pending: 0,
                Completed: 0,
                Overdue: 0
            };
        });

        items.forEach(item => {
            const plant = item.plantCode || 'Unassigned';
            distribution[plant].Total++;

            if (item.completed) {
                distribution[plant].Completed++;
            } else {
                distribution[plant].Pending++;
                if (item.isOverdue) {
                    distribution[plant].Overdue++;
                }
            }
        });

        setPlantDistribution(distribution);
    };

    return (
        <div className="list-overview">
            <h1>
                List Overview
            </h1>

            {listItems.length > 0 && (
                <div style={{textAlign: 'center', marginBottom: '15px'}}>
                    <div className="filter-indicator">
                        Showing statistics for {listItems.length} item{listItems.length !== 1 ? 's' : ''}
                    </div>
                </div>
            )}

            <div className="overview-grid">
                {(!selectedPlant || Object.keys(plantDistribution).length > 1) && (
                    <div className="overview-card plant-card">
                        <h2>Plant Distribution</h2>
                        <div className="plant-distribution-table">
                            <table className="distribution-table">
                                <thead>
                                <tr>
                                    <th>Plant</th>
                                    <th>Total</th>
                                    <th>Pending</th>
                                    <th>Overdue</th>
                                </tr>
                                </thead>
                                <tbody>
                                {Object.entries(plantDistribution).map(([plantCode, counts]) => (
                                    <tr key={plantCode}>
                                        <td className="plant-name">{getPlantName(plantCode)}</td>
                                        <td>{counts.Total}</td>
                                        <td>{counts.Pending}</td>
                                        <td>{counts.Overdue}</td>
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
};

export default ListOverview;
