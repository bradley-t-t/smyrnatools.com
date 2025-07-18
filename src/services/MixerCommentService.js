import {supabase} from './DatabaseService';
import {MixerComment} from '../models/mixers/MixerComment';

const TABLE_NAME = 'mixers_comments';

export class MixerCommentService {
    static async fetchComments(mixerId) {
        if (!mixerId) throw new Error('Mixer ID is required');

        const {data, error} = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq('mixer_id', mixerId)
            .order('created_at', {ascending: false});

        if (error) {
            console.error(`Error fetching comments for mixer ${mixerId}:`, error);
            throw error;
        }

        return data?.map(row => MixerComment.fromRow(row)) ?? [];
    }

    static async addComment(mixerId, text, author) {
        if (!mixerId) throw new Error('Mixer ID is required');
        if (!text?.trim()) throw new Error('Comment text is required');
        if (!author?.trim()) throw new Error('Author is required');

        // Do NOT set id: null, let DB generate it
        const comment = {
            mixer_id: mixerId,
            text: text.trim(),
            author: author.trim(),
            created_at: new Date().toISOString()
        };

        const {data, error} = await supabase
            .from(TABLE_NAME)
            .insert([comment])
            .select()
            .single();

        if (error) {
            console.error(`Error adding comment to mixer ${mixerId}:`, error);
            throw error;
        }

        return data ? MixerComment.fromRow(data) : null;
    }

    static async deleteComment(commentId) {
        if (!commentId) throw new Error('Comment ID is required');

        const {error} = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq('id', commentId);

        if (error) {
            console.error(`Error deleting comment ${commentId}:`, error);
            throw error;
        }

        return true;
    }
}