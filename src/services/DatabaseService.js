import {createClient} from '@supabase/supabase-js'
import APIUtility from '../utils/APIUtility'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

export default supabase
export {supabase}

export class DatabaseService {
    static async executeRawQuery(sql, params = []) {
        const {res, json} = await APIUtility.post('/database-service/execute-sql', {query: sql, params})
        if (!res.ok) throw new Error(json?.error || 'Failed to execute SQL')
        return json?.data ?? []
    }

    static async tableExists(tableName) {
        if (!tableName) throw new Error('Table name is required')
        const {res, json} = await APIUtility.post('/database-service/table-exists', {tableName})
        if (!res.ok) return false
        return json?.exists === true
    }

    static async getAllRecords(tableName) {
        if (!tableName) throw new Error('Table name is required')
        const {res, json} = await APIUtility.post('/database-service/get-all-records', {tableName})
        if (!res.ok) return []
        return json?.data ?? []
    }
}

export const getSupabaseErrorDetails = error => {
    if (!error) return 'Unknown error'
    if (error.message) {
        if (error.details || error.hint || error.code) {
            return `${error.message}\nDetails: ${error.details || 'none'}\nHint: ${error.hint || 'none'}\nCode: ${error.code || 'none'}`
        }
        return error.message
    }
    try {
        return JSON.stringify(error)
    } catch {
        return 'Error object could not be stringified'
    }
}

export const logSupabaseError = (context, error) => {
    console.error(`Supabase error in ${context}:`, error)
    console.error('Details:', getSupabaseErrorDetails(error))
}

export const formatDateForSupabase = date => {
    if (!date) return null
    if (date instanceof Date) return date.toISOString()
    try {
        const d = new Date(date)
        return isNaN(d.getTime()) ? null : d.toISOString()
    } catch {
        return null
    }
}

export const refreshAuth = async () => {
    try {
        const {data: refreshData, error: refreshError} = await supabase.auth.refreshSession()
        if (!refreshError && refreshData?.session?.user?.id) {
            return {userId: refreshData.session.user.id, source: 'refreshSession'}
        }
        const {data: sessionData} = await supabase.auth.getSession()
        if (sessionData?.session?.user?.id) {
            return {userId: sessionData.session.user.id, source: 'getSession'}
        }
        const {data: userData} = await supabase.auth.getUser()
        if (userData?.user?.id) {
            return {userId: userData.user.id, source: 'getUser'}
        }
        return {userId: null, source: 'none'}
    } catch (error) {
        return {userId: null, source: 'error', error}
    }
}

export const isSupabaseConfigured = supabase => {
    if (!supabase) return false
    if (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_SUPABASE_ANON_KEY) return false
    if (!supabase.supabaseUrl || supabase.supabaseUrl.includes('example.supabase.co')) return false
    if (!supabase.supabaseKey || supabase.supabaseKey === 'your-public-anon-key') return false
    return true
}

export const extractSupabaseErrorMessage = response => {
    if (!response) return 'Empty response received'
    return response.error ? getSupabaseErrorDetails(response.error) : null
}

export const createPartialTextFilter = (column, searchTerm) => {
    if (!searchTerm?.trim() || !column) return {}
    return {[column]: {ilike: `%${searchTerm.trim()}%`}}
}

export const SupabaseUtils = {
    async fetchAll(table, columns = '*') {
        if (!table) throw new Error('Table name is required')
        const {res, json} = await APIUtility.post('/database-service/fetch-all', {table, columns, orderBy: 'id'})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch all')
        return json?.data ?? []
    },

    async fetch(table, columns = '*', filterColumn, value) {
        if (!table || !filterColumn || value === undefined) throw new Error('Table, filter column, and value are required')
        const {res, json} = await APIUtility.post('/database-service/fetch', {table, columns, filterColumn, value})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch')
        return json?.data ?? []
    },

    async insert(table, item) {
        if (!table || !item) throw new Error('Table and item are required')
        const {res, json} = await APIUtility.post('/database-service/insert', {table, item})
        if (!res.ok) throw new Error(json?.error || 'Failed to insert')
        return json?.data ?? []
    },

    async update(table, filterColumn, value, data) {
        if (!table || !filterColumn || value === undefined || !data) throw new Error('Table, filter column, value, and data are required')
        const {res, json} = await APIUtility.post('/database-service/update', {table, filterColumn, value, data})
        if (!res.ok) throw new Error(json?.error || 'Failed to update')
        return true
    },

    async delete(table, filterColumn, value) {
        if (!table || !filterColumn || value === undefined) throw new Error('Table, filter column, and value are required')
        const {res, json} = await APIUtility.post('/database-service/delete', {table, filterColumn, value})
        if (!res.ok) throw new Error(json?.error || 'Failed to delete')
        return true
    }
}
