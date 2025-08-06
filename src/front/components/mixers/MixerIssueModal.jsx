import React, { useEffect, useState } from 'react';
import { MixerService } from '../../../services/MixerService';
import { usePreferences } from '../../../app/context/PreferencesContext';
import ErrorBoundary from '../common/ErrorBoundary';
import ErrorMessage from '../common/ErrorMessage';
import './styles/MixerIssueModal.css';

function MixerIssueModal({ mixerId, mixerNumber, onClose }) {
    const { preferences } = usePreferences();
    const [issues, setIssues] = useState([]);
    const [newIssue, setNewIssue] = useState('');
    const [severity, setSeverity] = useState('Medium');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchIssues();
    }, [mixerId]);

    const sortedIssues = [...issues].sort((a, b) => {
        return new Date(b.time_created) - new Date(a.time_created);
    });

    const openIssues = sortedIssues.filter(issue => !issue.time_completed);
    const resolvedIssues = sortedIssues.filter(issue => issue.time_completed);

    const fetchIssues = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const fetchedIssues = await MixerService.fetchIssues(mixerId);
            setIssues(fetchedIssues);
        } catch (err) {
            setError('Failed to load maintenance issues. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteIssue = async (issueId) => {
        if (!window.confirm('Are you sure you want to delete this maintenance issue?')) {
            return;
        }

        try {
            await MixerService.deleteIssue(issueId);
            fetchIssues();
        } catch (err) {
            setError('Failed to delete issue. Please try again.');
        }
    };

    const handleCompleteIssue = async (issueId) => {
        try {
            await MixerService.completeIssue(issueId);
            fetchIssues();
        } catch (err) {
            setError('Failed to mark issue as completed. Please try again.');
        }
    };

    const handleAddIssue = async (e) => {
        e.preventDefault();

        if (!newIssue.trim()) {
            setError('Please enter an issue description');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const result = await MixerService.addIssue(mixerId, newIssue, severity);
            setNewIssue('');
            setSeverity('Medium');
            await fetchIssues();
        } catch (err) {
            let errorMessage = 'Failed to add issue. ';
            if (err.message.includes('violates foreign key constraint')) {
                errorMessage += 'The mixer ID is invalid.';
            } else if (err.message.includes('violates check constraint')) {
                errorMessage += 'The severity value is invalid (must be Low, Medium, or High).';
            } else if (err.message.includes('duplicate key')) {
                errorMessage += 'A similar issue already exists.';
            } else if (err.message.includes('not-null constraint')) {
                errorMessage += 'Missing required field: ' +
                    (err.message.includes('mixer_id') ? 'mixer ID' :
                        err.message.includes('issue') ? 'issue description' :
                            err.message.includes('severity') ? 'severity' :
                                err.message.includes('id') ? 'ID' : 'unknown field');
            } else if (err.message.includes('Could not find') && err.message.includes('column')) {
                errorMessage += 'Database schema mismatch. ' + err.message;
            } else {
                errorMessage += err.message;
            }
            try {
                localStorage.setItem('mixer_issue_error', JSON.stringify({
                    timestamp: new Date().toISOString(),
                    mixerId,
                    error: err.message,
                    errorObj: {
                        message: err.message,
                        code: err.originalError?.code,
                        details: err.originalError?.details
                    }
                }));
            } catch (e) {
            }
            setError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not completed';
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    const getSeverityClass = (severityLevel) => {
        switch (severityLevel) {
            case 'High': return 'severity-high';
            case 'Medium': return 'severity-medium';
            case 'Low': return 'severity-low';
            default: return '';
        }
    };

    const handleBackdropClick = (e) => {
        if (e.target.classList.contains('issue-modal-backdrop')) {
            onClose();
        }
    };

    return (
        <div className="issue-modal-backdrop" onClick={handleBackdropClick}>
            <div className="issue-modal">
                <div className="issue-modal-header" style={{ backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}>
                    <h2>Maintenance Issues for Mixer {mixerNumber || mixerId}</h2>
                    <button className="close-button" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="issue-modal-content">
                    <ErrorMessage
                        message={error}
                        onDismiss={() => setError(null)}
                    />

                    <div className="add-issue-section">
                        <h3>Report New Issue</h3>
                        <form onSubmit={handleAddIssue}>
                            <textarea
                                className="issue-textarea"
                                value={newIssue}
                                onChange={(e) => setNewIssue(e.target.value)}
                                placeholder="Describe the maintenance issue..."
                                disabled={isSubmitting}
                            ></textarea>

                            <div className="severity-selector">
                                <label>Severity:</label>
                                <select
                                    value={severity}
                                    onChange={(e) => setSeverity(e.target.value)}
                                    disabled={isSubmitting}
                                >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                className="add-issue-button"
                                disabled={isSubmitting || !newIssue.trim()}
                                style={{ backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                            >
                                {isSubmitting ? 'Adding...' : 'Add Issue'}
                            </button>
                        </form>
                    </div>

                    <div className="issues-list">
                        <h3>Maintenance History</h3>

                        {isLoading ? (
                            <div className="loading-container">
                                <div className="ios-spinner"></div>
                                <p>Loading issues...</p>
                            </div>
                        ) : issues.length === 0 ? (
                            <div className="empty-issues">
                                <i className="fas fa-tools empty-icon"></i>
                                <p>No maintenance issues reported</p>
                                <p className="empty-subtext">This mixer has no maintenance issues on record</p>
                            </div>
                        ) : (
                            <>
                                <div className="issues-section">
                                    <h4 className="issues-group-title">Open Issues ({openIssues.length})</h4>
                                    {openIssues.length === 0 ? (
                                        <div className="issues-section-empty">
                                            <p>No open issues at this time</p>
                                        </div>
                                    ) : (
                                        openIssues.map(issue => (
                                            <div key={issue.id} className="issue-item">
                                                <div className="issue-header">
                                                    <span className={`issue-severity ${getSeverityClass(issue.severity)}`}>
                                                        {issue.severity}
                                                    </span>
                                                    <span className="issue-date">
                                                        Reported: {formatDate(issue.time_created)}
                                                    </span>
                                                    <div className="issue-actions">
                                                        <button
                                                            className="complete-issue-button"
                                                            onClick={() => handleCompleteIssue(issue.id)}
                                                            title="Mark as resolved"
                                                        >
                                                            <i className="fas fa-check"></i>
                                                        </button>
                                                        <button
                                                            className="delete-issue-button"
                                                            onClick={() => handleDeleteIssue(issue.id)}
                                                            title="Delete issue"
                                                        >
                                                            <i className="fas fa-trash"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="issue-text">{issue.issue}</div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {openIssues.length > 0 && resolvedIssues.length > 0 && (
                                    <div className="issues-divider"></div>
                                )}

                                <div className="issues-section">
                                    <h4 className="issues-group-title">Resolved Issues ({resolvedIssues.length})</h4>
                                    {resolvedIssues.length === 0 ? (
                                        <div className="issues-section-empty">
                                            <p>No resolved issues yet</p>
                                        </div>
                                    ) : (
                                        resolvedIssues.map(issue => (
                                            <div key={issue.id} className="issue-item resolved-issue">
                                                <div className="issue-header">
                                                    <span className={`issue-severity ${getSeverityClass(issue.severity)}`}>
                                                        {issue.severity}
                                                    </span>
                                                    <span className="issue-date">
                                                        Reported: {formatDate(issue.time_created)}
                                                    </span>
                                                    <div className="issue-actions">
                                                        <button
                                                            className="delete-issue-button"
                                                            onClick={() => handleDeleteIssue(issue.id)}
                                                            title="Delete issue"
                                                        >
                                                            <i className="fas fa-trash"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="issue-text">{issue.issue}</div>
                                                <div className="issue-completed">
                                                    <i className="fas fa-check-circle"></i> Resolved: {formatDate(issue.time_completed)}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="issue-modal-footer">
                    <button className="cancel-button" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}

function MixerIssueModalWithErrorBoundary(props) {
    return (
        <ErrorBoundary>
            <MixerIssueModal {...props} />
        </ErrorBoundary>
    );
}

export default MixerIssueModalWithErrorBoundary;