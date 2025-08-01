import supabase from './DatabaseService'
import { v4 as uuidv4 } from 'uuid'

const TRACTORS_MAINTENANCE_TABLE = 'tractors_maintenance'

export class TractorMaintenanceService {
    static async fetchIssues(tractorId) {
        const { data, error } = await supabase
            .from(TRACTORS_MAINTENANCE_TABLE)
            .select('*')
            .eq('tractor_id', tractorId)
            .order('time_created', { ascending: false })
        if (error) throw error
        return data ?? []
    }

    static async addIssue(tractorId, issueText, severity) {
        if (!tractorId) throw new Error('Tractor ID is required')
        if (!issueText?.trim()) throw new Error('Issue description is required')
        const validSeverities = ['Low', 'Medium', 'High']
        const finalSeverity = validSeverities.includes(severity) ? severity : 'Medium'
        const payload = {
            id: uuidv4(),
            tractor_id: tractorId,
            issue: issueText.trim(),
            severity: finalSeverity,
            time_completed: null
        }
        const { data, error } = await supabase
            .from(TRACTORS_MAINTENANCE_TABLE)
            .insert([payload])
            .select()
            .single()
        if (error) throw error
        if (!data) throw new Error('Database insert succeeded but no data was returned')
        return data
    }

    static async deleteIssue(issueId) {
        const { error } = await supabase
            .from(TRACTORS_MAINTENANCE_TABLE)
            .delete()
            .eq('id', issueId)
        if (error) throw error
        return true
    }

    static async completeIssue(issueId) {
        const { data, error } = await supabase
            .from(TRACTORS_MAINTENANCE_TABLE)
            .update({ time_completed: new Date().toISOString() })
            .eq('id', issueId)
            .select()
            .single()
        if (error) throw error
        return data
    }
}