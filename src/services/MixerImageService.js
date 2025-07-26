import supabase from './DatabaseService';
import {MixerImage} from '../config/models/mixers/MixerImage';

const BUCKET_NAME = 'smyrna';

export class MixerImageService {
    static async fetchMixerImages(mixerId) {
        const {data, error} = await supabase
            .from('mixers_images')
            .select('*')
            .eq('mixer_id', mixerId);

        if (error) {
            console.error(`Error fetching images for mixer ${mixerId}:`, error);
            throw error;
        }

        return data?.map(row => MixerImage.fromRow(row)) ?? [];
    }

    static async fetchLatestImageForPart(mixerId, partKey) {
        const {data, error} = await supabase
            .from('mixers_images')
            .select('*')
            .eq('mixer_id', mixerId)
            .eq('part_key', partKey)
            .order('uploaded_at', {ascending: false})
            .limit(1)
            .single();

        if (error) {
            console.error(`Error fetching image for mixer ${mixerId} part ${partKey}:`, error);
            throw error;
        }

        return data ? MixerImage.fromRow(data) : null;
    }

    static async uploadImage(mixerId, partKey, file, userId) {
        const filename = `${partKey}.jpg`;
        const filePath = `mixers/${mixerId}/${filename}`;

        const {error: uploadError} = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) {
            console.error(`Error uploading image for mixer ${mixerId}:`, uploadError);
            throw uploadError;
        }

        const mixerImage = new MixerImage({
            mixer_id: mixerId,
            part_key: partKey,
            file_path: filePath,
            uploaded_by: userId ?? 'anonymous',
            uploaded_at: new Date().toISOString()
        });

        const {error: dbError} = await supabase
            .from('mixers_images')
            .insert([mixerImage.toRow()]);

        if (dbError) {
            console.error(`Error uploading image for mixer ${mixerId}:`, dbError);
            throw dbError;
        }

        return true;
    }

    static async getSignedUrl(filePath) {
        const {data, error} = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(filePath, 3600);

        if (error) {
            console.error(`Error getting signed URL for ${filePath}:`, error);
            throw error;
        }

        return data.signedUrl;
    }

    static async deleteImage(filePath) {
        const {error} = await supabase.storage
            .from(BUCKET_NAME)
            .remove([filePath]);

        if (error) {
            console.error(`Error deleting image ${filePath}:`, error);
            throw error;
        }

        return true;
    }
}