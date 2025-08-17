import React, {useEffect, useRef, useState} from 'react';
import ReactDOM from 'react-dom';
import {usePreferences} from '../../../app/context/PreferencesContext';
import './styles/OperatorSelectModal.css';

function OperatorSelectModal({
                                 isOpen,
                                 onClose,
                                 onSelect,
                                 currentValue,
                                 mixers = [],
                                 assignedPlant = '',
                                 readOnly = false,
                                 operators,
                                 onRefresh
                             }) {
    const {preferences} = usePreferences();
    const isDarkMode = preferences.themeMode === 'dark';
    const accentColor = preferences.accentColor === 'red' ? '#b80017' : '#003896';
    const accentColorRGB = preferences.accentColor === 'red' ? '184, 0, 23' : '0, 56, 150';
    const [searchText, setSearchText] = useState('');
    const [isLoading] = useState(false);
    const [, setFilterPlant] = useState(assignedPlant);
    const [filterPosition, setFilterPosition] = useState('');
    const [sortAvailableFirst, setSortAvailableFirst] = useState(true);
    const modalRef = useRef(null);

    useEffect(() => {
        if (assignedPlant) setFilterPlant(assignedPlant);
    }, [assignedPlant]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = e => {
            if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    function isOperatorAssigned(operatorId) {
        if (!operatorId || operatorId === '0' || !Array.isArray(mixers)) return false;
        return mixers.some(mixer => mixer.assignedOperator === operatorId && mixer.status === 'Active');
    }

    const filteredOperators = operators
        .filter(operator => operator.employeeId === currentValue ||
            (searchText.trim() === '' ||
                operator.name.toLowerCase().includes(searchText.toLowerCase()) ||
                (operator.smyrnaId && operator.smyrnaId.toLowerCase().includes(searchText.toLowerCase())) ||
                operator.employeeId.toLowerCase().includes(searchText.toLowerCase())) &&
            (!filterPosition || operator.position === filterPosition) &&
            operator.plantCode === assignedPlant
        )
        .sort((a, b) => {
            if (sortAvailableFirst) {
                const aAssigned = isOperatorAssigned(a.employeeId) || a.status !== 'Active';
                const bAssigned = isOperatorAssigned(b.employeeId) || b.status !== 'Active';
                if (!aAssigned && bAssigned) return -1;
                if (aAssigned && !bAssigned) return 1;
            }
            return a.name.localeCompare(b.name);
        });

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className={`operator-modal-overlay ${isDarkMode ? 'dark-mode' : ''}`}
             style={{'--accent-color': accentColor, '--accent-color-rgb': accentColorRGB}}>
            <div className="operator-modal-backdrop" onClick={onClose}></div>
            <div className="operator-modal-container" ref={modalRef} style={{maxWidth: '500px'}}>
                <div className="operator-modal-header">
                    <h2>Select Operator</h2>
                    <button className="close-button" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="operator-modal-search">
                    <div className="search-input-container">
                        <i className="fas fa-search search-icon"></i>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search operators..."
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            autoFocus
                        />
                        {searchText && (
                            <button className="clear-search" onClick={() => setSearchText('')}>
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>
                    <div className="filter-buttons">
                        <button
                            className={`filter-button ${sortAvailableFirst ? 'active' : ''}`}
                            title={sortAvailableFirst ? "Showing available operators first" : "Default sorting"}
                            onClick={() => setSortAvailableFirst(!sortAvailableFirst)}
                            style={sortAvailableFirst ? {
                                fontWeight: '600',
                                backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896',
                                borderColor: preferences.accentColor === 'red' ? '#b80017' : '#003896',
                                color: '#ffffff'
                            } : {fontWeight: '500'}}
                        >
                            <i className="fas fa-sort-amount-down"></i> Available First
                        </button>
                        <button
                            className="filter-button"
                            title="Refresh operator list"
                            onClick={() => onRefresh && onRefresh()}
                            style={{marginLeft: '8px'}}
                        >
                            <i className="fas fa-sync"></i> Refresh List
                        </button>
                    </div>
                </div>
                <div className="operator-modal-content">
                    <div className="filter-status">
                        <span className="result-count" style={{fontWeight: '500'}}>
                            {filteredOperators.filter(op => readOnly || !isOperatorAssigned(op.employeeId) || op.employeeId === currentValue).length} operator{filteredOperators.filter(op => readOnly || !isOperatorAssigned(op.employeeId) || op.employeeId === currentValue).length !== 1 ? 's' : ''} found{assignedPlant ? ` for plant ${assignedPlant}` : ''}
                        </span>
                        {!readOnly && (
                            <span className="filter-tag info-tag">
                                <i className="fas fa-info-circle"></i> Already assigned operators are hidden
                            </span>
                        )}
                        {assignedPlant ? (
                            <span className="filter-tag plant-tag">
                                <i className="fas fa-building"></i> Plant: {assignedPlant}
                            </span>
                        ) : (
                            <span className="filter-tag error-tag">
                                <i className="fas fa-exclamation-triangle"></i> No plant selected
                            </span>
                        )}
                        {sortAvailableFirst && (
                            <span className="filter-tag" style={{fontWeight: '500'}}>
                                <i className="fas fa-sort-amount-down"></i> Available First
                            </span>
                        )}
                    </div>
                    {isLoading ? (
                        <div className="loading-spinner">
                            <div className="spinner"></div>
                            <p>Loading operators...</p>
                        </div>
                    ) : filteredOperators.length === 0 ? (
                        <div className="no-results">
                            <i className="fas fa-user-slash no-results-icon"></i>
                            <p>{assignedPlant ? `No operators found for plant (${assignedPlant})` : 'No plant selected. Please select a plant first.'}</p>
                            <p className="no-results-hint">Please add operators with this plant code in the Operators
                                section</p>
                            <div className="no-results-actions">
                                <button className="show-all-button" onClick={() => {
                                    setFilterPosition('');
                                    setSearchText('');
                                }}>Reset Search
                                </button>
                                <a href="/operators/add" className="add-operator-button" target="_blank"
                                   rel="noopener noreferrer" style={{marginLeft: '8px'}}><i
                                    className="fas fa-plus"></i> Add Operator</a>
                                <button className="cancel-button ml-2" onClick={onClose}
                                        style={{marginLeft: '8px'}}>Close
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="operator-list">
                            {filteredOperators.map(operator => {
                                const isAssigned = isOperatorAssigned(operator.employeeId);
                                const isInactive = operator.status !== 'Active';
                                const isUnavailable = (isAssigned && !readOnly) || isInactive;
                                const isSelected = operator.employeeId === currentValue;
                                if (isAssigned && !readOnly && operator.employeeId !== currentValue) return null;

                                return (
                                    <div
                                        key={operator.employeeId}
                                        className={`operator-item ${isUnavailable ? 'unavailable' : ''} ${isSelected ? 'selected' : ''}`}
                                        onClick={() => {
                                            if (readOnly || !isUnavailable) {
                                                onSelect(operator.employeeId);
                                                onClose();
                                            }
                                        }}
                                    >
                                        <div className="operator-main-info">
                                            <span className="operator-name">{operator.name}</span>
                                            {operator.smyrnaId &&
                                                <span className="operator-id">{operator.smyrnaId}</span>}
                                        </div>
                                        <div className="operator-details">
                                            <span className="operator-position"><i
                                                className="fas fa-hard-hat"></i> {operator.position || 'No Position'}</span>
                                            {operator.plantCode && <span className="operator-plant"><i
                                                className="fas fa-building"></i> {operator.plantCode}</span>}
                                            {isInactive && <span className="operator-status"><i
                                                className="fas fa-exclamation-triangle"></i> {operator.status}</span>}
                                            {isAssigned && operator.status === 'Active' &&
                                                <span className="operator-status"><i className="fas fa-user-slash"></i> Already Assigned</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="operator-modal-footer">
                    <button className="cancel-button" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default OperatorSelectModal;
