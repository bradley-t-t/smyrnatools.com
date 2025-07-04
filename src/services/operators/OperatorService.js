import supabase from '../../core/SupabaseClient';
import {Operator, OperatorHistory} from '../../models/Operator';

export class OperatorService {
    /**
     * Fetch all operators from the database
     */
    static async getAllOperators() {
        try {
            const {data, error} = await supabase
                .from('operators')
                .select('*');

            if (error) throw error;

            return data.map(op => Operator.fromApiFormat(op));
        } catch (error) {
            console.error('Error fetching operators:', error);
            return [];
        }
    }

    /**
     * Fetch active operators
     */
    static async fetchActiveOperators() {
        try {
            const {data, error} = await supabase
                .from('operators')
                .select('*')
                .eq('status', 'Active');

            if (error) throw error;

            return data ? data.map(op => Operator.fromApiFormat(op)) : [];
        } catch (error) {
            console.error('Error fetching active operators:', error);
            throw error;
        }
    }

    /**
     * Fetch operators by plant
     */
    static async fetchOperatorsByPlant(plantCode) {
        try {
            const {data, error} = await supabase
                .from('operators')
                .select('*')
                .eq('plant_code', plantCode);

            if (error) throw error;

            return data ? data.map(op => Operator.fromApiFormat(op)) : [];
        } catch (error) {
            console.error(`Error fetching operators for plant ${plantCode}:`, error);
            throw error;
        }
    }

    /**
     * Fetch operators by employee ID
     */
    static async getOperatorByEmployeeId(employeeId) {
        try {
            const {data, error} = await supabase
                .from('operators')
                .select('*')
                .eq('employee_id', employeeId)
                .single();

            if (error) throw error;

            return Operator.fromApiFormat(data);
        } catch (error) {
            console.error(`Error fetching operator with ID ${employeeId}:`, error);
            return null;
        }
    }

    /**
     * Add a new operators
     */
    static async addOperator(operator) {
        try {
            const apiData = operator.toApiFormat();

            const {data, error} = await supabase
                .from('operators')
                .insert([apiData])
                .select();

            if (error) throw error;

            return data[0] ? Operator.fromApiFormat(data[0]) : null;
        } catch (error) {
            console.error('Error adding operators:', error);
            throw error;
        }
    }

    /**
     * Update an existing operators
     */
    static async updateOperator(operator, userId) {
        try {
            // Get current operators data for history tracking
            const currentOperator = await this.getOperatorByEmployeeId(operator.employeeId);
            if (!currentOperator) {
                throw new Error(`Operator with ID ${operator.employeeId} not found`);
            }

            // Update operators
            const apiData = operator.toApiFormat();
            const {error} = await supabase
                .from('operators')
                .update(apiData)
                .eq('employee_id', operator.employeeId);

            if (error) throw error;

            // Track history for changed fields
            const historyEntries = [];

            // Compare fields and create history entries
            const fieldsToTrack = [
                {field: 'name', dbField: 'name'},
                {field: 'plantCode', dbField: 'plant_code'},
                {field: 'status', dbField: 'status'},
                {field: 'isTrainer', dbField: 'is_trainer'},
                {field: 'assignedTrainer', dbField: 'assigned_trainer'},
                {field: 'position', dbField: 'position'}
            ];

            for (const {field, dbField} of fieldsToTrack) {
                if (currentOperator[field] !== operator[field]) {
                    const historyEntry = new OperatorHistory({
                        employee_id: operator.employeeId,
                        field_name: dbField,
                        old_value: currentOperator[field]?.toString() || '',
                        new_value: operator[field]?.toString() || '',
                        changed_at: new Date().toISOString(),
                        changed_by: userId
                    });

                    historyEntries.push(historyEntry.toApiFormat());
                }
            }

            // Save history entries if there are changes
            if (historyEntries.length > 0) {
                const {error: historyError} = await supabase
                    .from('operator_history')
                    .insert(historyEntries);

                if (historyError) {
                    console.error('Error saving operators history:', historyError);
                }
            }

            return operator;
        } catch (error) {
            console.error(`Error updating operator with ID ${operator.employeeId}:`, error);
            throw error;
        }
    }

    /**
     * Delete an operators
     */
    static async deleteOperator(employeeId) {
        try {
            const {error} = await supabase
                .from('operators')
                .delete()
                .eq('employee_id', employeeId);

            if (error) throw error;

            return true;
        } catch (error) {
            console.error(`Error deleting operator with ID ${employeeId}:`, error);
            throw error;
        }
    }

    /**
     * Get operators history
     */
    static async getOperatorHistory(employeeId) {
        try {
            const {data, error} = await supabase
                .from('operator_history')
                .select('*')
                .eq('employee_id', employeeId)
                .order('changed_at', {ascending: false});

            if (error) throw error;

            return data.map(history => OperatorHistory.fromApiFormat(history));
        } catch (error) {
            console.error(`Error fetching history for operator with ID ${employeeId}:`, error);
            return [];
        }
    }

    /**
     * Get all trainers
     */
    static async getAllTrainers() {
        try {
            const {data, error} = await supabase
                .from('operators')
                .select('*')
                .eq('is_trainer', true);

            if (error) throw error;

            return data.map(op => Operator.fromApiFormat(op));
        } catch (error) {
            console.error('Error fetching trainers:', error);
            return [];
        }
    }

    /**
     * Fetch all operators from the database
     */
    static async getAllOperators() {
        try {
            const {data, error} = await supabase
                .from('operators')
                .select('*');

            if (error) throw error;

            return data.map(op => Operator.fromApiFormat(op));
        } catch (error) {
            console.error('Error fetching operators:', error);
            return [];
        }
    }

    /**
     * Fetch operators by employee ID
     */
    static async getOperatorByEmployeeId(employeeId) {
        try {
            const {data, error} = await supabase
                .from('operators')
                .select('*')
                .eq('employee_id', employeeId)
                .single();

            if (error) throw error;

            return Operator.fromApiFormat(data);
        } catch (error) {
            console.error(`Error fetching operator with ID ${employeeId}:`, error);
            return null;
        }
    }

    /**
     * Add a new operators
     */
    static async addOperator(operator) {
        try {
            const apiData = operator.toApiFormat();

            const {data, error} = await supabase
                .from('operators')
                .insert([apiData])
                .select();

            if (error) throw error;

            return data[0] ? Operator.fromApiFormat(data[0]) : null;
        } catch (error) {
            console.error('Error adding operators:', error);
            throw error;
        }
    }

    /**
     * Update an existing operators
     */
    static async updateOperator(operator, userId) {
        try {
            // Get current operators data for history tracking
            const currentOperator = await this.getOperatorByEmployeeId(operator.employeeId);
            if (!currentOperator) {
                throw new Error(`Operator with ID ${operator.employeeId} not found`);
            }

            // Update operators
            const apiData = operator.toApiFormat();
            const {error} = await supabase
                .from('operators')
                .update(apiData)
                .eq('employee_id', operator.employeeId);

            if (error) throw error;

            // Track history for changed fields
            const historyEntries = [];

            // Compare fields and create history entries
            const fieldsToTrack = [
                {field: 'name', dbField: 'name'},
                {field: 'plantCode', dbField: 'plant_code'},
                {field: 'status', dbField: 'status'},
                {field: 'isTrainer', dbField: 'is_trainer'},
                {field: 'assignedTrainer', dbField: 'assigned_trainer'},
                {field: 'position', dbField: 'position'}
            ];

            for (const {field, dbField} of fieldsToTrack) {
                if (currentOperator[field] !== operator[field]) {
                    const historyEntry = new OperatorHistory({
                        employee_id: operator.employeeId,
                        field_name: dbField,
                        old_value: currentOperator[field]?.toString() || '',
                        new_value: operator[field]?.toString() || '',
                        changed_at: new Date().toISOString(),
                        changed_by: userId
                    });

                    historyEntries.push(historyEntry.toApiFormat());
                }
            }

            // Save history entries if there are changes
            if (historyEntries.length > 0) {
                const {error: historyError} = await supabase
                    .from('operator_history')
                    .insert(historyEntries);

                if (historyError) {
                    console.error('Error saving operators history:', historyError);
                }
            }

            return operator;
        } catch (error) {
            console.error(`Error updating operator with ID ${operator.employeeId}:`, error);
            throw error;
        }
    }

    /**
     * Delete an operators
     */
    static async deleteOperator(employeeId) {
        try {
            const {error} = await supabase
                .from('operators')
                .delete()
                .eq('employee_id', employeeId);

            if (error) throw error;

            return true;
        } catch (error) {
            console.error(`Error deleting operator with ID ${employeeId}:`, error);
            throw error;
        }
    }

    /**
     * Get operators history
     */
    static async getOperatorHistory(employeeId) {
        try {
            const {data, error} = await supabase
                .from('operator_history')
                .select('*')
                .eq('employee_id', employeeId)
                .order('changed_at', {ascending: false});

            if (error) throw error;

            return data.map(history => OperatorHistory.fromApiFormat(history));
        } catch (error) {
            console.error(`Error fetching history for operator with ID ${employeeId}:`, error);
            return [];
        }
    }

    /**
     * Get all trainers
     */
    static async getAllTrainers() {
        try {
            const {data, error} = await supabase
                .from('operators')
                .select('*')
                .eq('is_trainer', true);

            if (error) throw error;

            return data.map(op => Operator.fromApiFormat(op));
        } catch (error) {
            console.error('Error fetching trainers:', error);
            return [];
        }
    }
}
