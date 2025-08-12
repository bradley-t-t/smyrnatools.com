import React, { useEffect, useState } from 'react';
import './styles/OperatorsView.css';
import '../../styles/FilterStyles.css';
import { supabase } from '../../../services/DatabaseService';
import { UserService } from '../../../services/UserService';
import LoadingScreen from '../common/LoadingScreen';
import OperatorDetailView from './OperatorDetailView';
import OperatorCard from './OperatorCard';
import OperatorsOverview from './OperatorsOverview';
import OperatorAddView from './OperatorAddView';
import { usePreferences } from '../../../app/context/PreferencesContext';
import FormatUtility from '../../../utils/FormatUtility';

function OperatorsView({ title = 'Operator Roster', showSidebar, setShowSidebar, onSelectOperator, initialStatusFilter }) {
    const { preferences, updateOperatorFilter, resetOperatorFilters } = usePreferences()
    const [operators, setOperators] = useState([])
    const [plants, setPlants] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchText, setSearchText] = useState(preferences.operatorFilters?.searchText || '')
    const [selectedPlant, setSelectedPlant] = useState(preferences.operatorFilters?.selectedPlant || '')
    const [statusFilter, setStatusFilter] = useState(preferences.operatorFilters?.statusFilter || '')
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [showOverview, setShowOverview] = useState(false)
    const [showDetailView, setShowDetailView] = useState(false)
    const [selectedOperator, setSelectedOperator] = useState(null)
    const [currentUserId, setCurrentUserId] = useState(null)
    const [trainers, setTrainers] = useState([])
    const [scheduledOffMap, setScheduledOffMap] = useState([])
    const [reloadFlag, setReloadFlag] = useState(false)
    const [viewMode, setViewMode] = useState(() => {
        if (preferences.operatorFilters?.viewMode !== undefined && preferences.operatorFilters?.viewMode !== null) return preferences.operatorFilters.viewMode
        if (preferences.defaultViewMode !== undefined && preferences.defaultViewMode !== null) return preferences.defaultViewMode
        const lastUsed = localStorage.getItem('operators_last_view_mode')
        return lastUsed || 'grid'
    })
    const statuses = ['Active', 'Light Duty', 'Pending Start', 'Terminated', 'Training']
    const filterOptions = [
        'All Statuses', 'Active', 'Light Duty', 'Pending Start', 'Terminated', 'Training',
        'Trainer', 'Not Trainer'
    ]

    useEffect(() => {
        const fetchCurrentUser = async () => {
            const user = await UserService.getCurrentUser()
            if (user) {
                setCurrentUserId(user.id)
            }
        }
        fetchCurrentUser()
    }, [])

    useEffect(() => {
        fetchAllData()
    }, [reloadFlag])

    useEffect(() => {
        if (preferences.operatorFilters) {
            setSearchText(preferences.operatorFilters.searchText || '')
            setSelectedPlant(preferences.operatorFilters.selectedPlant || '')
            setStatusFilter(preferences.operatorFilters.statusFilter || '')
            setViewMode(preferences.operatorFilters.viewMode || preferences.defaultViewMode || 'grid')
        }
    }, [preferences.operatorFilters, preferences.defaultViewMode])

    useEffect(() => {
        if (initialStatusFilter) {
            setStatusFilter(initialStatusFilter)
        }
    }, [initialStatusFilter])

    const fetchAllData = async () => {
        setIsLoading(true)
        try {
            await Promise.all([
                fetchOperators(),
                fetchPlants(),
                fetchTrainers(),
                fetchScheduledOff()
            ])
        } catch (error) {
        } finally {
            setIsLoading(false)
        }
    }

    const fetchOperators = async () => {
        try {
            const { data, error } = await supabase
                .from('operators')
                .select('*')
            if (error) throw error
            const formattedOperators = data.map(op => ({
                employeeId: op.employee_id,
                smyrnaId: op.smyrna_id || '',
                name: op.name,
                plantCode: op.plant_code,
                status: op.status,
                isTrainer: op.is_trainer,
                assignedTrainer: op.assigned_trainer,
                position: op.position,
                pendingStartDate: op.pending_start_date || '',
                rating: typeof op.rating === 'number' ? op.rating : Number(op.rating) || 0
            }))
            setOperators(formattedOperators)
            localStorage.setItem('cachedOperators', JSON.stringify(formattedOperators))
            localStorage.setItem('cachedOperatorsDate', new Date().toISOString())
        } catch (error) {
            const cachedData = localStorage.getItem('cachedOperators')
            const cacheDate = localStorage.getItem('cachedOperatorsDate')
            if (cachedData && cacheDate) {
                const cachedTime = new Date(cacheDate).getTime()
                const hourAgo = new Date().getTime() - 3600000
                if (cachedTime > hourAgo) {
                    setOperators(JSON.parse(cachedData))
                }
            }
        }
    }

    const fetchPlants = async () => {
        try {
            const { data, error } = await supabase
                .from('plants')
                .select('*')
            if (error) throw error
            setPlants(data)
        } catch (error) {
        }
    }

    const fetchTrainers = async () => {
        try {
            const { data, error } = await supabase
                .from('operators')
                .select('employee_id, name')
                .eq('is_trainer', true)
            if (error) throw error
            setTrainers(data.map(t => ({
                employeeId: t.employee_id,
                name: t.name
            })))
        } catch (error) {
            setTrainers([])
        }
    }

    const fetchScheduledOff = async () => {
        try {
            const { data, error } = await supabase
                .from('operators_scheduled_off')
                .select('id, days_off')
            if (error) throw error
            const map = {}
            (data || []).forEach(item => {
                map[item.id] = Array.isArray(item.days_off) ? item.days_off : []
            })
            setScheduledOffMap(map)
        } catch (error) {
            setScheduledOffMap({})
        }
    }

    const reloadAll = async () => {
        await fetchAllData()
    }

    const deleteOperator = async (operatorId) => {
        try {
            const { error } = await supabase
                .from('operators')
                .delete()
                .eq('employee_id', operatorId)
            if (error) throw error
            fetchOperators()
            setSelectedOperator(null)
        } catch (error) {
            alert('Failed to delete operator. Please try again.')
        }
    }

    const filteredOperators = operators
        .filter(operator => {
            const matchesSearch = searchText.trim() === '' ||
                operator.name.toLowerCase().includes(searchText.toLowerCase()) ||
                operator.employeeId.toLowerCase().includes(searchText.toLowerCase())
            const matchesPlant = selectedPlant === '' || operator.plantCode === selectedPlant
            let matchesStatus = true
            if (statusFilter && statusFilter !== 'All Statuses') {
                if (statuses.includes(statusFilter)) {
                    matchesStatus = operator.status === statusFilter
                } else if (statusFilter === 'Trainer') {
                    matchesStatus = operator.isTrainer === true || String(operator.isTrainer).toLowerCase() === 'true'
                } else if (statusFilter === 'Not Trainer') {
                    matchesStatus = operator.isTrainer !== true && String(operator.isTrainer).toLowerCase() !== 'true'
                }
            }
            return matchesSearch && matchesPlant && matchesStatus
        })
        .sort((a, b) => {
            if (a.status === 'Active' && b.status !== 'Active') return -1
            if (a.status !== 'Active' && b.status === 'Active') return 1
            if (a.status === 'Training' && b.status !== 'Training') return -1
            if (a.status !== 'Training' && b.status === 'Training') return 1
            if (a.status === 'Pending Start' && b.status !== 'Pending Start') return -1
            if (a.status !== 'Pending Start' && b.status === 'Pending Start') return 1
            if (a.status === 'Terminated' && b.status !== 'Terminated') return 1
            if (a.status !== 'Terminated' && b.status === 'Terminated') return -1
            if (a.status !== b.status) return a.status.localeCompare(b.status)
            const nameA = a.name.split(' ').pop().toLowerCase()
            const nameB = b.name.split(' ').pop().toLowerCase()
            return nameA.localeCompare(nameB)
        })

    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plant_code === plantCode)
        return plant ? plant.plant_name : plantCode || 'No Plant'
    }

    const handleSelectOperator = (operator) => {
        setSelectedOperator(operator)
        if (onSelectOperator) {
            onSelectOperator(operator.employeeId)
        } else {
            setShowDetailView(true)
        }
    }

    function handleStatusClick(status) {
        if (status === 'All Statuses') {
            setStatusFilter('')
            updateOperatorFilter('statusFilter', '')
        } else {
            setStatusFilter(status)
            updateOperatorFilter('statusFilter', status)
        }
        setShowOverview(false)
    }

    const statusesForCounts = ['Active', 'Light Duty', 'Pending Start', 'Terminated', 'Training']
    const statusCounts = statusesForCounts.map(status => ({
        status,
        count: operators.filter(op => op.status === status).length
    }))

    const trainerCount = operators.filter(op => op.isTrainer).length

    const OverviewPopup = () => (
        <div className="modal-backdrop" onClick={() => setShowOverview(false)}>
            <div className="modal-content overview-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Operators Overview</h2>
                    <button className="close-button" onClick={() => setShowOverview(false)}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <OperatorsOverview
                        filteredOperators={filteredOperators}
                        selectedPlant={selectedPlant}
                        onStatusClick={handleStatusClick}
                    />
                </div>
                <div className="modal-footer">
                    <button className="primary-button" onClick={() => setShowOverview(false)}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    )

    function formatDate(dateStr) {
        return FormatUtility.formatDate(dateStr)
    }

    function getFiltersAppliedString() {
        const filters = []
        if (searchText) filters.push(`Search: ${searchText}`)
        if (selectedPlant) {
            const plant = plants.find(p => p.plant_code === selectedPlant)
            filters.push(`Plant: ${plant ? plant.plant_name : selectedPlant}`)
        }
        if (statusFilter && statusFilter !== 'All Statuses') filters.push(`Status: ${statusFilter}`)
        return filters.length ? filters.join(', ') : 'No Filters'
    }

    function exportOperatorsToCSV(operatorsToExport) {
        if (!operatorsToExport || operatorsToExport.length === 0) return
        const now = new Date()
        const pad = n => n.toString().padStart(2, '0')
        const yyyy = now.getFullYear()
        const mm = pad(now.getMonth() + 1)
        const dd = pad(now.getDate())
        const hh = pad(now.getHours())
        const min = pad(now.getMinutes())
        const formattedNow = `${mm}-${dd}-${yyyy} ${hh}-${min}`
        const filtersApplied = getFiltersAppliedString()
        const fileName = `Operator Export - ${formattedNow} - ${filtersApplied}.csv`
        const topHeader = `Operator Export - ${formattedNow} - ${filtersApplied}`
        const headers = [
            'Smyrna ID',
            'Name',
            'Plant',
            'Status',
            'Position',
            'Trainer',
            'Pending Start Date',
            'Rating'
        ]
        const rows = operatorsToExport.map(op => [
            op.smyrnaId || '',
            op.name || '',
            getPlantName(op.plantCode),
            op.status || '',
            op.position || '',
            op.isTrainer ? 'Yes' : 'No',
            op.pendingStartDate ? formatDate(op.pendingStartDate) : '',
            typeof op.rating === 'number' ? op.rating : ''
        ])
        const csvContent = [
            `"${topHeader}"`,
            headers.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','),
            ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        ].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    function handleViewModeChange(mode) {
        if (viewMode === mode) {
            setViewMode(null)
            updateOperatorFilter('viewMode', null)
            localStorage.removeItem('operators_last_view_mode')
        } else {
            setViewMode(mode)
            updateOperatorFilter('viewMode', mode)
            localStorage.setItem('operators_last_view_mode', mode)
        }
    }

    return (
        <div className="dashboard-container operators-view">
            {showDetailView && selectedOperator && (
                <OperatorDetailView
                    operatorId={selectedOperator.employeeId}
                    onClose={() => {
                        setShowDetailView(false)
                        fetchOperators()
                    }}
                    onScheduledOffSaved={reloadAll}
                />
            )}
            {!showDetailView && (
                <>
                    <div className="dashboard-header">
                        <h1>
                            {title}
                        </h1>
                        <div className="dashboard-actions">
                            <button
                                className="action-button primary rectangular-button"
                                style={{marginRight: 8, minWidth: 210}}
                                onClick={() => exportOperatorsToCSV(filteredOperators)}
                            >
                                <i className="fas fa-file-export" style={{marginRight: 8}}></i> Export
                            </button>
                            <button
                                className="action-button primary rectangular-button"
                                onClick={() => setShowAddSheet(true)}
                                style={{ height: '44px', lineHeight: '1' }}
                            >
                                <i className="fas fa-plus" style={{ marginRight: '8px' }}></i> Add Operator
                            </button>
                        </div>
                    </div>
                    <div className="search-filters">
                        <div className="search-bar">
                            <input
                                type="text"
                                className="ios-search-input"
                                placeholder="Search by name or ID..."
                                value={searchText}
                                onChange={(e) => {
                                    const value = e.target.value
                                    setSearchText(value)
                                    updateOperatorFilter('searchText', value)
                                }}
                            />
                            {searchText && (
                                <button className="clear" onClick={() => {
                                    setSearchText('')
                                    updateOperatorFilter('searchText', '')
                                }}>
                                    <i className="fas fa-times"></i>
                                </button>
                            )}
                        </div>
                        <div className="filters">
                            <div className="view-toggle-icons">
                                <button
                                    className={`view-toggle-btn${viewMode === 'grid' ? ' active' : ''}`}
                                    onClick={() => handleViewModeChange('grid')}
                                    aria-label="Grid view"
                                    type="button"
                                >
                                    <i className="fas fa-th-large"></i>
                                </button>
                                <button
                                    className={`view-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
                                    onClick={() => handleViewModeChange('list')}
                                    aria-label="List view"
                                    type="button"
                                >
                                    <i className="fas fa-list"></i>
                                </button>
                            </div>
                            <div className="filter-wrapper">
                                <select
                                    className="ios-select"
                                    value={selectedPlant}
                                    onChange={(e) => {
                                        const value = e.target.value
                                        setSelectedPlant(value)
                                        updateOperatorFilter('selectedPlant', value)
                                    }}
                                    aria-label="Filter by plant"
                                    style={{
                                        '--select-active-border': preferences.accentColor === 'red' ? '#b80017' : '#003896',
                                        '--select-focus-border': preferences.accentColor === 'red' ? '#b80017' : '#003896'
                                    }}
                                >
                                    <option value="">All Plants</option>
                                    {plants.sort((a, b) => {
                                        const aCode = parseInt(a.plant_code?.replace(/\D/g, '') || '0')
                                        const bCode = parseInt(b.plant_code?.replace(/\D/g, '') || '0')
                                        return aCode - bCode
                                    }).map(plant => (
                                        <option key={plant.plant_code} value={plant.plant_code}>
                                            ({plant.plant_code}) {plant.plant_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="filter-wrapper">
                                <select
                                    className="ios-select"
                                    value={statusFilter}
                                    onChange={(e) => {
                                        const value = e.target.value
                                        setStatusFilter(value)
                                        updateOperatorFilter('statusFilter', value)
                                    }}
                                    style={{
                                        '--select-active-border': preferences.accentColor === 'red' ? '#b80017' : '#003896',
                                        '--select-focus-border': preferences.accentColor === 'red' ? '#b80017' : '#003896'
                                    }}
                                >
                                    {filterOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            {(searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses')) && (
                                <button className="filter-reset-button" onClick={() => {
                                    setSearchText('')
                                    setSelectedPlant('')
                                    setStatusFilter('')
                                    updateOperatorFilter('searchText', '')
                                    updateOperatorFilter('selectedPlant', '')
                                    updateOperatorFilter('statusFilter', '')
                                }}>
                                    <i className="fas fa-undo"></i>
                                </button>
                            )}
                            <button className="ios-button" onClick={() => setShowOverview(true)}>
                                <i className="fas fa-chart-bar"></i>
                                Overview
                            </button>
                        </div>
                    </div>
                    <div className="content-container">
                        {isLoading ? (
                            <div className="loading-container">
                                <LoadingScreen message="Loading operators..." inline={true} />
                            </div>
                        ) : filteredOperators.length === 0 ? (
                            <div className="no-results-container">
                                <div className="no-results-icon">
                                    <i className="fas fa-user-slash"></i>
                                </div>
                                <h3>No Operators Found</h3>
                                <p>
                                    {searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses')
                                        ? "No operators match your search criteria."
                                        : "There are no operators in the system yet."}
                                </p>
                                <button className="primary-button" onClick={() => setShowAddSheet(true)}>
                                    Add Operator
                                </button>
                            </div>
                        ) : viewMode === 'grid' ? (
                            <div className={`operators-grid ${searchText ? 'search-results' : ''}`}>
                                {filteredOperators.map(operator => (
                                    <OperatorCard
                                        key={operator.employeeId}
                                        operator={{
                                            ...operator,
                                            daysOff: scheduledOffMap[operator.employeeId] || []
                                        }}
                                        plantName={getPlantName(operator.plantCode)}
                                        trainers={trainers}
                                        onSelect={handleSelectOperator}
                                        rating={operator.rating}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="operators-list-table-container">
                                <table className="operators-list-table">
                                    <thead>
                                        <tr>
                                            <th>Plant</th>
                                            <th>Name</th>
                                            <th>Status</th>
                                            <th>Position</th>
                                            <th>Trainer</th>
                                            <th>Rating</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredOperators.map(operator => (
                                            <tr key={operator.employeeId} style={{cursor: 'pointer'}} onClick={() => handleSelectOperator(operator)}>
                                                <td>{operator.plantCode ? operator.plantCode : "---"}</td>
                                                <td>{operator.name ? operator.name : "---"}</td>
                                                <td>
                                                    <span
                                                        className="item-status-dot"
                                                        style={{
                                                            display: 'inline-block',
                                                            verticalAlign: 'middle',
                                                            marginRight: '8px',
                                                            backgroundColor:
                                                                operator.status === 'Active' ? 'var(--status-active)' :
                                                                operator.status === 'Light Duty' ? 'var(--status-spare)' :
                                                                operator.status === 'Training' ? 'var(--status-inshop)' :
                                                                operator.status === 'Terminated' ? 'var(--status-retired)' :
                                                                operator.status === 'Pending Start' ? 'var(--status-inshop)' :
                                                                'var(--accent)',
                                                        }}
                                                    ></span>
                                                    {operator.status ? operator.status : "---"}
                                                </td>
                                                <td>{operator.position ? operator.position : "---"}</td>
                                                <td>{operator.isTrainer ? "Yes" : "No"}</td>
                                                <td>
                                                    {(() => {
                                                        const rating = Math.round(operator.rating || 0)
                                                        const stars = rating > 0 ? rating : 1
                                                        return Array.from({length: stars}).map((_, i) => (
                                                            <i key={i} className="fas fa-star" style={{color: 'var(--accent)'}}></i>
                                                        ))
                                                    })()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    {showAddSheet && (
                        <OperatorAddView
                            plants={plants}
                            operators={operators}
                            onClose={() => setShowAddSheet(false)}
                            onOperatorAdded={() => {
                                fetchOperators();
                                setShowAddSheet(false);
                            }}
                        />
                    )}

                    {showOverview && <OverviewPopup />}
                </>
            )}
        </div>
    )
}

export default OperatorsView
