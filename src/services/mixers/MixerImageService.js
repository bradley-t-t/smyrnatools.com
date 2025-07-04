import supabase from '../core/Supabase';
import {MixerImage} from '../../models/MixerImage';

const BUCKET_NAME = 'smyrna';

export class MixerImageService {
    // Fetch all images for a mixer
    static async fetchMixerImages(mixerId) {
        try {
            const {data, error} = await supabase
                .from('mixer_images')
                .select('*')
                .eq('mixer_id', mixerId);

            if (error) throw error;

            return data ? data.map(row => MixerImage.fromRow(row)) : [];
        } catch (error) {
            console.error(`Error fetching images for mixer ${mixerId}:`, error);
            throw error;
        }
    }

    // Fetch the latest image for a specific part of a mixer
    static async fetchLatestImageForPart(mixerId, partKey) {
        try {
            const {data, error} = await supabase
                .from('mixer_images')
                .select('*')
                .eq('mixer_id', mixerId)
                .eq('part_key', partKey)
                .order('uploaded_at', {ascending: false})
                .limit(1);

            if (error) throw error;

            return data && data.length > 0 ? MixerImage.fromRow(data[0]) : null;
        } catch (error) {
            console.error(`Error fetching image for mixer ${mixerId} part ${partKey}:`, error);
            throw error;
        }
    }

    // Upload an image for a mixer part
    static async uploadImage(mixerId, partKey, file, userId) {
        try {
            // 1. Upload the file to storage
            const filename = `${partKey}.jpg`;
            const filePath = `mixers/${mixerId}/${filename}`;

            const {error: uploadError} = await supabase.storage
                .from(BUCKET_NAME)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // 2. Create a record in the database
            const mixerImage = new MixerImage({
                mixer_id: mixerId,
                part_key: partKey,
                file_path: filePath,
                uploaded_by: userId || 'anonymous',
                uploaded_at: new Date().toISOString()
            });

            const {error: dbError} = await supabase
                .from('mixer_images')
                .insert([mixerImage.toRow()]);

            if (dbError) throw dbError;

            return true;
        } catch (error) {
            console.error(`Error uploading image for mixer ${mixerId}:`, error);
            throw error;
        }
    }

    // Get a signed URL for an image
    static async getSignedUrl(filePath) {
        try {
            const {data, error} = await supabase.storage
                .from(BUCKET_NAME)
                .createSignedUrl(filePath, 3600);

            if (error) throw error;

            return data.signedUrl;
        } catch (error) {
            console.error(`Error getting signed URL for ${filePath}:`, error);
            throw error;
        }
    }

    // Delete an image
    static async deleteImage(filePath) {
        try {
            const {error} = await supabase.storage
                .from(BUCKET_NAME)
                .remove([filePath]);

            if (error) throw error;

            return true;
        } catch (error) {
            console.error(`Error deleting image ${filePath}:`, error);
            throw error;
        }
    }
}
