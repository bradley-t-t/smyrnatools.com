import supabase from './DatabaseService';
import { Operator } from '../models/operators/Operator';
import { generateUUID, isValidUUID, safeUUID } from '../utils/UUIDUtility';

const OPERATORS_TABLE = 'operators';

export class OperatorService {
    static async getAllOperators() {
        const { data, error } = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .order('name');

        if (error) {
            console.error('Error fetching operators:', error);
            throw new Error(`Failed to fetch operators: ${error.message} (Code: ${error.code})`);
        }

        return data.map(op => Operator.fromApiFormat(op));
    }

    static async fetchActiveOperators() {
        const { data, error } = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('status', 'Active')
            .order('name');

        if (error) {
            console.error('Error fetching active operators:', error);
            throw new Error(`Failed to fetch active operators: ${error.message} (Code: ${error.code})`);
        }

        return data.map(op => Operator.fromApiFormat(op));
    }

    static async fetchOperatorsByPlant(plantCode) {
        if (!plantCode) throw new Error('Plant code is required');

        const { data, error } = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('plant_code', plantCode)
            .eq('position', 'Mixer Operator')
            .order('name');

        if (error) {
            console.error(`Error fetching operators for plant ${plantCode}:`, error);
            throw new Error(`Failed to fetch operators for plant ${plantCode}: ${error.message} (Code: ${error.code})`);
        }

        return data.map(op => Operator.fromApiFormat(op));
    }

    static async fetchTractorOperators() {
        const { data, error } = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('position', 'Tractor Operator')
            .order('name');

        if (error) {
            console.error('Error fetching tractor operators:', error);
            throw new Error(`Failed to fetch tractor operators: ${error.message} (Code: ${error.code})`);
        }

        return data.map(op => Operator.fromApiFormat(op));
    }

    static async getOperatorByEmployeeId(employeeId) {
        if (!employeeId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId)) {
            throw new Error('Invalid Employee ID');
        }

        const { data, error } = await supabase
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

    static async createOperator(operator) {
        const operatorInstance = operator instanceof Operator ? operator : new Operator({
            employee_id: isValidUUID(operator.employee_id) ? operator.employee_id : generateUUID(),
            smyrna_id: null,
            name: operator.name?.trim(),
            plant_code: operator.plant_code,
            status: operator.status ?? 'Active',
            is_trainer: operator.is_trainer ?? false,
            assigned_trainer: safeUUID(operator.assigned_trainer),
            position: operator.position || null,
            created_at: operator.created_at ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            updated_at: operator.updated_at ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
        });

        const insertObj = operatorInstance.toApiFormat();

        if (!isValidUUID(insertObj.employee_id)) {
            throw new Error('Invalid employee_id: Must be a valid UUID');
        }

        console.log('Attempting to insert operator with the following data:', JSON.stringify(insertObj, null, 2));

        try {
            const { data, error } = await supabase
                .from(OPERATORS_TABLE)
                .insert([insertObj])
                .select()
                .single();

            if (error) {
                console.error('Error adding operator:', error);
                console.error('Supabase response:', error.details || error.message);
                throw new Error(`Failed to add operator: ${error.message} (Code: ${error.code})`);
            }

            console.log('Operator successfully inserted:', JSON.stringify(data, null, 2));
            return Operator.fromApiFormat(data);
        } catch (error) {
            console.error('Error during operator insertion:', error);
            throw error;
        }
    }

    static async updateOperator(operator) {
        if (!operator.employeeId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operator.employeeId)) {
            throw new Error('Invalid Employee ID');
        }

        const { data: currentData, error: lookupError } = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('employee_id', operator.employeeId)
            .single();

        if (lookupError || !currentData) {
            console.error(`Operator with ID ${operator.employeeId} not found:`, lookupError);
            throw new Error('Operator not found');
        }

        const operatorInstance = operator instanceof Operator ? operator : new Operator({
            employee_id: operator.employeeId,
            smyrna_id: null,
            name: operator.name?.trim(),
            plant_code: operator.plantCode,
            status: operator.status,
            is_trainer: operator.isTrainer,
            assigned_trainer: (operator.assignedTrainer && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operator.assignedTrainer)) ? operator.assignedTrainer : null,
            position: operator.position || null,
            created_at: operator.createdAt ?? currentData.created_at,
            updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
        });

        const updateObj = operatorInstance.toApiFormat();

        if (!isValidUUID(updateObj.employee_id)) {
            throw new Error('Invalid employee_id: Must be a valid UUID');
        }

        const { error } = await supabase
            .from(OPERATORS_TABLE)
            .update(updateObj)
            .eq('employee_id', operatorInstance.employeeId);

        if (error) {
            console.error(`Error updating operator with ID ${operator.employeeId}:`, error);
            throw new Error(`Failed to update operator: ${error.message} (Code: ${error.code})`);
        }

        return operatorInstance;
    }

    static async deleteOperator(employeeId) {
        if (!employeeId || !isValidUUID(employeeId)) {
            throw new Error('Invalid Employee ID: Must be a valid UUID.');
        }

        try {
            const { data, error } = await supabase
                .from(OPERATORS_TABLE)
                .delete()
                .eq('employee_id', employeeId)
                .select();

            if (error) {
                console.error(`Error deleting operator with ID ${employeeId}:`, error);
                throw new Error(`Failed to delete operator: ${error.message} (Code: ${error.code})`);
            }

            if (!data || data.length === 0) {
                console.error(`Operator with ID ${employeeId} was not found or could not be deleted.`);
                throw new Error(`Operator with ID ${employeeId} was not deleted.`);
            }

            console.log(`Operator with ID ${employeeId} successfully deleted.`);
            return true;
        } catch (error) {
            console.error('Error during operator deletion:', error);
            throw error;
        }
    }

    static async getAllTrainers() {
        const { data, error } = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('is_trainer', true)
            .order('name');

        if (error) {
            console.error('Error fetching trainers:', error);
            throw new Error(`Failed to fetch trainers: ${error.message} (Code: ${error.code})`);
        }

        return data.map(op => Operator.fromApiFormat(op));
    }

    static async fetchOperators() {
        const [{ data: activeData, error: activeError }, { data: otherData, error: otherError }] = await Promise.all([
            supabase.from(OPERATORS_TABLE).select('*').eq('status', 'Active').order('name'),
            supabase.from(OPERATORS_TABLE).select('*').not('status', 'eq', 'Active').order('name')
        ]);

        if (activeError || otherError) {
            console.error('Error fetching operators:', activeError || otherError);
            throw new Error(`Failed to fetch operators: ${(activeError || otherError).message} (Code: ${(activeError || otherError).code})`);
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
        if (!employeeId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId)) {
            throw new Error('Invalid Employee ID');
        }

        const { data, error } = await supabase
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
}