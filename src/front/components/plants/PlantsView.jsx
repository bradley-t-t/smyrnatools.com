import React, {useEffect, useState} from 'react'
import {PlantService} from '../../../services/PlantService'
import LoadingScreen from '../common/LoadingScreen'
import '../../styles/FilterStyles.css'
import './styles/PlantsView.css'
import PlantsDetailView from './PlantsDetailView'
import PlantsAddView from './PlantsAddView'

function PlantsView({title = 'Plants'}) {
    const [plants, setPlants] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchText, setSearchText] = useState('')
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [selectedPlant, setSelectedPlant] = useState(null)

    useEffect(() => {
        async function fetchPlants() {
            setIsLoading(true)
            try {
                const data = await PlantService.fetchPlants()
                setPlants(data)
            } finally {
                setIsLoading(false)
            }
        }

        fetchPlants()
    }, [])

    function handleSelectPlant(plantCode) {
        const plant = plants.find(p => (p.plant_code || p.plantCode) === plantCode)
        setSelectedPlant(plant)
    }

    function handlePlantAdded(newPlant) {
        setPlants(prev => [...prev, newPlant])
    }

    async function handlePlantDeleted(plantCode) {
        setPlants(prev => prev.filter(p => (p.plant_code || p.plantCode) !== plantCode))
        setSelectedPlant(null)
    }

    async function handlePlantUpdated(plantCode) {
        const updatedPlants = await PlantService.fetchPlants()
        setPlants(updatedPlants)
        setSelectedPlant(updatedPlants.find(p => (p.plant_code || p.plantCode) === plantCode) || null)
    }

    const filteredPlants = plants.filter(plant => {
        const normalizedSearch = searchText.trim().toLowerCase()
        return !normalizedSearch ||
            (plant.plant_name || plant.plantName || '').toLowerCase().includes(normalizedSearch) ||
            (plant.plant_code || plant.plantCode || '').toLowerCase().includes(normalizedSearch)
    })

    return (
        <div className="dashboard-container plants-view">
            {selectedPlant ? (
                <PlantsDetailView
                    plant={selectedPlant}
                    onClose={() => setSelectedPlant(null)}
                    onDelete={handlePlantDeleted}
                    onUpdate={handlePlantUpdated}
                />
            ) : (
                <>
                    <div className="dashboard-header">
                        <h1>{title}</h1>
                        <div className="dashboard-actions">
                            <button
                                className="action-button primary rectangular-button"
                                onClick={() => setShowAddSheet(true)}
                                style={{height: '44px', lineHeight: '1'}}
                            >
                                <i className="fas fa-plus" style={{marginRight: '8px'}}></i> Add Plant
                            </button>
                        </div>
                    </div>
                    <div className="search-filters">
                        <div className="search-bar">
                            <input
                                type="text"
                                className="ios-search-input"
                                placeholder="Search by plant name or code..."
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                            />
                            {searchText && (
                                <button className="clear" onClick={() => setSearchText('')}>
                                    <i className="fas fa-times"></i>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="content-container">
                        {isLoading ? (
                            <div className="loading-container">
                                <LoadingScreen message="Loading plants..." inline={true}/>
                            </div>
                        ) : filteredPlants.length === 0 ? (
                            <div className="no-results-container">
                                <div className="no-results-icon">
                                    <i className="fas fa-seedling"></i>
                                </div>
                                <h3>No Plants Found</h3>
                                <p>{searchText ? "No plants match your search criteria." : "There are no plants in the system yet."}</p>
                                <button className="primary-button" onClick={() => setShowAddSheet(true)}>Add Plant
                                </button>
                            </div>
                        ) : (
                            <div className="mixers-list-table-container">
                                <table className="mixers-list-table">
                                    <thead>
                                    <tr>
                                        <th>Plant Code</th>
                                        <th>Name</th>
                                        <th>Status</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {filteredPlants.map(plant => (
                                        <tr key={plant.plant_code || plant.plantCode} style={{cursor: 'pointer'}}
                                            onClick={() => handleSelectPlant(plant.plant_code || plant.plantCode)}>
                                            <td>{plant.plant_code || plant.plantCode}</td>
                                            <td>{plant.plant_name || plant.plantName}</td>
                                            <td>
                                                    <span
                                                        className="item-status-dot"
                                                        style={{
                                                            display: 'inline-block',
                                                            verticalAlign: 'middle',
                                                            marginRight: '8px',
                                                            width: '10px',
                                                            height: '10px',
                                                            borderRadius: '50%',
                                                            backgroundColor:
                                                                plant.status === 'Active' ? 'var(--status-active)' :
                                                                    plant.status === 'Spare' ? 'var(--status-spare)' :
                                                                        plant.status === 'In Shop' ? 'var(--status-inshop)' :
                                                                            plant.status === 'Retired' ? 'var(--status-retired)' :
                                                                                'var(--accent)'
                                                        }}
                                                    ></span>
                                                {plant.status || 'Active'}
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    {showAddSheet && (
                        <PlantsAddView
                            onClose={() => setShowAddSheet(false)}
                            onPlantAdded={handlePlantAdded}
                        />
                    )}
                </>
            )}
        </div>
    )
}

export default PlantsView
