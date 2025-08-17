import supabase from './DatabaseService'
import { ErrorUtility } from '../utils/ErrorUtility'
import { DateUtility } from '../utils/DateUtility'
import { CacheUtility } from '../utils/CacheUtility'
import { ValidationUtility } from '../utils/ValidationUtility'

export class BaseService {
    constructor(tableName, ModelClass = null, options = {}) {
        if (!tableName) throw new Error('tableName required')
        this.tableName = tableName
        this.ModelClass = ModelClass
        this.cacheTtl = options.cacheTtl ?? 30000
        this.cacheKeyAll = `${tableName}:all`
    }
    map(row) { return this.ModelClass ? new this.ModelClass(row) : row }
    _handleError(op, error, context = {}) { ErrorUtility.logError(`${this.tableName}.${op}`, error, context); throw error }
    _cacheGet(key) { return CacheUtility.get(key) }
    _cacheSet(key, value) { CacheUtility.set(key, value, this.cacheTtl); return value }
    async list({ filters = {}, select = '*', order = { column: 'id', ascending: true }, useCache = true } = {}) {
        try {
            if (useCache) {
                const cached = this._cacheGet(this.cacheKeyAll)
                if (cached) return cached
            }
            let query = supabase.from(this.tableName).select(select)
            Object.entries(filters).forEach(([col, val]) => { if (val !== undefined && val !== null) query = Array.isArray(val) ? query.in(col, val) : query.eq(col, val) })
            if (order?.column) query = query.order(order.column, { ascending: order.ascending !== false })
            const { data, error } = await query
            if (error) throw error
            const mapped = (data ?? []).map(r => this.map(r))
            if (useCache) this._cacheSet(this.cacheKeyAll, mapped)
            return mapped
        } catch (e) { this._handleError('list', e); }
    }
    async getById(id, { select = '*', useCache = true } = {}) {
        try {
            ValidationUtility.requireId(id)
            const cacheKey = `${this.tableName}:id:${id}`
            if (useCache) {
                const cached = this._cacheGet(cacheKey)
                if (cached) return cached
            }
            const { data, error } = await supabase.from(this.tableName).select(select).eq('id', id).single()
            if (error) throw error
            const mapped = data ? this.map(data) : null
            if (useCache && mapped) this._cacheSet(cacheKey, mapped)
            return mapped
        } catch (e) { this._handleError('getById', e, { id }); }
    }
    async create(payload, { returning = true } = {}) {
        try {
            const nowDb = DateUtility.nowDb()
            if (payload && typeof payload === 'object') {
                if (!payload.created_at) payload.created_at = nowDb
                payload.updated_at = nowDb
            }
            let query = supabase.from(this.tableName).insert(payload)
            if (returning) query = query.select().single()
            const { data, error } = await query
            if (error) throw error
            CacheUtility.delete(this.cacheKeyAll)
            return returning ? this.map(data) : true
        } catch (e) { this._handleError('create', e, { payload }); }
    }
    async update(id, payload, { returning = true } = {}) {
        try {
            ValidationUtility.requireId(id)
            if (payload && typeof payload === 'object') payload.updated_at = DateUtility.nowDb()
            let query = supabase.from(this.tableName).update(payload).eq('id', id)
            if (returning) query = query.select().single()
            const { data, error } = await query
            if (error) throw error
            CacheUtility.delete(this.cacheKeyAll)
            CacheUtility.delete(`${this.tableName}:id:${id}`)
            return returning ? this.map(data) : true
        } catch (e) { this._handleError('update', e, { id, payload }); }
    }
    async delete(id) {
        try {
            ValidationUtility.requireId(id)
            const { error } = await supabase.from(this.tableName).delete().eq('id', id)
            if (error) throw error
            CacheUtility.delete(this.cacheKeyAll)
            CacheUtility.delete(`${this.tableName}:id:${id}`)
            return true
        } catch (e) { this._handleError('delete', e, { id }); }
    }
}

export default BaseService

