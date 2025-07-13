import React, { useState, useRef, useEffect } from 'react';
import './MultiSelect.css';

function MultiSelect({ 
  options = [], 
  selectedValues = [], 
  onChange, 
  placeholder = 'Select options...', 
  labelKey = 'label',
  valueKey = 'value',
  displayFormat = (selected) => `${selected.length} selected`
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const containerRef = useRef(null);

  const filteredOptions = options.filter(option =>
    option[labelKey].toLowerCase().includes(searchText.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option) => {
    const value = option[valueKey];
    const isSelected = selectedValues.includes(value);

    if (isSelected) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const clearSelections = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  // Get display text for the selection
  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder;

    if (typeof displayFormat === 'function') {
      return displayFormat(selectedValues);
    }

    if (selectedValues.length === 1) {
      const selected = options.find(o => o[valueKey] === selectedValues[0]);
      return selected ? selected[labelKey] : placeholder;
    }

    return `${selectedValues.length} selected`;
  };

  return (
    <div className="multi-select-container" ref={containerRef}>
      <div 
        className={`multi-select-header ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="multi-select-selected">{getDisplayText()}</div>
        <div className="multi-select-actions">
          {selectedValues.length > 0 && (
            <button 
              className="multi-select-clear" 
              onClick={clearSelections}
              aria-label="Clear selections"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
          <span className="multi-select-arrow">
            <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`}></i>
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="multi-select-dropdown">
          <div className="multi-select-search">
            <input
              type="text"
              placeholder="Search..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="multi-select-options">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const value = option[valueKey];
                const isSelected = selectedValues.includes(value);

                return (
                  <div 
                    key={value} 
                    className={`multi-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleOption(option)}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected} 
                      onChange={() => {}}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span>{option[labelKey]}</span>
                  </div>
                );
              })
            ) : (
              <div className="multi-select-no-results">No results found</div>
            )}
          </div>

          {selectedValues.length > 0 && (
            <div className="multi-select-footer">
              <button className="multi-select-clear-all" onClick={clearSelections}>
                Clear all
              </button>
              <div className="multi-select-count">
                {selectedValues.length} selected
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MultiSelect;
