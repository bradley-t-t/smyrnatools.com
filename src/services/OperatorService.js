import supabase from './DatabaseService';
import {Operator, OperatorHistory} from '../models/operators/Operator';

const OPERATORS_TABLE = 'operators';
const HISTORY_TABLE = 'operator_history';

export class OperatorService {
    static async getAllOperators() {
        const {data, error} = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .order('name');

        if (error) {
            console.error('Error fetching operators:', error);
            throw error;
        }

        return data.map(op => Operator.fromApiFormat(op));
    }

    static async fetchActiveOperators() {
        const {data, error} = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('status', 'Active')
            .order('name');

        if (error) {
            console.error('Error fetching active operators:', error);
            throw error;
        }

        return data.map(op => Operator.fromApiFormat(op));
    }

    static async fetchOperatorsByPlant(plantCode) {
        if (!plantCode) throw new Error('Plant code is required');

        const {data, error} = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('plant_code', plantCode)
            .eq('position', 'Mixer Operator')
            .order('name');

        if (error) {
            console.error(`Error fetching operators for plant ${plantCode}:`, error);
            throw error;
        }

        return data.map(op => Operator.fromApiFormat(op));
    }

    static async fetchTractorOperators() {
        const {data, error} = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('position', 'Tractor Operator')
            .order('name');

        if (error) {
            console.error('Error fetching tractor operators:', error);
            throw error;
        }

        return data.map(op => Operator.fromApiFormat(op));
    }

    static async getOperatorByEmployeeId(employeeId) {
        if (!employeeId) throw new Error('Employee ID is required');

        const {data, error} = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('employee_id', employeeId)
            .single();

        if (error || !data) {
            console.error(`Error fetching operator with ID ${employeeId}:`, error);
            return null;
        }

        data.smyrna_id = data.smyrna_id ?? '';
        return Operator.fromApiFormat(data);
    }

    static async addOperator(operator) {
        const operatorInstance = operator instanceof Operator ? operator : new Operator({
            employee_id: operator.employeeId,
            smyrna_id: operator.smyrnaId ?? '',
            name: operator.name,
            plant_code: operator.plantCode,
            status: operator.status ?? 'Active',
            is_trainer: operator.isTrainer ?? false,
            assigned_trainer: operator.assignedTrainer ?? null,
            position: operator.position,
            created_at: operator.createdAt ?? new Date().toISOString(),
            updated_at: operator.updatedAt ?? new Date().toISOString()
        });

        const {data, error} = await supabase
            .from(OPERATORS_TABLE)
            .insert([operatorInstance.toApiFormat()])
            .select()
            .single();

        if (error) {
            console.error('Error adding operator:', error);
            throw error;
        }

        return Operator.fromApiFormat(data);
    }

    static async updateOperator(operator, userId) {
        if (!operator.employeeId) throw new Error('Employee ID is required');
        if (!userId) throw new Error('User ID is required');

        const {data: currentData, error: lookupError} = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('employee_id', operator.employeeId)
            .single();

        if (lookupError || !currentData) {
            console.error(`Operator with ID ${operator.employeeId} not found:`, lookupError);
            throw new Error('Operator not found');
        }

        const currentOperator = Operator.fromApiFormat(currentData);
        const operatorInstance = operator instanceof Operator ? operator : new Operator({
            employee_id: operator.employeeId,
            smyrna_id: operator.smyrnaId ?? currentData.smyrna_id,
            name: operator.name,
            plant_code: operator.plantCode,
            status: operator.status,
            is_trainer: operator.isTrainer,
            assigned_trainer: operator.assignedTrainer,
            position: operator.position,
            created_at: operator.createdAt ?? currentData.created_at,
            updated_at: new Date().toISOString()
        });

        const {error} = await supabase
            .from(OPERATORS_TABLE)
            .update(operatorInstance.toApiFormat())
            .eq('employee_id', operatorInstance.employeeId);

        if (error) {
            console.error(`Error updating operator with ID ${operator.employeeId}:`, error);
            throw error;
        }

        const historyEntries = this._createHistoryEntries(currentOperator, operatorInstance, userId);
        if (historyEntries.length) {
            const {error: historyError} = await supabase
                .from(HISTORY_TABLE)
                .insert(historyEntries);

            if (historyError) console.error('Error saving operator history:', historyError);
        }

        return operatorInstance;
    }

    static async deleteOperator(employeeId) {
        if (!employeeId) throw new Error('Employee ID is required');

        const {error} = await supabase
            .from(OPERATORS_TABLE)
            .delete()
            .eq('employee_id', employeeId);

        if (error) {
            console.error(`Error deleting operator with ID ${employeeId}:`, error);
            throw error;
        }

        return true;
    }

    static async getOperatorHistory(employeeId) {
        if (!employeeId) throw new Error('Employee ID is required');

        const {data, error} = await supabase
            .from(HISTORY_TABLE)
            .select('*')
            .eq('employee_id', employeeId)
            .order('changed_at', {ascending: false});

        if (error) {
            console.error(`Error fetching history for operator ${employeeId}:`, error);
            throw error;
        }

        return data.map(history => OperatorHistory.fromApiFormat(history));
    }

    static async getAllTrainers() {
        const {data, error} = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('is_trainer', true)
            .order('name');

        if (error) {
            console.error('Error fetching trainers:', error);
            throw error;
        }

        return data.map(op => Operator.fromApiFormat(op));
    }

    static async fetchOperators() {
        const [{data: activeData, error: activeError}, {data: otherData, error: otherError}] = await Promise.all([
            supabase.from(OPERATORS_TABLE).select('*').eq('status', 'Active').order('name'),
            supabase.from(OPERATORS_TABLE).select('*').not('status', 'eq', 'Active').order('name')
        ]);

        if (activeError || otherError) {
            console.error('Error fetching operators:', activeError || otherError);
            throw activeError || otherError;
        }

        return [...activeData, ...otherData].map(op => Operator.fromApiFormat(op));
    }

    static async fetchOperatorsWithAvailability(mixers = []) {
        const operators = await this.fetchOperators();
        return operators.map(operator => ({
            ...operator,
            isAvailable: operator.status === 'Active' && !mixers.some(mixer =>
                mixer.assignedOperator === operator.employeeId && mixer.status === 'Active'
            )
        }));
    }

    static isOperatorAssigned(operatorId, mixers = []) {
        if (!operatorId || operatorId === '0') return false;
        return mixers.some(mixer =>
            mixer.assignedOperator === operatorId && mixer.status === 'Active'
        );
    }

    static async getOperatorById(employeeId) {
        if (!employeeId) throw new Error('Employee ID is required');

        const {data, error} = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('employee_id', employeeId)
            .single();

        if (error || !data) {
            console.error(`Error fetching operator ${employeeId}:`, error);
            return null;
        }

        return Operator.fromApiFormat(data);
    }

    static _createHistoryEntries(currentOperator, newOperator, userId) {
        const fieldsToTrack = [
            {field: 'smyrnaId', dbField: 'smyrna_id'},
            {field: 'name', dbField: 'name'},
            {field: 'plantCode', dbField: 'plant_code'},
            {field: 'status', dbField: 'status'},
            {field: 'isTrainer', dbField: 'is_trainer'},
            {field: 'assignedTrainer', dbField: 'assigned_trainer'},
            {field: 'position', dbField: 'position'}
        ];

        return fieldsToTrack.reduce((entries, {field, dbField}) => {
            if (currentOperator[field] !== newOperator[field]) {
                entries.push(new OperatorHistory({
                    employee_id: newOperator.employeeId,
                    field_name: dbField,
                    old_value: currentOperator[field]?.toString() ?? null,
                    new_value: newOperator[field]?.toString() ?? null,
                    changed_at: new Date().toISOString(),
                    changed_by: userId
                }).toApiFormat());
            }
            return entries;
        }, []);
    }
}