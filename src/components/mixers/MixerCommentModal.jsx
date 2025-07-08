import React, { useState, useEffect } from 'react';
import './MixerCommentModal.css';
import { MixerCommentService } from '../../services/mixers/MixerCommentService';
import { supabase } from '../../core/SupabaseClient';
import { UserService } from '../../services/auth/UserService';
import SimpleLoading from '../common/SimpleLoading';

function MixerCommentModal({ mixerId, mixerNumber, onClose }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userNames, setUserNames] = useState({});
  const [error, setError] = useState(null);

  // Load comments when component mounts
  useEffect(() => {
    fetchComments();
  }, [mixerId]);

  const fetchComments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedComments = await MixerCommentService.fetchComments(mixerId);
      setComments(fetchedComments);

      // Get unique author IDs to fetch names
      const authorIds = [...new Set(fetchedComments.map(comment => comment.author))];
      fetchUserNames(authorIds);
    } catch (err) {
      console.error('Error fetching comments:', err);
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
          console.error(`Error fetching name for user ${authorId}:`, error);
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
      await MixerCommentService.deleteComment(commentId);
      // Refresh comments after deletion
      fetchComments();
    } catch (err) {
      console.error('Error deleting comment:', err);
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
      // Get the current user's ID
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || sessionStorage.getItem('userId');

      if (!userId) {
        throw new Error('You must be logged in to add comments');
      }

      // Add the comment
      await MixerCommentService.addComment(mixerId, newComment, userId);

      // Clear the input
      setNewComment('');

      // Refresh comments
      fetchComments();
    } catch (err) {
      console.error('Error adding comment:', err);
      setError('Failed to add comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Close modal when clicking outside
  const handleBackdropClick = (e) => {
    if (e.target.classList.contains('comment-modal-backdrop')) {
      onClose();
    }
  };

  return (
    <div className="comment-modal-backdrop" onClick={handleBackdropClick}>
      <div className="comment-modal">
        <div className="comment-modal-header">
          <h2>Comments for Mixer {mixerNumber || mixerId}</h2>
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
                <div className="ios-spinner"></div>
                <p>Loading comments...</p>
              </div>
            ) : comments.length === 0 ? (
              <div className="empty-comments">
                <i className="fas fa-comments empty-icon"></i>
                <p>No comments yet</p>
                <p className="empty-subtext">Be the first to add a comment about this mixer</p>
              </div>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="comment-item">
                  <div className="comment-metadata">
                    <span className="comment-author">{userNames[comment.author] || 'Loading...'}</span>
                    <span className="comment-date">{formatDate(comment.createdAt)}</span>
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

export default MixerCommentModal;
