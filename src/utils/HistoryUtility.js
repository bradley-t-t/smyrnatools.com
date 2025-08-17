import {DateUtility} from './DateUtility'

const HistoryUtility = {
    buildChanges(entityId, fields, currentObj, newObj, userId, timestamps = true) {
        if (!entityId || !fields || !currentObj || !newObj) return [];
        const now = new Date().toISOString();
        return fields.reduce((acc, f) => {
            const oldVal = currentObj[f.field];
            const newVal = newObj[f.field];
            let o = oldVal, n = newVal;
            if (f.type === 'date') {
                o = o ? new Date(o).toISOString().split('T')[0] : null;
                n = n ? new Date(n).toISOString().split('T')[0] : null
            } else if (f.type === 'number') {
                o = o != null ? Number(o) : null;
                n = n != null ? Number(n) : null
            } else {
                if (o != null) o = o.toString().trim();
                if (n != null) n = n.toString().trim()
            }
            if (o !== n) {
                acc.push({
                    [f.entityIdColumn || 'equipment_id']: entityId,
                    field_name: f.dbField,
                    old_value: o != null ? o.toString() : null,
                    new_value: n != null ? n.toString() : null,
                    changed_at: timestamps ? now : DateUtility.toISO(now),
                    changed_by: userId || '00000000-0000-0000-0000-000000000000'
                });
            }
            return acc
        }, [])
    }
}

export default HistoryUtility
export {HistoryUtility}
