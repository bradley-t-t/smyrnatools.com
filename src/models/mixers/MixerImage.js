export class MixerImage {
    constructor(data = {}) {
        this.id = data.id ?? null;
        this.mixerId = data.mixer_id ?? '';
        this.partKey = data.part_key ?? '';
        this.filePath = data.file_path ?? '';
        this.uploadedBy = data.uploaded_by ?? '';
        this.uploadedAt = data.uploaded_at ?? new Date().toISOString();
    }

    static fromRow(row) {
        if (!row) return null;
        return new MixerImage(row);
    }

    toRow() {
        return {
            id: this.id,
            mixer_id: this.mixerId,
            part_key: this.partKey,
            file_path: this.filePath,
            uploaded_by: this.uploadedBy,
            uploaded_at: this.uploadedAt
        };
    }
}