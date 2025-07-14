import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { OperatorService } from '../../services/operators/OperatorService';
import { supabase } from '../../core/clients/SupabaseClient';
import { usePreferences } from '../../context/preferences/PreferencesContext';
import './OperatorSelectModal.css';

const OperatorSelectModal = ({ isOpen, onClose, onSelect, currentValue, mixers = [], assignedPlant = '', readOnly = false }) => {
  const { preferences } = usePreferences();
  const isDarkMode = preferences.themeMode === 'dark';
  const accentColor = preferences.accentColor === 'red' ? '#b80017' : '#003896';
  const accentColorRGB = preferences.accentColor === 'red' ? '184, 0, 23' : '0, 56, 150';

  const [operators, setOperators] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [filterPlant, setFilterPlant] = useState(assignedPlant);
  const [filterPosition, setFilterPosition] = useState('');
  const [sortAvailableFirst, setSortAvailableFirst] = useState(true);
  const modalRef = useRef(null);

  useEffect(() => {
    if (assignedPlant) {
      setFilterPlant(assignedPlant);
    }
  }, [assignedPlant]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      fetchOperators();
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, assignedPlant, mixers]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const fetchOperators = async () => {
    setIsLoading(true);
    try {
      let data;
      if (assignedPlant) {
        data = await OperatorService.fetchOperatorsByPlant(assignedPlant);
        if (data.length === 0) {
          try {
            const { data: plantData, error } = await supabase
                .from('operators')
                .select('*')
                .eq('plant_code', assignedPlant);

            if (plantData && plantData.length > 0) {
              data = plantData.map(op => ({
                employeeId: op.employee_id,
                smyrnaId: op.smyrna_id || '',
                name: op.name,
                plantCode: op.plant_code,
                status: op.status,
                isTrainer: op.is_trainer,
                assignedTrainer: op.assigned_trainer,
                position: op.position || ''
              }));
            }
          } catch (innerError) {
          }
        }
      } else {
        data = [];
      }
      setOperators(data);
    } catch (error) {
      setOperators([]);
    } finally {
      setIsLoading(false);
    }
  };

  const isOperatorAssigned = (operatorId) => {
    if (!operatorId || operatorId === '0') return false;
    if (!Array.isArray(mixers) || mixers.length === 0) {
      console.log('No mixers provided to check for operator assignments');
      return false;
    }
    const isAssigned = mixers.some(mixer =>
        mixer.assignedOperator === operatorId &&
        mixer.status === 'Active'
    );
    if (isAssigned) {
      console.log(`Operator ${operatorId} is already assigned to an active mixer`);
    }
    return isAssigned;
  };

  const filteredOperators = operators
      .filter(operator => {
        // Always include currently selected operator in the list regardless of search or filters
        if (operator.employeeId === currentValue) return true;

        const matchesSearch = searchText.trim() === '' ||
            operator.name.toLowerCase().includes(searchText.toLowerCase()) ||
            (operator.smyrnaId && operator.smyrnaId.toLowerCase().includes(searchText.toLowerCase())) ||
            operator.employeeId.toLowerCase().includes(searchText.toLowerCase());

        const matchesPosition = !filterPosition || operator.position === filterPosition;
        const matchesPlant = operator.plantCode === assignedPlant;

        return matchesSearch && matchesPosition && matchesPlant;
      })
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
           style={{
             '--accent-color': accentColor,
             '--accent-color-rgb': accentColorRGB
           }}>
        <div className="operator-modal-backdrop" onClick={onClose}></div>
        <div
            className="operator-modal-container"
            ref={modalRef}
            style={{ maxWidth: '500px' }}
        >
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
                  onChange={(e) => setSearchText(e.target.value)}
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
                  style={{
                    fontWeight: sortAvailableFirst ? '600' : '500',
                    ...(sortAvailableFirst && {
                      backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896',
                      borderColor: preferences.accentColor === 'red' ? '#b80017' : '#003896',
                      color: '#ffffff'
                    })
                  }}
              >
                <i className="fas fa-sort-amount-down"></i>
                Available First
              </button>
            </div>
          </div>

          <div className="operator-modal-content">
            <div className="filter-status">
              <span className="result-count" style={{fontWeight: '500'}}>
                {filteredOperators.filter(op => readOnly || !isOperatorAssigned(op.employeeId) || op.employeeId === currentValue).length}
                {' '}operator{filteredOperators.filter(op => readOnly || !isOperatorAssigned(op.employeeId) || op.employeeId === currentValue).length !== 1 ? 's' : ''}
                {' '}found{assignedPlant ? ` for plant ${assignedPlant}` : ''}
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
                  <p>
                    {assignedPlant
                        ? `No operators found for plant (${assignedPlant})`
                        : 'No plant selected. Please select a plant first.'}
                  </p>
                  <p className="no-results-hint">
                    Please add operators with this plant code in the Operators section
                  </p>
                  <div className="no-results-actions">
                    <button
                        className="show-all-button"
                        onClick={() => {
                          setFilterPosition('');
                          setSearchText('');
                        }}
                    >
                      Reset Search
                    </button>
                    <a
                        href="/operators/add"
                        className="add-operator-button"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ marginLeft: '8px' }}
                    >
                      <i className="fas fa-plus"></i> Add Operator
                    </a>
                    <button
                        className="cancel-button ml-2"
                        onClick={() => onClose()}
                        style={{ marginLeft: '8px' }}
                    >
                      Close
                    </button>
                  </div>
                </div>
            ) : (
                <div className="operator-list">
                  <div
                      className="operator-item unassigned"
                      onClick={() => {
                        onSelect('0');
                        onClose();
                      }}
                  >
                    <div className="operator-main-info">
                      <span className="operator-name">None (Unassigned)</span>
                    </div>
                    <div className="operator-details">
                  <span className="unassigned-label">
                    <i className="fas fa-times-circle"></i> No operator will be assigned
                  </span>
                    </div>
                  </div>

                  {filteredOperators.map(operator => {
                    const isAssigned = isOperatorAssigned(operator.employeeId);
                    const isInactive = operator.status !== 'Active';
                    const isUnavailable = (isAssigned && !readOnly) || isInactive;
                    const isSelected = operator.employeeId === currentValue;

                    // Skip rendering operators that are already assigned when not in readOnly mode
                    // But always show the currently selected operator
                    if (isAssigned && !readOnly && operator.employeeId !== currentValue) {
                      // This helps with debugging
                      console.log(`Operator ${operator.name} (${operator.employeeId}) is already assigned and filtered out`);
                      return null;
                    }

                    return (
                        <div
                            key={operator.employeeId}
                            className={`operator-item ${isUnavailable ? 'unavailable' : ''} ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              // Always allow selecting in readOnly mode
                              // In regular mode, only allow unassigned operators
                              if (readOnly || !isUnavailable) {
                                onSelect(operator.employeeId);
                                onClose();
                              }
                            }}
                        >
                          <div className="operator-main-info">
                            <span className="operator-name">{operator.name}</span>
                            {operator.smyrnaId ? (
                                <span className="operator-id">{operator.smyrnaId}</span>
                            ) : null}
                          </div>
                          <div className="operator-details">
                      <span className="operator-position">
                        <i className="fas fa-hard-hat"></i> {operator.position || 'No Position'}
                      </span>
                            {operator.plantCode && (
                                <span className="operator-plant">
                          <i className="fas fa-building"></i> {operator.plantCode}
                        </span>
                            )}
                            {isInactive && (
                                <span className="operator-status">
                          <i className="fas fa-exclamation-triangle"></i> {operator.status}
                        </span>
                            )}
                            {isAssigned && operator.status === 'Active' && (
                                <span className="operator-status">
                          <i className="fas fa-user-slash"></i> Already Assigned
                        </span>
                            )}
                          </div>
                        </div>
                    );
                  })}
                </div>
            )}
          </div>

          <div className="operator-modal-footer">
            <button className="cancel-button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>,
      document.body
  );
};

export default OperatorSelectModal;