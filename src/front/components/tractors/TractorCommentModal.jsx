// TractorCommentModal.jsx
import React, {useEffect, useState} from 'react';
import './styles/TractorCommentModal.css';
import {TractorService} from '../../../services/TractorService';
import LoadingScreen from '../common/LoadingScreen';
import {supabase} from '../../../services/DatabaseService';
import {UserService} from '../../../services/UserService';

function TractorCommentModal({tractorId, tractorNumber, onClose}) {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userNames, setUserNames] = useState({});
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchComments();
    }, [tractorId]);

    const fetchComments = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const fetchedComments = await TractorService.fetchComments(tractorId);
            setComments(fetchedComments);
            const authorIds = [...new Set(fetchedComments.map(comment => comment.author))];
            fetchUserNames(authorIds);
        } catch (err) {
            setError('Failed to load comments. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUserNames = async (authorIds) => {
        const namesMap = {};
        for (const authorId of authorIds) {
            if (authorId) {
                try {
                    const displayName = await UserService.getUserDisplayName(authorId);
                    namesMap[authorId] = displayName;
                } catch (error) {
                    namesMap[authorId] = 'Unknown User';
                }
            }
        }
        setUserNames(namesMap);
    };

    const handleDeleteComment = async (commentId) => {
        if (!window.confirm('Are you sure you want to delete this comment?')) {
            return;
        }
        try {
            await TractorService.deleteComment(commentId);
            fetchComments();
        } catch (err) {
            setError('Failed to delete comment. Please try again.');
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) {
            return;
        }
        setIsSubmitting(true);
        try {
            const {data: {user}} = await supabase.auth.getUser();
            const userId = user?.id || sessionStorage.getItem('userId');
            if (!userId) {
                throw new Error('You must be logged in to add comments');
            }
            await TractorService.addComment(tractorId, newComment, userId);
            setNewComment('');
            fetchComments();
        } catch (err) {
            setError('Failed to add comment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    const handleBackdropClick = (e) => {
        if (e.target.classList.contains('comment-modal-backdrop')) {
            onClose();
        }
    };

    return (
        <div className="comment-modal-backdrop" onClick={handleBackdropClick}>
            <div className="comment-modal">
                <div className="comment-modal-header">
                    <h2>Comments for Tractor {tractorNumber || tractorId}</h2>
                    <button className="close-button" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="comment-modal-content">
                    {error && <div className="error-message">{error}</div>}

                    <div className="add-comment-section">
                        <h3>Add New Comment</h3>
                        <form onSubmit={handleAddComment}>
                            <textarea
                                className="comment-textarea"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Write your comment here..."
                                disabled={isSubmitting}
                            ></textarea>
                            <button
                                type="submit"
                                className="add-comment-button"
                                disabled={isSubmitting || !newComment.trim()}
                            >
                                {isSubmitting ? 'Adding...' : 'Add Comment'}
                            </button>
                        </form>
                    </div>

                    <div className="comments-list">
                        <h3>Comments History</h3>
                        {isLoading ? (
                            <div className="loading-container">
                                <LoadingScreen message="Loading comments..." inline={true}/>
                            </div>
                        ) : comments.length === 0 ? (
                            <div className="empty-comments">
                                <i className="fas fa-comments empty-icon"></i>
                                <p>No comments yet</p>
                                <p className="empty-subtext">Be the first to add a comment about this tractor</p>
                            </div>
                        ) : (
                            comments.map(comment => (
                                <div key={comment.id} className="comment-item">
                                    <div className="comment-metadata">
                                        <span
                                            className="comment-author">{userNames[comment.author] || 'Loading...'}</span>
                                        <span className="comment-date"
                                              style={{marginLeft: '8px'}}>{formatDate(comment.createdAt)}</span>
                                        <button
                                            className="delete-comment-button"
                                            onClick={() => handleDeleteComment(comment.id)}
                                            title="Delete comment"
                                        >
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </div>
                                    <div className="comment-text">{comment.text}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="comment-modal-footer">
                    <button className="cancel-button" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}

export default TractorCommentModal;