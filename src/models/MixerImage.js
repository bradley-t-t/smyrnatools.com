// MixerImage model class
export class MixerImage {
    constructor(data) {
        this.id = data.id;
        this.mixerId = data.mixer_id;
        this.partKey = data.part_key;
        this.filePath = data.file_path;
        this.uploadedBy = data.uploaded_by;
        this.uploadedAt = data.uploaded_at;
    }

    // Convert database row to MixerImage object
    static fromRow(row) {
        return new MixerImage({
            id: row.id,
            mixer_id: row.mixer_id,
            part_key: row.part_key,
            file_path: row.file_path,
            uploaded_by: row.uploaded_by,
            uploaded_at: row.uploaded_at
        });
    }

    // Convert MixerImage object to database row
    toRow() {
        return {
            mixer_id: this.mixerId,
            part_key: this.partKey,
            file_path: this.filePath,
            uploaded_by: this.uploadedBy,
            uploaded_at: this.uploadedAt
        };
    }
}
