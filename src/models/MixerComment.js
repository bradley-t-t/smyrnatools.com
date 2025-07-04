// MixerComment model class
export class MixerComment {
    constructor(data) {
        this.id = data.id;
        this.mixerId = data.mixer_id;
        this.text = data.text;
        this.author = data.author;
        this.createdAt = data.created_at;
    }

    // Convert database row to MixerComment object
    static fromRow(row) {
        return new MixerComment({
            id: row.id,
            mixer_id: row.mixer_id,
            text: row.text,
            author: row.author,
            created_at: row.created_at
        });
    }

    // Convert MixerComment object to database row
    toRow() {
        return {
            mixer_id: this.mixerId,
            text: this.text,
            author: this.author,
            created_at: this.createdAt
        };
    }
}
