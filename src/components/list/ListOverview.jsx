import React, {useEffect, useState} from 'react'
import {ListService} from '../../services/ListService'
import './styles/ListOverview.css'

function ListOverview({listItems = [], selectedPlant = ''}) {
    const [, setPlants] = useState([])
    const [plantDistribution, setPlantDistribution] = useState({})
    const [, setIsLoading] = useState(false)

    useEffect(() => {
        async function fetchPlants() {
            setIsLoading(true)
            try {
                const data = await ListService.fetchPlants()
                setPlants(data)
            } finally {
                setIsLoading(false)
            }
        }

        fetchPlants()
    }, [])

    useEffect(() => {
        if (listItems.length) {
            setPlantDistribution(ListService.getPlantDistribution(listItems))
        }
    }, [listItems])

    const getPlantName = plantCode => ListService.getPlantName(plantCode)

    return (
        <div className="list-overview">
            <h1>List Overview</h1>
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
                        <h2 style={{marginLeft: 10}}>Plant Distribution</h2>
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
    )
}

export default ListOverview
