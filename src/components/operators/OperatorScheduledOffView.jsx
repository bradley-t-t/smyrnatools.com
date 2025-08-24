import React, {useState} from 'react';
import {supabase} from '../../services/DatabaseService';
import './styles/OperatorScheduledOffView.css';

const SCHEDULED_OFF_TABLE = 'operators_scheduled_off';

function RequestOffModal({operator, daysOff, onClose, onSave}) {
    const [dates, setDates] = useState(daysOff || []);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleDateChange = (idx, value) => {
        const newDates = [...dates];
        newDates[idx] = value;
        setDates(newDates);
    };

    const addDateField = () => setDates([...dates, '']);
    const removeDateField = idx => setDates(dates.filter((_, i) => i !== idx));
    const handleClearDates = () => setDates([]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        setSuccess(false);

        const filteredDates = Array.from(new Set(dates.filter(d => d)));
        try {
            const {data: existing, error: selectError} = await supabase
                .from(SCHEDULED_OFF_TABLE)
                .select('uuid')
                .eq('id', operator.employeeId || operator.employee_id)
                .single();

            if (selectError && selectError.code !== 'PGRST116') {
                setError('Failed to check existing time off.');
                setSubmitting(false);
                return;
            }

            if (existing && existing.uuid) {
                const {error: updateError} = await supabase
                    .from(SCHEDULED_OFF_TABLE)
                    .update({days_off: filteredDates, updated_at: new Date().toISOString()})
                    .eq('uuid', existing.uuid);
                if (updateError) {
                    setError('Failed to save days off.');
                    setSubmitting(false);
                    return;
                }
            } else {
                const {error: insertError} = await supabase
                    .from(SCHEDULED_OFF_TABLE)
                    .insert([{id: operator.employeeId || operator.employee_id, days_off: filteredDates}]);
                if (insertError) {
                    setError('Failed to save days off.');
                    setSubmitting(false);
                    return;
                }
            }
            setSuccess(true);
            onSave(filteredDates);
        } catch (err) {
            setError('Failed to save days off.');
        }
        setSubmitting(false);
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content overview-modal scheduledoff-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header scheduledoff-header">
                    <div className="scheduledoff-header-icon">
                        <i className="fas fa-calendar-check"></i>
                    </div>
                    <div className="scheduledoff-header-title">
                        <div>Schedule Time Off</div>
                        <div className="scheduledoff-header-subtitle">{operator.name}</div>
                    </div>
                    <button className="close-button" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body scheduledoff-body">
                    <form onSubmit={handleSubmit} className="request-off-form scheduledoff-form">
                        <div className="scheduledoff-section-title">Dates Off</div>
                        <div className="dates-list scheduledoff-dates-list">
                            {dates.length === 0 && (
                                <div className="scheduledoff-empty">
                                    <i className="fas fa-moon"></i>
                                    <span>No dates selected</span>
                                </div>
                            )}
                            {dates.map((date, idx) => (
                                <div key={idx} className="scheduledoff-date-row">
                                    <div className="scheduledoff-step">
                                        <span className="scheduledoff-step-number">{idx + 1}</span>
                                    </div>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={e => handleDateChange(idx, e.target.value)}
                                        required
                                        className="scheduledoff-date-input"
                                    />
                                    <button
                                        type="button"
                                        className="scheduledoff-remove-btn"
                                        onClick={() => removeDateField(idx)}
                                        title="Remove date"
                                    >
                                        <i className="fas fa-trash"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="scheduledoff-actions-row">
                            <button
                                type="button"
                                className="scheduledoff-fab"
                                onClick={addDateField}
                                title="Add Date"
                            >
                                <i className="fas fa-plus"></i>
                            </button>
                            <button
                                type="button"
                                className="scheduledoff-clear-btn"
                                onClick={handleClearDates}
                                title="Clear All"
                                disabled={dates.length === 0}
                            >
                                <i className="fas fa-eraser"></i>
                                <span>Clear All</span>
                            </button>
                        </div>
                        <div className="scheduledoff-section-title" style={{marginTop: 32}}>Save</div>
                        <button type="submit" className="scheduledoff-submit-btn" disabled={submitting}>
                            {submitting ? (
                                <span>
                                    <i className="fas fa-spinner fa-spin"></i> Saving...
                                </span>
                            ) : (
                                <span>
                                    <i className="fas fa-save"></i> Save Time Off
                                </span>
                            )}
                        </button>
                        {error && <div className="error-message">{error}</div>}
                        {success && <div className="success-message">Saved!</div>}
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function OperatorScheduledOffButton({operator, daysOff, onSave, refreshScheduledOff}) {
    const [showModal, setShowModal] = useState(false);
    return (
        <>
            <button className="ios-button" onClick={() => setShowModal(true)}>
                <i className="fas fa-calendar-alt"></i> Time Off
            </button>
            {showModal && (
                <RequestOffModal
                    operator={operator}
                    daysOff={daysOff}
                    onClose={() => setShowModal(false)}
                    onSave={days => {
                        setShowModal(false);
                        if (onSave) onSave(days);
                        if (typeof refreshScheduledOff === 'function') refreshScheduledOff();
                    }}
                />
            )}
        </>
    );
}
