import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import './styles/TractorSelectModal.css';

function TractorSelectModal({ isOpen, onClose, onSelect, currentValue, trailers, assignedPlant, readOnly, tractors, onRefresh, trailerId }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredTractors, setFilteredTractors] = useState(tractors || []);
    const [filter, setFilter] = useState('all');
    const [selectedTractorId, setSelectedTractorId] = useState(currentValue || '0');
    const modalRef = useRef(null);

    useEffect(() => {
        setFilteredTractors(tractors);
    }, [tractors]);

    useEffect(() => {
        if (!isOpen) {
            setSearchTerm('');
            setFilter('all');
            setSelectedTractorId(currentValue || '0');
        }
    }, [isOpen, currentValue]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = e => {
            if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    const handleSearch = (e) => {
        const term = e.target.value.toLowerCase();
        setSearchTerm(term);
        filterTractors(term, filter);
    };

    const handleFilter = (newFilter) => {
        setFilter(newFilter);
        filterTractors(searchTerm, newFilter);
    };

    const filterTractors = (term, filterType) => {
        let filtered = tractors;
        if (term) {
            filtered = filtered.filter(tractor =>
                (tractor.truckNumber && tractor.truckNumber.toLowerCase().includes(term)) ||
                (tractor.id && tractor.id.toLowerCase().includes(term))
            );
        }
        if (filterType === 'available') {
            filtered = filtered.filter(tractor => {
                const isAssigned = trailers.some(trailer => trailer.assignedTractor === tractor.id && trailer.id !== trailerId);
                return !isAssigned;
            });
        } else if (filterType === 'samePlant') {
            filtered = filtered.filter(tractor => tractor.assignedPlant === assignedPlant);
        }
        setFilteredTractors(filtered);
    };

    const handleSelect = (tractorId) => {
        if (readOnly) return;
        setSelectedTractorId(tractorId);
        onSelect(tractorId);
        onClose();
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        filterTractors('', filter);
    };

    const handleShowAll = async () => {
        setSearchTerm('');
        setFilter('all');
        await onRefresh();
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="tractor-modal-overlay">
            <div className="tractor-modal-backdrop"></div>
            <div className="tractor-modal-container" ref={modalRef} style={{maxWidth: '500px'}}>
                <div className="tractor-modal-header">
                    <h2>Select Tractor</h2>
                    <button className="tractor-modal-close-button" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="tractor-modal-search">
                    <div className="tractor-search-input-container">
                        <i className="fas fa-search tractor-search-icon"></i>
                        <input
                            type="text"
                            className="tractor-search-input"
                            placeholder="Search tractors..."
                            value={searchTerm}
                            onChange={handleSearch}
                            disabled={readOnly}
                        />
                        {searchTerm && (
                            <button className="tractor-clear-search" onClick={handleClearSearch}>
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>
                    <div className="tractor-filter-buttons">
                        <button
                            className={`tractor-filter-button${filter === 'all' ? ' active' : ''}`}
                            onClick={() => handleFilter('all')}
                            disabled={readOnly}
                        >
                            <i className="fas fa-list"></i> All
                        </button>
                        <button
                            className={`tractor-filter-button${filter === 'available' ? ' active' : ''}`}
                            onClick={() => handleFilter('available')}
                            disabled={readOnly}
                        >
                            <i className="fas fa-check-circle"></i> Available
                        </button>
                        <button
                            className={`tractor-filter-button${filter === 'samePlant' ? ' active' : ''}`}
                            onClick={() => handleFilter('samePlant')}
                            disabled={readOnly || !assignedPlant}
                        >
                            <i className="fas fa-building"></i> Same Plant
                        </button>
                    </div>
                </div>
                <div className="tractor-filter-status">
                    <span className="tractor-result-count">{filteredTractors.length} tractors</span>
                    {searchTerm && <span className="tractor-filter-tag">Search: {searchTerm}</span>}
                    {filter === 'available' && <span className="tractor-filter-tag">Available</span>}
                    {filter === 'samePlant' && <span className="tractor-plant-tag">Plant: {assignedPlant}</span>}
                </div>
                <div className="tractor-modal-content">
                    {filteredTractors.length === 0 ? (
                        <div className="tractor-no-results">
                            <i className="fas fa-tractor tractor-no-results-icon"></i>
                            <p>No tractors found</p>
                            <p className="tractor-no-results-hint">Try adjusting your search or filters</p>
                            <div className="tractor-no-results-actions">
                                <button className="tractor-show-all-button" onClick={handleShowAll}>Show All</button>
                                {!readOnly && (
                                    <a href="/tractors/add" className="tractor-add-tractor-button">
                                        <i className="fas fa-plus"></i> Add Tractor
                                    </a>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="tractor-list">
                            <div
                                className={`tractor-item${selectedTractorId === '0' ? ' selected' : ''}`}
                                onClick={() => handleSelect('0')}
                            >
                                <div className="tractor-main-info">
                                    <span className="tractor-number">None</span>
                                </div>
                                <div className="tractor-details">
                                    <span className="tractor-unassigned-label">Unassigned</span>
                                </div>
                            </div>
                            {filteredTractors.map(tractor => {
                                const isAssigned = trailers.some(t => t.assignedTractor === tractor.id && t.id !== trailerId);
                                return (
                                    <div
                                        key={tractor.id}
                                        className={`tractor-item${selectedTractorId === tractor.id ? ' selected' : ''}${isAssigned ? ' unavailable' : ''}`}
                                        onClick={() => !isAssigned && handleSelect(tractor.id)}
                                    >
                                        <div className="tractor-main-info">
                                            <span className="tractor-number">{tractor.truckNumber || 'Unknown'}</span>
                                        </div>
                                        <div className="tractor-details">
                                            <span className="tractor-plant">Plant: {tractor.assignedPlant}</span>
                                            {isAssigned && <span className="tractor-status">Assigned</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="tractor-modal-footer">
                    <button className="tractor-cancel-button" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default TractorSelectModal;