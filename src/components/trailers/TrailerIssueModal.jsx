import React, {useEffect, useState} from 'react';
import './styles/TrailerIssueModal.css';
import {supabase} from '../../services/DatabaseService';
import LoadingScreen from '../common/LoadingScreen';
import TrailerService from '../../services/TrailerService';

const LOAD_ISSUES_ERROR = 'Failed to load issues. Please try again.';
const ADD_ISSUE_ERROR = 'Failed to add issue. Please try again.';
const DELETE_ISSUE_ERROR = 'Failed to delete issue. Please try again.';
const COMPLETE_ISSUE_ERROR = 'Failed to complete issue. Please try again.';

function TrailerIssueModal({trailerId, trailerNumber, onClose}) {
    const [issues, setIssues] = useState([]);
    const [newIssue, setNewIssue] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [severity, setSeverity] = useState('Medium');

    useEffect(() => {
        fetchIssues();
    }, [trailerId]);

    const fetchIssues = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const fetchedIssues = await TrailerService.fetchIssues(trailerId);
            setIssues(Array.isArray(fetchedIssues) ? fetchedIssues : []);
        } catch (err) {
            setError(LOAD_ISSUES_ERROR);
            setIssues([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteIssue = async (issueId) => {
        try {
            await TrailerService.deleteIssue(issueId);
            fetchIssues();
        } catch (err) {
            setError(DELETE_ISSUE_ERROR);
        }
    };

    const handleCompleteIssue = async (issueId) => {
        try {
            await TrailerService.completeIssue(issueId);
            fetchIssues();
        } catch (err) {
            setError(COMPLETE_ISSUE_ERROR);
        }
    };

    const handleAddIssue = async (e) => {
        e.preventDefault();
        if (!newIssue.trim()) {
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            const {data: {user}} = await supabase.auth.getUser();
            const userId = user?.id || sessionStorage.getItem('userId');
            if (!userId) {
                throw new Error('You must be logged in to add issues');
            }
            await TrailerService.addIssue(trailerId, newIssue.trim(), severity, userId);
            setNewIssue('');
            setSeverity('Medium');
            fetchIssues();
        } catch (err) {
            setError(ADD_ISSUE_ERROR);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    const handleBackdropClick = (e) => {
        if (e.target.classList.contains('issue-modal-backdrop')) {
            onClose();
        }
    };

    return (
        <div className="issue-modal-backdrop" onClick={handleBackdropClick}>
            <div className="issue-modal">
                <div className="issue-modal-header">
                    <h2>Issues for Trailer {trailerNumber || trailerId}</h2>
                    <button className="close-button" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="issue-modal-content">
                    {error && <div className="error-message">{error}</div>}
                    <div className="add-issue-section">
                        <h3>Add New Issue</h3>
                        <form onSubmit={handleAddIssue}>
                            <textarea
                                className="issue-textarea"
                                value={newIssue}
                                onChange={(e) => setNewIssue(e.target.value)}
                                placeholder="Describe the issue here..."
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
                            >
                                {isSubmitting ? 'Adding...' : 'Add Issue'}
                            </button>
                        </form>
                    </div>
                    <div className="issues-list">
                        <h3>Issues History</h3>
                        {isLoading ? (
                            <div className="loading-container">
                                <LoadingScreen message="Loading issues..." inline={true}/>
                            </div>
                        ) : issues.length === 0 ? (
                            <div className="empty-issues">
                                <i className="fas fa-tools empty-icon"></i>
                                <p>No issues yet</p>
                                <p className="empty-subtext">Be the first to add an issue about this trailer</p>
                            </div>
                        ) : (
                            issues.map(issue => (
                                <div key={issue.id} className="issue-item">
                                    <div className="issue-header">
                                        <span className="issue-severity">Severity: {issue.severity}</span>
                                        <span className="issue-date">{formatDate(issue.time_created)}</span>
                                        <div className="issue-actions">
                                            <button
                                                className="delete-issue-button"
                                                onClick={() => handleDeleteIssue(issue.id)}
                                                title="Delete issue"
                                            >
                                                <i className="fas fa-trash"></i>
                                            </button>
                                            {!issue.time_completed && (
                                                <button
                                                    className="complete-issue-button"
                                                    onClick={() => handleCompleteIssue(issue.id)}
                                                    title="Mark as completed"
                                                >
                                                    <i className="fas fa-check"></i>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="issue-text">{issue.issue}</div>
                                    {issue.time_completed && (
                                        <div className="issue-completed">
                                            <i className="fas fa-check-circle"></i>
                                            Completed on {formatDate(issue.time_completed)}
                                        </div>
                                    )}
                                </div>
                            ))
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

export default TrailerIssueModal;