import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import EquipmentAddView from './EquipmentAddView';
import EquipmentUtility from '../../utils/EquipmentUtility';
import {EquipmentService} from '../../services/EquipmentService';
import {PlantService} from '../../services/PlantService';
import LoadingScreen from '../common/LoadingScreen';
import {usePreferences} from '../../app/context/PreferencesContext';
import EquipmentCard from './EquipmentCard';
import EquipmentDetailView from './EquipmentDetailView';
import '../../styles/FilterStyles.css';
import './styles/EquipmentsView.css';
import EquipmentIssueModal from './EquipmentIssueModal'
import EquipmentCommentModal from './EquipmentCommentModal'
import {RegionService} from '../../services/RegionService'
import {debounce} from '../../utils/AsyncUtility'
import {getPlantName as lookupGetPlantName} from '../../utils/LookupUtility'
import FleetUtility from '../../utils/FleetUtility'
import TopSection from '../sections/TopSection'

function EquipmentsView({title = 'Equipment Fleet', onSelectEquipment}) {
    const {preferences, updateEquipmentFilter, resetEquipmentFilters, saveLastViewedFilters} = usePreferences();
    const safeUpdateEquipmentFilter = typeof updateEquipmentFilter === 'function' ? updateEquipmentFilter : () => {};
    const [equipments, setEquipments] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchText, setSearchText] = useState(preferences.equipmentFilters?.searchText || '');
    const [searchInput, setSearchInput] = useState(preferences.equipmentFilters?.searchText || '');
    const [selectedPlant, setSelectedPlant] = useState(preferences.equipmentFilters?.selectedPlant || '');
    const [statusFilter, setStatusFilter] = useState(preferences.equipmentFilters?.statusFilter || '');
    const [showAddSheet, setShowAddSheet] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [viewMode, setViewMode] = useState(() => {
        if (preferences.equipmentFilters?.viewMode !== undefined && preferences.equipmentFilters?.viewMode !== null) return preferences.equipmentFilters.viewMode
        if (preferences.defaultViewMode !== undefined && preferences.defaultViewMode !== null) return preferences.defaultViewMode
        const lastUsed = localStorage.getItem('equipments_last_view_mode')
        return lastUsed || 'grid'
    });
    const [showIssueModal, setShowIssueModal] = useState(false)
    const [showCommentModal, setShowCommentModal] = useState(false)
    const [modalEquipmentId, setModalEquipmentId] = useState(null)
    const [modalEquipmentNumber, setModalEquipmentNumber] = useState('')
    const [regionPlantCodes, setRegionPlantCodes] = useState(null)
    const filterOptions = ['All Statuses', 'Active', 'Spare', 'In Shop', 'Retired', 'Past Due Service', 'Open Issues'];
    const headerRef = useRef(null)

    useEffect(() => {
        async function fetchAllData() {
            setIsLoading(true);
            try { await Promise.all([fetchEquipments(), fetchPlants()]); } finally { setIsLoading(false); }
        }
        fetchAllData();
        if (preferences?.equipmentFilters) {
            setSearchText(preferences.equipmentFilters.searchText || '');
            setSearchInput(preferences.equipmentFilters.searchText || '');
            setSelectedPlant(preferences.equipmentFilters.selectedPlant || '');
            setStatusFilter(preferences.equipmentFilters.statusFilter || '');
            setViewMode(preferences.equipmentFilters.viewMode || preferences.defaultViewMode || 'grid');
        }
    }, [preferences]);

    useEffect(() => {
        const code = preferences.selectedRegion?.code || ''
        let cancelled = false
        async function loadRegionPlants() {
            if (!code) { setRegionPlantCodes(null); return }
            try {
                const regionPlants = await RegionService.fetchRegionPlants(code)
                if (cancelled) return
                const codes = new Set(regionPlants.map(p => p.plantCode))
                setRegionPlantCodes(codes)
                if (selectedPlant && !codes.has(selectedPlant)) { setSelectedPlant(''); safeUpdateEquipmentFilter('selectedPlant', '') }
            } catch { setRegionPlantCodes(new Set()) }
        }
        loadRegionPlants()
        return () => { cancelled = true }
    }, [preferences.selectedRegion?.code])

    async function fetchEquipments() {
        try {
            const data = await EquipmentService.fetchEquipments();
            const base = (Array.isArray(data) ? data : []).map(e => { const x = {...e}; if (typeof x.openIssuesCount !== 'number') x.openIssuesCount = 0; if (typeof x.commentsCount !== 'number') x.commentsCount = 0; return x })
            setEquipments(base)
            ;(async () => {
                const items = base.slice(); let index = 0; const concurrency = 6
                async function worker() {
                    while (index < items.length) { const current = index++; const item = items[current]; try { const [comments, issues] = await Promise.all([EquipmentService.fetchComments(item.id).catch(() => []), EquipmentService.fetchIssues(item.id).catch(() => [])]); const openIssuesCount = Array.isArray(issues) ? issues.filter(i => !i.time_completed).length : 0; const commentsCount = Array.isArray(comments) ? comments.length : 0; setEquipments(prev => { const arr = prev.slice(); const idx = arr.findIndex(z => z.id === item.id); if (idx >= 0) arr[idx] = {...arr[idx], comments, issues, openIssuesCount, commentsCount}; return arr }) } catch {} }
                }
                await Promise.all(Array.from({length: concurrency}, () => worker()))
            })()
        } catch { setEquipments([]); }
    }

    async function fetchPlants() { try { const data = await PlantService.fetchPlants(); setPlants(data); } catch {} }

    function handleSelectEquipment(equipmentId) {
        const equipment = equipments.find(e => e.id === equipmentId);
        if (!equipment || !equipment.id) return;
        saveLastViewedFilters();
        setSelectedEquipment(equipment);
        if (onSelectEquipment) onSelectEquipment(equipmentId);
    }

    const debouncedSetSearchText = useCallback(debounce(value => { setSearchText(value); safeUpdateEquipmentFilter('searchText', value); }, 300), [safeUpdateEquipmentFilter]);

    const filteredEquipments = useMemo(() => equipments.filter(equipment => {
        const matchesSearch = !searchText.trim() || equipment.identifyingNumber?.toLowerCase().includes(searchText.toLowerCase()) || equipment.equipmentType?.toLowerCase().includes(searchText.toLowerCase());
        const matchesPlant = !selectedPlant || equipment.assignedPlant === selectedPlant;
        const matchesRegion = !preferences.selectedRegion?.code || !regionPlantCodes || regionPlantCodes.has(equipment.assignedPlant);
        let matchesStatus = true;
        if (statusFilter && statusFilter !== 'All Statuses') {
            matchesStatus = ['Active','Spare','In Shop','Retired'].includes(statusFilter) ? equipment.status === statusFilter : statusFilter === 'Past Due Service' ? EquipmentUtility.isServiceOverdue(equipment.lastServiceDate) : statusFilter === 'Open Issues' ? Number(equipment.openIssuesCount || 0) > 0 : false
        }
        return matchesSearch && matchesPlant && matchesRegion && matchesStatus;
    }).sort((a,b) => FleetUtility.compareByStatusThenNumber(a,b,'status','identifyingNumber')), [equipments, selectedPlant, searchText, statusFilter, preferences.selectedRegion?.code, regionPlantCodes]);

    useEffect(() => {
        if (preferences.equipmentFilters?.viewMode !== undefined && preferences.equipmentFilters?.viewMode !== null) setViewMode(preferences.equipmentFilters.viewMode)
        else if (preferences.defaultViewMode !== undefined && preferences.defaultViewMode !== null) setViewMode(preferences.defaultViewMode)
        else { const lastUsed = localStorage.getItem('equipments_last_view_mode'); if (lastUsed) setViewMode(lastUsed) }
    }, [preferences])

    function handleViewModeChange(mode) {
        if (viewMode === mode) { setViewMode(null); updateEquipmentFilter('viewMode', null); localStorage.removeItem('equipments_last_view_mode') }
        else { setViewMode(mode); updateEquipmentFilter('viewMode', mode); localStorage.setItem('equipments_last_view_mode', mode) }
    }

    useEffect(() => {
        function updateStickyCoverHeight() {
            const el = headerRef.current
            const h = el ? Math.ceil(el.getBoundingClientRect().height) : 0
            const root = document.querySelector('.global-dashboard-container.equipments-view')
            if (root && h) root.style.setProperty('--sticky-cover-height', h + 'px')
        }
        updateStickyCoverHeight()
        window.addEventListener('resize', updateStickyCoverHeight)
        return () => window.removeEventListener('resize', updateStickyCoverHeight)
    }, [viewMode, searchInput, selectedPlant, statusFilter])

    const content = useMemo(() => {
        if (isLoading) return <div className="global-loading-container loading-container"><LoadingScreen message="Loading equipment..." inline={true}/></div>
        if (filteredEquipments.length === 0) return <div className="global-no-results-container no-results-container"><div className="no-results-icon"><i className="fas fa-truck-loading"></i></div><h3>No Equipment Found</h3><p>{searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses') ? "No equipment matches your search criteria." : "There is no equipment in the system yet."}</p><button className="global-primary-button primary-button" onClick={() => setShowAddSheet(true)}>Add Equipment</button></div>
        if (viewMode === 'grid') return <div className={`global-grid equipments-grid ${searchText ? 'search-results' : ''}`}>{filteredEquipments.map(equipment => <EquipmentCard key={equipment.id} equipment={equipment} plantName={lookupGetPlantName(plants, equipment.assignedPlant)} onSelect={() => handleSelectEquipment(equipment.id)}/> )}</div>
        return <div className="equipments-list-table-container"><table className="equipments-list-table"><colgroup><col style={{width:'12%'}}/><col style={{width:'14%'}}/><col style={{width:'12%'}}/><col style={{width:'24%'}}/><col style={{width:'14%'}}/><col style={{width:'16%'}}/><col style={{width:'8%'}}/></colgroup><tbody>{filteredEquipments.map(equipment => { const issuesCount = Number(equipment.openIssuesCount || 0); const commentsCount = Number(equipment.commentsCount || 0); return <tr key={equipment.id} onClick={() => handleSelectEquipment(equipment.id)} style={{cursor:'pointer'}}><td>{equipment.assignedPlant || '---'}</td><td>{equipment.identifyingNumber || '---'}</td><td><span className="item-status-dot" style={{display:'inline-block',verticalAlign:'middle',marginRight:'8px',width:'10px',height:'10px',borderRadius:'50%',backgroundColor: equipment.status === 'Active' ? 'var(--status-active)' : equipment.status === 'Spare' ? 'var(--status-spare)' : equipment.status === 'In Shop' ? 'var(--status-inshop)' : equipment.status === 'Retired' ? 'var(--status-retired)' : 'var(--accent)'}}></span>{equipment.status || '---'}</td><td>{equipment.equipmentType || '---'}</td><td>{(() => { const rating = Math.round(equipment.cleanlinessRating || 0); const stars = rating > 0 ? rating : 1; return Array.from({length:stars}).map((_,i)=><i key={i} className="fas fa-star" style={{color:'var(--accent)'}}></i>) })()}</td><td>{(() => { const rating = Math.round(equipment.conditionRating || 0); const stars = rating > 0 ? rating : 1; return Array.from({length:stars}).map((_,i)=><i key={i} className="fas fa-star" style={{color:'var(--accent)'}}></i>) })()}</td><td><div style={{display:'flex',alignItems:'center',gap:12}}><button type="button" onClick={e => { e.stopPropagation(); setModalEquipmentId(equipment.id); setModalEquipmentNumber(equipment.identifyingNumber || ''); setShowIssueModal(true) }} style={{background:'transparent',border:'none',padding:0,display:'inline-flex',alignItems:'center',cursor:'pointer'}} title="View issues"><i className="fas fa-tools" style={{color:'var(--accent)',marginRight:4}}></i><span>{issuesCount}</span></button><button type="button" onClick={e => { e.stopPropagation(); setModalEquipmentId(equipment.id); setModalEquipmentNumber(equipment.identifyingNumber || ''); setShowCommentModal(true) }} style={{background:'transparent',border:'none',padding:0,display:'inline-flex',alignItems:'center',cursor:'pointer'}} title="View comments"><i className="fas fa-comment" style={{color:'var(--accent)',marginRight:4}}></i><span>{commentsCount}</span></button></div></td></tr> })}</tbody></table></div>
    }, [isLoading, filteredEquipments, viewMode, searchText, selectedPlant, statusFilter, plants])

    const showReset = (searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses'))

    return (
        <div className={`global-dashboard-container dashboard-container global-flush-top flush-top equipments-view${selectedEquipment ? ' detail-open' : ''}`}>
            {selectedEquipment ? (
                <EquipmentDetailView equipmentId={selectedEquipment.id} onClose={() => setSelectedEquipment(null)}/>
            ) : (
                <>
                    <TopSection
                        title={title}
                        addButtonLabel="Add Equipment"
                        onAddClick={() => setShowAddSheet(true)}
                        searchInput={searchInput}
                        onSearchInputChange={v => { setSearchInput(v); debouncedSetSearchText(v) }}
                        onClearSearch={() => { setSearchInput(''); debouncedSetSearchText('') }}
                        searchPlaceholder="Search by identifying number or equipment type..."
                        viewMode={viewMode}
                        onViewModeChange={handleViewModeChange}
                        plants={plants}
                        regionPlantCodes={regionPlantCodes}
                        selectedPlant={selectedPlant}
                        onSelectedPlantChange={v => { setSelectedPlant(v); safeUpdateEquipmentFilter('selectedPlant', v) }}
                        statusFilter={statusFilter}
                        statusOptions={filterOptions}
                        onStatusFilterChange={v => { setStatusFilter(v); safeUpdateEquipmentFilter('statusFilter', v) }}
                        showReset={showReset}
                        onReset={() => { setSearchText(''); setSearchInput(''); setSelectedPlant(''); setStatusFilter(''); resetEquipmentFilters({keepViewMode: true, currentViewMode: viewMode}) }}
                        listHeaderLabels={['Plant','Identifying #','Status','Type','Cleanliness','Condition','More']}
                        showListHeader={viewMode === 'list'}
                        listHeaderClassName="equipments-list-header-row"
                        forwardedRef={headerRef}
                        sticky={true}
                    />
                    <div className="global-content-container content-container">{content}</div>
                    {showAddSheet && <EquipmentAddView plants={plants} onClose={() => setShowAddSheet(false)} onEquipmentAdded={newEquipment => setEquipments([...equipments, newEquipment])}/>}
                    {showCommentModal && <EquipmentCommentModal equipmentId={modalEquipmentId} equipmentNumber={modalEquipmentNumber} onClose={() => setShowCommentModal(false)}/>}
                    {showIssueModal && <EquipmentIssueModal equipmentId={modalEquipmentId} equipmentNumber={modalEquipmentNumber} onClose={() => setShowIssueModal(false)}/>}
                </>
            )}
        </div>
    );
}

export default EquipmentsView;
