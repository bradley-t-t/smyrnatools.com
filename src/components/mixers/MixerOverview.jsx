import React, {useEffect, useState} from 'react';
import {MixerService} from '../../services/mixers/MixerService';
import {MixerUtils} from '../../models/Mixer';
import {PlantService} from '../../services/PlantService';
import './MixerOverview.css';

const MixerOverview = () => {
    const [mixers, setMixers] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusCounts, setStatusCounts] = useState({});
    const [plantCounts, setPlantCounts] = useState({});
    const [cleanlinessAvg, setCleanlinessAvg] = useState(0);
    const [needServiceCount, setNeedServiceCount] = useState(0);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch mixers and plants
            const mixersData = await MixerService.getAllMixers();
            setMixers(mixersData);

            const plantsData = await PlantService.fetchPlants();
            setPlants(plantsData);

            // Calculate statistics
            setStatusCounts(MixerUtils.getStatusCounts(mixersData));
            setPlantCounts(MixerUtils.getPlantCounts(mixersData));
            setCleanlinessAvg(MixerUtils.getCleanlinessAverage(mixersData));
            setNeedServiceCount(MixerUtils.getNeedServiceCount(mixersData));
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
            <h1>Mixer Fleet Overview</h1>

            <div className="overview-grid">
                {/* Status Card */}
                <div className="overview-card status-card">
                    <h2>Status Overview</h2>
                    <div className="status-grid">
                        <div className="status-item">
                            <div className="status-count">{statusCounts.Total || 0}</div>
                            <div className="status-label">Total Mixers</div>
                        </div>
                        <div className="status-item active">
                            <div className="status-count">{statusCounts.Active || 0}</div>
                            <div className="status-label">Active</div>
                        </div>
                        <div className="status-item in-shop">
                            <div className="status-count">{statusCounts['In Shop'] || 0}</div>
                            <div className="status-label">In Shop</div>
                        </div>
                        <div className="status-item spare">
                            <div className="status-count">{statusCounts.Spare || 0}</div>
                            <div className="status-label">Spare</div>
                        </div>
                        <div className="status-item retired">
                            <div className="status-count">{statusCounts.Retired || 0}</div>
                            <div className="status-label">Retired</div>
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
                    </div>
                </div>

                {/* Plant Distribution Card */}
                <div className="overview-card plant-card">
                    <h2>Plant Distribution</h2>
                    <div className="plant-list">
                        {Object.entries(plantCounts).map(([plantCode, count]) => (
                            <div key={plantCode} className="plant-item">
                                <div className="plant-name">{getPlantName(plantCode)}</div>
                                <div className="plant-count">{count}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MixerOverview;
