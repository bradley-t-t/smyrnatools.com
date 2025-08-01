// TractorComment.js
export class TractorComment {
    constructor(data = {}) {
        this.id = data.id ?? null;
        this.tractorId = data.tractor_id ?? '';
        this.text = data.text ?? '';
        this.author = data.author ?? '';
        this.createdAt = data.created_at ?? new Date().toISOString();
    }

    static fromRow(row) {
        if (!row) return null;
        return new TractorComment(row);
    }

    toRow() {
        return {
            id: this.id,
            tractor_id: this.tractorId,
            text: this.text,
            author: this.author,
            created_at: this.createdAt
        };
    }
}