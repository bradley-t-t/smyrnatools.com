import Trailer from '../../config/models/trailers/Trailer';
import React, {useEffect, useRef, useState, useMemo} from 'react';
import {TrailerService} from '../../services/TrailerService';
import {PlantService} from '../../services/PlantService';
import {TractorService} from '../../services/TractorService';
import {UserService} from '../../services/UserService';
import {supabase} from '../../services/DatabaseService';
import {usePreferences} from '../../app/context/PreferencesContext';
import TrailerHistoryView from './TrailerHistoryView';
import TrailerCommentModal from './TrailerCommentModal';
import TrailerIssueModal from './TrailerIssueModal';
import './styles/TrailerDetailView.css';
import LoadingScreen from '../common/LoadingScreen';
import TractorSelectModal from "./TractorSelectModal";
import {RegionService} from '../../services/RegionService';

function TrailerDetailView({trailer: initialTrailer, trailerId, onClose}) {
    const {preferences} = usePreferences();
    const [trailer, setTrailer] = useState(initialTrailer || null);
    const [tractors, setTractors] = useState([]);
    const [plants, setPlants] = useState([]);
    const [trailers, setTrailers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [showIssues, setShowIssues] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [, setUpdatedByEmail] = useState(null);
    const [message, setMessage] = useState('');
    const [showTractorModal, setShowTractorModal] = useState(false);
    const [, setUserProfile] = useState(null);
    const [canEditTrailer, setCanEditTrailer] = useState(true);
    const [plantRestrictionReason, setPlantRestrictionReason] = useState('');
    const [originalValues, setOriginalValues] = useState({});
    const [trailerNumber, setTrailerNumber] = useState('');
    const [assignedPlant, setAssignedPlant] = useState('');
    const [trailerType, setTrailerType] = useState('');
    const [assignedTractor, setAssignedTractor] = useState('');
    const [cleanlinessRating, setCleanlinessRating] = useState(0);
    const [tractorModalTractors, setTractorModalTractors] = useState([]);
    const [lastUnassignedTractorId, setLastUnassignedTractorId] = useState(null);
    const [comments, setComments] = useState([]);
    const [issues, setIssues] = useState([]);
    const [status, setStatus] = useState(trailer?.status || '');
    const trailerCardRef = useRef(null);
    const [regionPlantCodes, setRegionPlantCodes] = useState(new Set());

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                let trailerData = initialTrailer;
                if (!trailerData && trailerId) {
                    trailerData = await TrailerService.fetchTrailerById(trailerId);
                }
                const [tractorsData, plantsData, allTrailers] = await Promise.all([
                    TractorService.fetchTractors(),
                    PlantService.fetchPlants(),
                    TrailerService.fetchTrailers()
                ]);
                setTrailer(trailerData);
                setTractors(tractorsData);
                setPlants(plantsData);
                setTrailers(allTrailers);
                setTrailerNumber(trailerData?.trailerNumber || '');
                setAssignedPlant(trailerData?.assignedPlant || '');
                setTrailerType(trailerData?.trailerType || '');
                setAssignedTractor(trailerData?.assignedTractor || '');
                setCleanlinessRating(trailerData?.cleanlinessRating || 0);
                setStatus(trailerData?.status || '');
                setOriginalValues({
                    trailerNumber: trailerData?.trailerNumber || '',
                    assignedPlant: trailerData?.assignedPlant || '',
                    trailerType: trailerData?.trailerType || '',
                    assignedTractor: trailerData?.assignedTractor || '',
                    cleanlinessRating: trailerData?.cleanlinessRating || 0,
                    status: trailerData?.status || ''
                });

                document.documentElement.style.setProperty('--rating-value', trailerData?.cleanlinessRating || 0);

                if (trailerData?.updatedBy) {
                    try {
                        const userName = await UserService.getUserDisplayName(trailerData.updatedBy);
                        setUpdatedByEmail(userName);
                    } catch {
                        setUpdatedByEmail('Unknown User');
                    }
                }
            } catch (error) {
                setTrailer(null);
            } finally {
                setIsLoading(false);
                setHasUnsavedChanges(false);
            }
        }

        fetchData();
    }, [initialTrailer, trailerId]);

    useEffect(() => {
        let cancelled = false
        async function loadAllowedPlants() {
            let regionCode = preferences.selectedRegion?.code || ''
            try {
                if (!regionCode) {
                    const user = await UserService.getCurrentUser()
                    const uid = user?.id || ''
                    if (uid) {
                        const profilePlant = await UserService.getUserPlant(uid)
                        const plantCode = typeof profilePlant === 'string' ? profilePlant : (profilePlant?.plant_code || profilePlant?.plantCode || '')
                        if (plantCode) {
                            const regions = await RegionService.fetchRegionsByPlantCode(plantCode)
                            const r = Array.isArray(regions) && regions.length ? regions[0] : null
                            regionCode = r ? (r.regionCode || r.region_code || '') : ''
                        }
                    }
                }
                if (!regionCode) {
                    if (!cancelled) setRegionPlantCodes(new Set())
                    return
                }
                const regionPlants = await RegionService.fetchRegionPlants(regionCode)
                if (cancelled) return
                const codes = new Set(regionPlants.map(p => String(p.plantCode || p.plant_code || '').trim().toUpperCase()).filter(Boolean))
                setRegionPlantCodes(codes)
            } catch {
                if (!cancelled) setRegionPlantCodes(new Set())
            }
        }
        loadAllowedPlants()
        return () => {cancelled = true}
    }, [preferences.selectedRegion?.code])

    const filteredPlants = useMemo(() => {
        if (!regionPlantCodes || regionPlantCodes.size === 0) return []
        return plants.filter(p => regionPlantCodes.has(String(p.plantCode || p.plant_code || '').trim().toUpperCase()))
    }, [plants, regionPlantCodes])

    useEffect(() => {
        async function checkPlantRestriction() {
            if (isLoading || !trailer) return;
            try {
                const userId = await UserService.getCurrentUser();
                if (!userId) return;
                const hasPermission = await UserService.hasPermission(userId, 'trailers.bypass.plantrestriction');
                if (hasPermission) return setCanEditTrailer(true);
                const {data: profileData} = await supabase.from('users_profiles').select('plant_code').eq('id', userId).single();
                setUserProfile(profileData);
                if (profileData && trailer) {
                    const isSamePlant = profileData.plant_code === trailer.assignedPlant;
                    setCanEditTrailer(isSamePlant);
                    if (!isSamePlant) {
                        setPlantRestrictionReason(
                            `You cannot edit or verify this trailer because it belongs to plant ${trailer.assignedPlant} and you are assigned to plant ${profileData.plant_code}.`
                        );
                    }
                }
            } catch (error) {
            }
        }

        checkPlantRestriction();
    }, [trailer, isLoading]);

    useEffect(() => {
        if (!originalValues.trailerNumber || isLoading) return;
        const hasChanges =
            trailerNumber !== originalValues.trailerNumber ||
            assignedPlant !== originalValues.assignedPlant ||
            trailerType !== originalValues.trailerType ||
            assignedTractor !== originalValues.assignedTractor ||
            cleanlinessRating !== originalValues.cleanlinessRating ||
            status !== originalValues.status;
        setHasUnsavedChanges(hasChanges);
    }, [trailerNumber, assignedPlant, trailerType, assignedTractor, cleanlinessRating, status, originalValues, isLoading, lastUnassignedTractorId]);

    useEffect(() => {
        const handleBeforeUnload = e => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    async function handleSave(overrideValues = {}) {
        if (!trailer?.id) {
            alert('Error: Cannot save trailer with undefined ID');
            return;
        }
        setIsSaving(true);
        try {
            let userObj = await UserService.getCurrentUser();
            let userId = typeof userObj === 'object' && userObj !== null ? userObj.id : userObj;
            let assignedTractorValue = Object.prototype.hasOwnProperty.call(overrideValues, 'assignedTractor')
                ? overrideValues.assignedTractor
                : assignedTractor;
            let trailerTypeValue = Object.prototype.hasOwnProperty.call(overrideValues, 'trailerType')
                ? overrideValues.trailerType
                : trailerType;
            let statusValue = Object.prototype.hasOwnProperty.call(overrideValues, 'status')
                ? overrideValues.status
                : status;
            if (!['Cement', 'End Dump'].includes(trailerTypeValue)) {
                trailerTypeValue = 'Cement';
            }
            if ((!assignedTractorValue || assignedTractorValue === '' || assignedTractorValue === null) && statusValue === 'Active') {
                statusValue = 'Spare';
            }
            if (assignedTractorValue && statusValue !== 'Active') {
                statusValue = 'Active';
            }
            if (Object.prototype.hasOwnProperty.call(overrideValues, 'status')) {
                statusValue = overrideValues.status;
            }
            let trailerForHistory = {
                ...trailer,
                assignedTractor: Object.prototype.hasOwnProperty.call(overrideValues, 'prevAssignedTractor')
                    ? overrideValues.prevAssignedTractor
                    : trailer.assignedTractor
            };
            const updatedTrailer = new Trailer({
                id: trailer.id,
                trailer_number: overrideValues.trailerNumber ?? trailerNumber,
                assigned_plant: overrideValues.assignedPlant ?? assignedPlant,
                trailer_type: trailerTypeValue,
                assigned_tractor: assignedTractorValue || null,
                cleanliness_rating: (overrideValues.cleanlinessRating ?? cleanlinessRating) || null,
                updated_at: new Date().toISOString(),
                updated_by: userId,
                updated_last: trailer.updatedLast,
                created_at: trailer.createdAt,
                status: statusValue
            });
            await TrailerService.updateTrailer(
                updatedTrailer.id,
                updatedTrailer,
                userId,
                trailerForHistory
            );
            setTrailer(updatedTrailer);
            setTrailerNumber(updatedTrailer.trailerNumber || '');
            setAssignedPlant(updatedTrailer.assignedPlant || '');
            setTrailerType(updatedTrailer.trailerType || '');
            setAssignedTractor(updatedTrailer.assignedTractor || '');
            setCleanlinessRating(updatedTrailer.cleanlinessRating || 0);
            setStatus(updatedTrailer.status || '');
            setMessage('Changes saved successfully! Trailer needs verification.');
            setTimeout(() => setMessage(''), 5000);
            setOriginalValues({
                trailerNumber: updatedTrailer.trailerNumber,
                assignedPlant: updatedTrailer.assignedPlant,
                trailerType: updatedTrailer.trailerType,
                assignedTractor: updatedTrailer.assignedTractor,
                cleanlinessRating: updatedTrailer.cleanlinessRating,
                status: updatedTrailer.status
            });
            setHasUnsavedChanges(false);
        } catch (error) {
            alert(`Error saving changes: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDelete() {
        if (!trailer) return;
        if (!showDeleteConfirmation) return setShowDeleteConfirmation(true);
        try {
            await supabase.from('trailers').delete().eq('id', trailer.id);
            alert('Trailer deleted successfully');
            onClose();
        } catch (error) {
            alert('Error deleting trailer');
        } finally {
            setShowDeleteConfirmation(false);
        }
    }

    async function handleBackClick() {
        if (hasUnsavedChanges) {
            await handleSave();
            setHasUnsavedChanges(false);
        }
        onClose();
    }

    function getTractorName(tractorId) {
        if (!tractorId || tractorId === '0') return 'None';
        const tractor = tractors.find(t => t.id === tractorId);
        return tractor && tractor.truckNumber ? `Tractor #${tractor.truckNumber}` : 'Unknown';
    }

    function getPlantName(plantCode) {
        const plant = plants.find(p => p.plantCode === plantCode);
        return plant ? plant.plantName : plantCode;
    }

    async function fetchTractorsForModal() {
        let dbTractors = await TractorService.fetchTractors();
        if (lastUnassignedTractorId) {
            const unassignedTractor = dbTractors.find(t => t.id === lastUnassignedTractorId);
            if (unassignedTractor) {
                dbTractors = [...dbTractors, unassignedTractor];
            }
        }
        setTractorModalTractors(dbTractors);
    }

    async function refreshTractors() {
        const updatedTractors = await TractorService.fetchTractors();
        setTractors(updatedTractors);
    }

    useEffect(() => {
        async function fetchCommentsAndIssues() {
            const id = trailer?.id || trailerId;
            if (!id) return;
            const {data: commentData} = await supabase
                .from('trailers_comments')
                .select('*')
                .eq('trailer_id', id)
                .order('created_at', {ascending: false});
            setComments(Array.isArray(commentData) ? commentData.filter(c => c && (c.comment || c.text)) : []);
            const {data: issueData} = await supabase
                .from('trailers_maintenance')
                .select('*')
                .eq('trailer_id', id)
                .order('created_at', {ascending: false});
            setIssues(Array.isArray(issueData) ? issueData.filter(i => i && (i.issue || i.title || i.description)) : []);
        }

        fetchCommentsAndIssues();
    }, [trailer, trailerId]);

    function handleExportEmail() {
        if (!trailer) return;
        const hasComments = comments && comments.length > 0;
        const openIssues = (issues || []).filter(issue => !issue.time_completed);
        let summary = `Trailer Summary for Trailer #${trailer.trailerNumber || ''}

Basic Information
Trailer Number: ${trailer.trailerNumber || ''}
Assigned Plant: ${getPlantName(trailer.assignedPlant)}
Trailer Type: ${trailer.trailerType || ''}
Assigned Tractor: ${getTractorName(trailer.assignedTractor)}
Cleanliness Rating: ${trailer.cleanlinessRating || 'N/A'}

Comments
${hasComments
            ? comments.map(c =>
                `- ${c.author || 'Unknown'}: ${c.comment || c.text} (${new Date(c.created_at || c.createdAt).toLocaleString()})`
            ).join('\n')
            : 'No comments.'}

Issues (${openIssues.length})
${openIssues.length > 0
            ? openIssues.map(i =>
                `- ${i.issue || i.title || i.description || ''} (${new Date(i.time_created || i.created_at).toLocaleString()})`
            ).join('\n')
            : 'No open issues.'}
`;
        const subject = encodeURIComponent(`Trailer Summary for Trailer #${trailer.trailerNumber || ''}`);
        const body = encodeURIComponent(summary);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }

    if (isLoading) {
        return (
            <div className="trailer-detail-view">
                <div className="trailer-detail-header">
                    <button className="trailer-back-button" onClick={onClose}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h1>Trailer Details</h1>
                    <div style={{width: '36px'}}></div>
                </div>
                <div className="trailer-detail-content">
                    <LoadingScreen message="Loading trailer details..." inline={true}/>
                </div>
            </div>
        );
    }

    if (!trailer) {
        return (
            <div className="trailer-detail-view">
                <div className="trailer-detail-header">
                    <button className="trailer-back-button" onClick={onClose}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h1>Trailer Not Found</h1>
                </div>
                <div className="trailer-error-message">
                    <p>Could not find the requested trailer. It may have been deleted.</p>
                    <button className="trailer-primary-button" onClick={onClose}>Return to Trailers</button>
                </div>
            </div>
        );
    }

    const assignedPlantInRegion = assignedPlant && regionPlantCodes.has(String(assignedPlant).trim().toUpperCase())

    return (
        <div className="trailer-detail-view">
            {showComments && <TrailerCommentModal trailerId={trailer.id} trailerNumber={trailer?.trailerNumber}
                                                  onClose={() => setShowComments(false)}/>}
            {showIssues && <TrailerIssueModal trailerId={trailer.id} trailerNumber={trailer?.trailerNumber}
                                              onClose={() => setShowIssues(false)}/>}
            {isSaving && (
                <div className="trailer-saving-overlay">
                    <div className="trailer-saving-indicator"></div>
                </div>
            )}
            <div className="trailer-detail-header">
                <div className="trailer-header-left">
                    <button className="trailer-back-button" onClick={handleBackClick} aria-label="Back to trailers">
                        <i className="fas fa-arrow-left"></i>
                        <span>Back</span>
                    </button>
                </div>
                <h1>Trailer #{trailer.trailerNumber || 'Not Assigned'}</h1>
                <div className="trailer-header-actions">
                    <button className="trailer-issues-button" onClick={handleExportEmail}>
                        <i className="fas fa-envelope"></i> Email
                    </button>
                    {canEditTrailer && (
                        <>
                            <button className="trailer-issues-button" onClick={() => setShowIssues(true)}>
                                <i className="fas fa-tools"></i> Issues
                            </button>
                            <button className="trailer-comments-button" onClick={() => setShowComments(true)}>
                                <i className="fas fa-comments"></i> Comments
                            </button>
                        </>
                    )}
                    <button className="trailer-history-button" onClick={() => setShowHistory(true)}>
                        <i className="fas fa-history"></i>
                        <span>History</span>
                    </button>
                </div>
            </div>
            {!canEditTrailer && (
                <div className="trailer-plant-restriction-warning">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span>{plantRestrictionReason}</span>
                </div>
            )}
            <div className="trailer-detail-content">
                {message && (
                    <div className={`trailer-message ${message.includes('Error') ? 'error' : 'success'}`}>
                        {message}
                    </div>
                )}
                <div className="trailer-detail-card">
                    <div className="trailer-detail-card-header">
                        <h2>Trailer Information</h2>
                    </div>
                    <p className="trailer-edit-instructions">{canEditTrailer ? "You can make changes below. Remember to save your changes." : "You are in read-only mode and cannot make changes to this trailer."}</p>
                    <div className="trailer-form-sections">
                        <div className="trailer-form-section basic-info">
                            <h3>Basic Information</h3>
                            <div className="trailer-form-group">
                                <label>Trailer Number</label>
                                <input type="text" value={trailerNumber}
                                       onChange={e => setTrailerNumber(e.target.value)} className="trailer-form-control"
                                       readOnly={!canEditTrailer}/>
                            </div>
                            <div className="trailer-form-group">
                                <label>Trailer Type</label>
                                <select value={trailerType} onChange={e => setTrailerType(e.target.value)}
                                        disabled={!canEditTrailer} className="trailer-form-control">
                                    <option value="">Select Trailer Type</option>
                                    <option value="Cement">Cement</option>
                                    <option value="End Dump">End Dump</option>
                                </select>
                            </div>
                            <div className="trailer-form-group">
                                <label>Assigned Plant</label>
                                <select value={assignedPlant} onChange={e => setAssignedPlant(e.target.value)}
                                        disabled={!canEditTrailer} className="trailer-form-control">
                                    <option value="">Select Plant</option>
                                    {!assignedPlantInRegion && assignedPlant && <option value={assignedPlant}>{assignedPlant}</option>}
                                    {filteredPlants.map(p => (
                                        <option key={p.plantCode || p.plant_code} value={p.plantCode || p.plant_code}>{p.plantName || p.plant_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="trailer-form-group">
                                <label>Active Status</label>
                                <select value={status} onChange={e => setStatus(e.target.value)}
                                        disabled={!canEditTrailer} className="trailer-form-control">
                                    <option value="">Select Status</option>
                                    <option value="Active"
                                            disabled={!assignedTractor}>Active{!assignedTractor ? ' (Cannot set without a tractor assigned)' : ''}</option>
                                    <option value="Spare">Spare</option>
                                    <option value="In Shop">In Shop</option>
                                    <option value="Retired">Retired</option>
                                </select>
                            </div>
                            <div className="trailer-form-group">
                                <label>Assigned Tractor</label>
                                <div className="trailer-operator-select-container">
                                    <button
                                        className="trailer-operator-select-button trailer-form-control"
                                        onClick={async () => {
                                            if (canEditTrailer) {
                                                await fetchTractorsForModal();
                                                setShowTractorModal(true);
                                            }
                                        }}
                                        type="button"
                                        disabled={!canEditTrailer}
                                        style={!canEditTrailer ? {cursor: 'not-allowed', opacity: 0.8} : {}}
                                    >
                                        <span style={{display: 'block', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                            {assignedTractor ? getTractorName(assignedTractor) : 'None (Click to select)'}
                                        </span>
                                    </button>
                                    {canEditTrailer && (
                                        assignedTractor ? (
                                            <button
                                                className="trailer-unassign-operator-button"
                                                title="Unassign Tractor"
                                                onClick={async () => {
                                                    try {
                                                        const prevTractor = assignedTractor;
                                                        await handleSave({
                                                            assignedTractor: null,
                                                            prevAssignedTractor: prevTractor,
                                                            status: 'Spare'
                                                        });
                                                        const updatedTrailer = await TrailerService.fetchTrailerById(trailerId);
                                                        setTrailer(updatedTrailer);
                                                        setTrailerNumber(updatedTrailer.trailerNumber || '');
                                                        setAssignedPlant(updatedTrailer.assignedPlant || '');
                                                        setTrailerType(updatedTrailer.trailerType || '');
                                                        setCleanlinessRating(updatedTrailer.cleanlinessRating || 0);
                                                        setStatus(updatedTrailer.status || '');
                                                        setOriginalValues({
                                                            trailerNumber: updatedTrailer.trailerNumber,
                                                            assignedPlant: updatedTrailer.assignedPlant,
                                                            trailerType: updatedTrailer.trailerType,
                                                            assignedTractor: updatedTrailer.assignedTractor,
                                                            cleanlinessRating: updatedTrailer.cleanlinessRating,
                                                            status: updatedTrailer.status
                                                        });
                                                        setAssignedTractor(null);
                                                        setStatus('Spare');
                                                        setLastUnassignedTractorId(prevTractor);
                                                        await refreshTractors();
                                                        await fetchTractorsForModal();
                                                        setMessage('Tractor unassigned and status set to Spare');
                                                        setTimeout(() => setMessage(''), 3000);
                                                        if (showTractorModal) {
                                                            setShowTractorModal(false);
                                                            setTimeout(() => {
                                                                setShowTractorModal(true);
                                                            }, 0);
                                                        }
                                                        setHasUnsavedChanges(false);
                                                        setTimeout(() => setHasUnsavedChanges(false), 0);
                                                    } catch (error) {
                                                        setMessage('Error unassigning tractor. Please try again.');
                                                        setTimeout(() => setMessage(''), 3000);
                                                    }
                                                }}
                                                type="button"
                                            >
                                                Unassign Tractor
                                            </button>
                                        ) : (
                                            lastUnassignedTractorId && (
                                                <button
                                                    className="trailer-undo-operator-button trailer-unassign-operator-button"
                                                    title="Undo Unassign"
                                                    onClick={async () => {
                                                        try {
                                                            await handleSave({
                                                                assignedTractor: lastUnassignedTractorId,
                                                                status: 'Active'
                                                            });
                                                            setAssignedTractor(lastUnassignedTractorId);
                                                            setStatus('Active');
                                                            setLastUnassignedTractorId(null);
                                                            await refreshTractors();
                                                            await fetchTractorsForModal();
                                                            const updatedTrailer = await TrailerService.fetchTrailerById(trailerId);
                                                            setTrailer(updatedTrailer);
                                                            setTrailerNumber(updatedTrailer.trailerNumber || '');
                                                            setAssignedPlant(updatedTrailer.assignedPlant || '');
                                                            setTrailerType(updatedTrailer.trailerType || '');
                                                            setCleanlinessRating(updatedTrailer.cleanlinessRating || 0);
                                                            setStatus(updatedTrailer.status || '');
                                                            setOriginalValues({
                                                                trailerNumber: updatedTrailer.trailerNumber,
                                                                assignedPlant: updatedTrailer.assignedPlant,
                                                                trailerType: updatedTrailer.trailerType,
                                                                assignedTractor: updatedTrailer.assignedTractor,
                                                                cleanlinessRating: updatedTrailer.cleanlinessRating,
                                                                status: updatedTrailer.status
                                                            });
                                                            setHasUnsavedChanges(false);
                                                            setMessage('Tractor re-assigned and status set to Active');
                                                            setTimeout(() => setMessage(''), 3000);
                                                        } catch (error) {
                                                            setMessage('Error undoing unassign. Please try again.');
                                                            setTimeout(() => setMessage(''), 3000);
                                                        }
                                                    }}
                                                    type="button"
                                                >
                                                    Undo
                                                </button>
                                            )
                                        ))}
                                </div>
                                {showTractorModal && (
                                    <TractorSelectModal
                                        isOpen={showTractorModal}
                                        onClose={() => setShowTractorModal(false)}
                                        onSelect={async tractorId => {
                                            const newTractor = tractorId === '0' ? '' : tractorId;
                                            setShowTractorModal(false);
                                            if (newTractor !== assignedTractor) {
                                                try {
                                                    await handleSave({
                                                        assignedTractor: newTractor
                                                    });
                                                    setAssignedTractor(newTractor);
                                                    setLastUnassignedTractorId(null);
                                                    await refreshTractors();
                                                    const updatedTrailer = await TrailerService.fetchTrailerById(trailerId);
                                                    setTrailer(updatedTrailer);
                                                    setTrailerNumber(updatedTrailer.trailerNumber || '');
                                                    setAssignedPlant(updatedTrailer.assignedPlant || '');
                                                    setTrailerType(updatedTrailer.trailerType || '');
                                                    setCleanlinessRating(updatedTrailer.cleanlinessRating || 0);
                                                    setStatus(updatedTrailer.status || '');
                                                    setOriginalValues({
                                                        trailerNumber: updatedTrailer.trailerNumber,
                                                        assignedPlant: updatedTrailer.assignedPlant,
                                                        trailerType: updatedTrailer.trailerType,
                                                        assignedTractor: updatedTrailer.assignedTractor,
                                                        cleanlinessRating: updatedTrailer.cleanlinessRating,
                                                        status: updatedTrailer.status
                                                    });
                                                    setHasUnsavedChanges(false);
                                                    setMessage('Tractor assigned');
                                                    setTimeout(() => setMessage(''), 3000);
                                                } catch (error) {
                                                    setMessage('Error assigning tractor. Please try again.');
                                                    setTimeout(() => setMessage(''), 3000);
                                                }
                                            }
                                        }}
                                        currentValue={assignedTractor}
                                        trailers={trailers}
                                        assignedPlant={assignedPlant}
                                        readOnly={!canEditTrailer}
                                        tractors={tractorModalTractors}
                                        onRefresh={async () => {
                                            await fetchTractorsForModal();
                                        }}
                                        trailerId={trailerId}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="trailer-form-section maintenance-info">
                            <h3>Maintenance Information</h3>
                            <div className="trailer-form-group">
                                <label>Cleanliness Rating</label>
                                <div className="trailer-cleanliness-rating-editor">
                                    <div className="trailer-star-input">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <button
                                                key={star}
                                                type="button"
                                                className={`trailer-star-button ${star <= cleanlinessRating ? 'active' : ''} ${!canEditTrailer ? 'disabled' : ''}`}
                                                onClick={() => canEditTrailer && setCleanlinessRating(star === cleanlinessRating ? 0 : star)}
                                                aria-label={`Rate ${star} of 5 stars`}
                                                disabled={!canEditTrailer}
                                            >
                                                <i className={`fas fa-star ${star <= cleanlinessRating ? 'filled' : ''}`}
                                                   style={star <= cleanlinessRating ? {color: preferences.accentColor === 'red' ? '#b80017' : '#003896'} : {}}></i>
                                            </button>
                                        ))}
                                    </div>
                                    {cleanlinessRating > 0 && (
                                        <div className="trailer-rating-value-display">
                                            <span
                                                className="trailer-rating-label">{[null, 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][cleanlinessRating]}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="form-actions">
                    {canEditTrailer && (
                        <>
                            <button
                                className="primary-button save-button"
                                onClick={async () => {
                                    await handleSave();
                                    setHasUnsavedChanges(false);
                                }}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button className="danger-button" onClick={() => setShowDeleteConfirmation(true)}
                                    disabled={isSaving}>Delete Trailer
                            </button>
                        </>
                    )}
                </div>
            </div>
            {showHistory && <TrailerHistoryView trailer={trailer} onClose={() => setShowHistory(false)}/>}
            {showDeleteConfirmation && (
                <div className="confirmation-modal">
                    <div className="confirmation-content">
                        <h2>Confirm Delete</h2>
                        <p>Are you sure you want to delete Trailer #{trailer.trailerNumber}? This action cannot be
                            undone.</p>
                        <div className="confirmation-actions">
                            <button className="cancel-button"
                                    onClick={() => setShowDeleteConfirmation(false)}>Cancel
                            </button>
                            <button className="danger-button" onClick={handleDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TrailerDetailView;
