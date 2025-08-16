import React, { useEffect, useState } from 'react'
import { RegionService } from '../../../services/RegionService'
import LoadingScreen from '../common/LoadingScreen'
import '../../styles/FilterStyles.css'
import './styles/RegionsView.css'
import RegionsDetailView from './RegionsDetailView'
import RegionsAddView from './RegionsAddView'

function RegionsView({ title = 'Regions', showSidebar, setShowSidebar }) {
    const [regions, setRegions] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchText, setSearchText] = useState('')
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [selectedRegion, setSelectedRegion] = useState(null)

    useEffect(() => {
        async function fetchRegions() {
            setIsLoading(true)
            try {
                const data = await RegionService.fetchRegions()
                setRegions(data)
            } finally {
                setIsLoading(false)
            }
        }
        fetchRegions()
    }, [])

    function handleSelectRegion(regionCode) {
        const region = regions.find(r => (r.region_code || r.regionCode) === regionCode)
        setSelectedRegion(region)
    }

    function handleRegionAdded(newRegion) {
        setRegions(prev => [...prev, newRegion])
    }

    async function handleRegionDeleted(regionCode) {
        setRegions(prev => prev.filter(r => (r.region_code || r.regionCode) !== regionCode))
        setSelectedRegion(null)
    }

    async function handleRegionUpdated(regionCode, regionName) {
        const updatedRegions = await RegionService.fetchRegions()
        setRegions(updatedRegions)
        setSelectedRegion(updatedRegions.find(r => (r.region_code || r.regionCode) === regionCode) || null)
    }

    const filteredRegions = regions.filter(region => {
        const normalizedSearch = searchText.trim().toLowerCase()
        return !normalizedSearch ||
            (region.region_name || region.regionName || '').toLowerCase().includes(normalizedSearch) ||
            (region.region_code || region.regionCode || '').toLowerCase().includes(normalizedSearch)
    })

    return (
        <div className="dashboard-container regions-view">
            {selectedRegion ? (
                <RegionsDetailView
                    region={selectedRegion}
                    onClose={() => setSelectedRegion(null)}
                    onDelete={handleRegionDeleted}
                    onUpdate={handleRegionUpdated}
                />
            ) : (
                <>
                    <div className="dashboard-header">
                        <h1>{title}</h1>
                        <div className="dashboard-actions">
                            <button
                                className="action-button primary rectangular-button"
                                onClick={() => setShowAddSheet(true)}
                                style={{ height: '44px', lineHeight: '1' }}
                            >
                                <i className="fas fa-plus" style={{ marginRight: '8px' }}></i> Add Region
                            </button>
                        </div>
                    </div>
                    <div className="search-filters">
                        <div className="search-bar">
                            <input
                                type="text"
                                className="ios-search-input"
                                placeholder="Search by region name or code..."
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
                                <LoadingScreen message="Loading regions..." inline={true} />
                            </div>
                        ) : filteredRegions.length === 0 ? (
                            <div className="no-results-container">
                                <div className="no-results-icon">
                                    <i className="fas fa-globe"></i>
                                </div>
                                <h3>No Regions Found</h3>
                                <p>{searchText ? "No regions match your search criteria." : "There are no regions in the system yet."}</p>
                                <button className="primary-button" onClick={() => setShowAddSheet(true)}>Add Region</button>
                            </div>
                        ) : (
                            <div className="mixers-list-table-container">
                                <table className="mixers-list-table">
                                    <thead>
                                        <tr>
                                            <th>Region Code</th>
                                            <th>Name</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRegions.map(region => (
                                            <tr key={region.region_code || region.regionCode} style={{ cursor: 'pointer' }} onClick={() => handleSelectRegion(region.region_code || region.regionCode)}>
                                                <td>{region.region_code || region.regionCode}</td>
                                                <td>{region.region_name || region.regionName}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    {showAddSheet && (
                        <RegionsAddView
                            onClose={() => setShowAddSheet(false)}
                            onRegionAdded={handleRegionAdded}
                        />
                    )}
                </>
            )}
        </div>
    )
}

export default RegionsView
