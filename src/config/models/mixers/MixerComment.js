export class MixerComment {
    constructor(data = {}) {
        this.id = data.id ?? null;
        this.mixerId = data.mixer_id ?? '';
        this.text = data.text ?? '';
        this.author = data.author ?? '';
        this.createdAt = data.created_at ?? new Date().toISOString();
    }

    static fromRow(row) {
        if (!row) return null;
        return new MixerComment(row);
    }

    toRow() {
        return {
            id: this.id,
            mixer_id: this.mixerId,
            text: this.text,
            author: this.author,
            created_at: this.createdAt
        };
    }
}