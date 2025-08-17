import supabase from './DatabaseService'
import { Operator } from '../config/models/operators/Operator'
import UserUtility from '../utils/UserUtility'

const OPERATORS_TABLE = 'operators'

class OperatorServiceImpl {
    async getAllOperators() {
        const { data, error } = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .order('name')
        if (error) throw new Error(error.message)
        return data.map(op => new Operator(op))
    }

    async fetchActiveOperators() {
        const { data, error } = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('status', 'Active')
            .order('name')
        if (error) throw new Error(error.message)
        return data.map(op => new Operator(op))
    }

    async fetchOperatorsByPlant(plantCode) {
        if (!plantCode) throw new Error('Plant code is required')
        const { data, error } = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('plant_code', plantCode)
            .eq('position', 'Mixer Operator')
            .order('name')
        if (error) throw new Error(error.message)
        return data.map(op => new Operator(op))
    }

    async fetchTractorOperators() {
        const { data, error } = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('position', 'Tractor Operator')
            .order('name')
        if (error) throw new Error(error.message)
        return data.map(op => new Operator(op))
    }

    async getOperatorByEmployeeId(employeeId) {
        if (!employeeId || !UserUtility.isValidUUID(employeeId)) throw new Error('Invalid Employee ID')
        const { data, error } = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('employee_id', employeeId)
            .single()
        if (error || !data) return null
        data.smyrna_id = data.smyrna_id ?? ''
        return new Operator(data)
    }

    async createOperator(operator) {
        const op = operator instanceof Operator ? operator : new Operator(operator)
        if (!UserUtility.isValidUUID(op.employee_id)) op.employee_id = UserUtility.generateUUID()
        const insertObj = { ...op }
        const { data, error } = await supabase
            .from(OPERATORS_TABLE)
            .insert([insertObj])
            .select()
            .single()
        if (error) throw new Error(error.message)
        return new Operator(data)
    }

    async updateOperator(operator) {
        if (!operator.employeeId || !UserUtility.isValidUUID(operator.employeeId)) throw new Error('Invalid Employee ID')
        const { data: currentData, error: lookupError } = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('employee_id', operator.employeeId)
            .single()
        if (lookupError || !currentData) throw new Error('Operator not found')
        const op = operator instanceof Operator ? operator : new Operator(operator)
        op.created_at = operator.createdAt ?? currentData.created_at
        op.updated_at = new Date().toISOString()
        const updateObj = { ...op }
        const { error } = await supabase
            .from(OPERATORS_TABLE)
            .update(updateObj)
            .eq('employee_id', op.employeeId)
        if (error) throw new Error(error.message)
        return op
    }

    async deleteOperator(employeeId) {
        if (!employeeId || !UserUtility.isValidUUID(employeeId)) throw new Error('Invalid Employee ID')
        const { data, error } = await supabase
            .from(OPERATORS_TABLE)
            .delete()
            .eq('employee_id', employeeId)
            .select()
        if (error) throw new Error(error.message)
        if (!data || data.length === 0) throw new Error('Operator was not deleted')
        return true
    }

    async getAllTrainers() {
        const { data, error } = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('is_trainer', true)
            .order('name')
        if (error) throw new Error(error.message)
        return data.map(op => new Operator(op))
    }

    async fetchOperators() {
        const [{ data: activeData, error: activeError }, { data: otherData, error: otherError }] = await Promise.all([
            supabase.from(OPERATORS_TABLE).select('*').eq('status', 'Active').order('name'),
            supabase.from(OPERATORS_TABLE).select('*').not('status', 'eq', 'Active').order('name')
        ])
        if (activeError || otherError) throw new Error((activeError || otherError).message)
        return [...activeData, ...otherData].map(op => new Operator(op))
    }

    async fetchOperatorsWithAvailability(mixers = []) {
        const operators = await this.fetchOperators()
        return operators.map(operator => ({
            ...operator,
            isAvailable: operator.status === 'Active' && !mixers.some(mixer =>
                mixer.assignedOperator === operator.employeeId && mixer.status === 'Active'
            )
        }))
    }

    isOperatorAssigned(operatorId, mixers = []) {
        if (!operatorId || operatorId === '0') return false
        return mixers.some(mixer =>
            mixer.assignedOperator === operatorId && mixer.status === 'Active'
        )
    }

    async getOperatorById(employeeId) {
        if (!employeeId || !UserUtility.isValidUUID(employeeId)) throw new Error('Invalid Employee ID')
        const { data, error } = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('employee_id', employeeId)
            .single()
        if (error || !data) return null
        return new Operator(data)
    }
}

export const OperatorService = new OperatorServiceImpl()
