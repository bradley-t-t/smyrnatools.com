import {supabase} from '../../core/clients/SupabaseClient';
import {MixerComment} from '../../models/mixers/MixerComment';

export class MixerCommentService {
    // Fetch all comments for a mixer
    static async fetchComments(mixerId) {
        try {
            const {data, error} = await supabase
                .from('mixers_comments')
                .select('*')
                .eq('mixer_id', mixerId)
                .order('created_at', {ascending: false});

            if (error) throw error;

            return data ? data.map(row => MixerComment.fromRow(row)) : [];
        } catch (error) {
            console.error(`Error fetching comments for mixer ${mixerId}:`, error);
            throw error;
        }
    }

    // Add a comment to a mixer
    static async addComment(mixerId, text, author) {
        try {
            const comment = new MixerComment({
                mixer_id: mixerId,
                text: text,
                author: author,
                created_at: new Date().toISOString()
            });

            const {data, error} = await supabase
                .from('mixers_comments')
                .insert([comment.toRow()])
                .select();

            if (error) throw error;

            return data && data.length > 0 ? MixerComment.fromRow(data[0]) : null;
        } catch (error) {
            console.error(`Error adding comment to mixer ${mixerId}:`, error);
            throw error;
        }
    }

    // Delete a comment
    static async deleteComment(commentId) {
        try {
            const {error} = await supabase
                .from('mixers_comments')
                .delete()
                .eq('id', commentId);

            if (error) throw error;

            return true;
        } catch (error) {
            console.error(`Error deleting comment ${commentId}:`, error);
            throw error;
        }
    }
}
