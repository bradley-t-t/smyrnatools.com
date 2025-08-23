import APIUtility from '../utils/APIUtility'
import {Operator} from '../config/models/operators/Operator'
import UserUtility from '../utils/UserUtility'

class OperatorServiceImpl {
    async getAllOperators() {
        const {res, json} = await APIUtility.post('/operator-service/list')
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch operators')
        return (json?.data ?? []).map(op => new Operator(op))
    }

    async fetchActiveOperators() {
        const {res, json} = await APIUtility.post('/operator-service/list-active')
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch active operators')
        return (json?.data ?? []).map(op => new Operator(op))
    }

    async fetchOperatorsByPlant(plantCode) {
        if (!plantCode) throw new Error('Plant code is required')
        const {res, json} = await APIUtility.post('/operator-service/list-by-plant', {plantCode})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch operators by plant')
        return (json?.data ?? []).map(op => new Operator(op))
    }

    async fetchTractorOperators() {
        const {res, json} = await APIUtility.post('/operator-service/list-tractor')
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch tractor operators')
        return (json?.data ?? []).map(op => new Operator(op))
    }

    async getOperatorByEmployeeId(employeeId) {
        if (!employeeId || !UserUtility.isValidUUID(employeeId)) throw new Error('Invalid Employee ID')
        const {res, json} = await APIUtility.post('/operator-service/get-by-employee-id', {employeeId})
        if (!res.ok) return null
        const data = json?.data || null
        if (!data) return null
        data.smyrna_id = data.smyrna_id ?? ''
        return new Operator(data)
    }

    async createOperator(operator) {
        const op = operator instanceof Operator ? operator : new Operator(operator)
        if (!UserUtility.isValidUUID(op.employeeId)) op.employeeId = UserUtility.generateUUID()
        const payload = {operator: op.toApiFormat()}
        const {res, json} = await APIUtility.post('/operator-service/create', payload)
        if (!res.ok) throw new Error(json?.error || 'Failed to create operator')
        return new Operator(json?.data)
    }

    async updateOperator(operator) {
        if (!operator.employeeId || !UserUtility.isValidUUID(operator.employeeId)) throw new Error('Invalid Employee ID')
        const op = operator instanceof Operator ? operator : new Operator(operator)
        const update = op.toApiFormat()
        delete update.created_at
        const {res, json} = await APIUtility.post('/operator-service/update', {operator: update})
        if (!res.ok) throw new Error(json?.error || 'Failed to update operator')
        return new Operator(json?.data)
    }

    async deleteOperator(employeeId) {
        if (!employeeId || !UserUtility.isValidUUID(employeeId)) throw new Error('Invalid Employee ID')
        const {res, json} = await APIUtility.post('/operator-service/delete', {employeeId})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Operator was not deleted')
        return true
    }

    async getAllTrainers() {
        const {res, json} = await APIUtility.post('/operator-service/list-trainers')
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch trainers')
        return (json?.data ?? []).map(op => new Operator(op))
    }

    async fetchOperators() {
        const {res, json} = await APIUtility.post('/operator-service/fetch-operators')
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch operators')
        return (json?.data ?? []).map(op => new Operator(op))
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
        const {res, json} = await APIUtility.post('/operator-service/get-by-employee-id', {employeeId})
        if (!res.ok) return null
        const data = json?.data || null
        if (!data) return null
        return new Operator(data)
    }
}

export const OperatorService = new OperatorServiceImpl()
