import supabase from '../core/clients/SupabaseClient';
import {Operator, OperatorHistory} from '../models/operators/Operator';

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
            if (!plantCode) {
                console.error('No plant code provided to fetchOperatorsByPlant');
                return [];
            }

            // First, check if any operators exist for this plant regardless of position
            const {data: allPlantOps, error: checkError} = await supabase
                .from('operators')
                .select('position')
                .eq('plant_code', plantCode);

            if (checkError) {
                console.error(`Error checking operators for plant ${plantCode}:`, checkError);
            } else {
                const totalOps = allPlantOps ? allPlantOps.length : 0;
                const mixerOps = allPlantOps ? allPlantOps.filter(op => op.position === 'Mixer Operator').length : 0;
                const tractorOps = allPlantOps ? allPlantOps.filter(op => op.position === 'Tractor Operator').length : 0;
                console.log(`Plant ${plantCode} has ${totalOps} total operators, ${mixerOps} mixer operators, ${tractorOps} tractor operators`);
            }

            // Now fetch mixer operators for this plant
            const {data, error} = await supabase
                .from('operators')
                .select('*')
                .eq('plant_code', plantCode)
                .eq('position', 'Mixer Operator');

            if (error) throw error;

            const operators = data ? data.map(op => Operator.fromApiFormat(op)) : [];
            console.log(`Found ${operators.length} mixer operators for plant ${plantCode}`);

            // If no mixer operators found, log all operators for this plant to help debugging
            if (operators.length === 0) {
                const {data: allOps, error: allError} = await supabase
                    .from('operators')
                    .select('employee_id, name, position, status')
                    .eq('plant_code', plantCode);

                if (!allError && allOps && allOps.length > 0) {
                    console.log(`Other operators in plant ${plantCode}:`, allOps);
                }
            }

            return operators;
        } catch (error) {
            console.error(`Error fetching operators for plant ${plantCode}:`, error);
            return [];
        }
    }

    /**
     * Fetch tractor operators
     */
    static async fetchTractorOperators() {
        try {
            const {data, error} = await supabase
                .from('operators')
                .select('*')
                .eq('position', 'Tractor Operator');

            if (error) throw error;

            return data ? data.map(op => Operator.fromApiFormat(op)) : [];
        } catch (error) {
            console.error('Error fetching tractor operators:', error);
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

            if (!data) {
                console.error(`No operator found with employee ID ${employeeId}`);
                return null;
            }

            if (!data.employee_id) {
                console.error(`Found operator data but missing employee_id field:`, data);
                // Try to use the passed employeeId as a fallback
                data.employee_id = employeeId;
            }

            // Initialize smyrna_id if missing
            if (!data.smyrna_id) {
                console.log(`Operator ${employeeId} is missing smyrna_id, initializing an empty one`);
                data.smyrna_id = '';
            }

            // Log the found operator data
            console.log(`Found operator with employee ID ${employeeId}:`, data);
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
            // Ensure operator is an instance of Operator class
            const operatorInstance = operator instanceof Operator ? 
                operator : 
                new Operator({
                    employee_id: operator.employeeId,
                    smyrna_id: operator.smyrnaId,
                    name: operator.name,
                    plant_code: operator.plantCode,
                    status: operator.status,
                    is_trainer: operator.isTrainer,
                    assigned_trainer: operator.assignedTrainer,
                    position: operator.position,
                    created_at: operator.createdAt,
                    updated_at: operator.updatedAt
                });

            const apiData = operatorInstance.toApiFormat();

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
            // In this database, employee_id is the primary key (UUID)
            if (!operator.employeeId) {
                throw new Error('Cannot update operator: missing employee ID');
            }

            // Get current data using the employee_id for lookup
            const { data: currentData, error: lookupError } = await supabase
                .from('operators')
                .select('*')
                .eq('employee_id', operator.employeeId)
                .single();

            if (lookupError || !currentData) {
                throw new Error(`Operator with employee ID ${operator.employeeId} not found`);
            }

            const currentOperator = Operator.fromApiFormat(currentData);

            console.log('Current operator data from DB:', currentData);
            console.log('Operator object passed to update:', operator);

            // Ensure operator is an Operator instance
            const operatorInstance = operator instanceof Operator ? 
                operator : 
                new Operator({
                    // employee_id is the primary key in the database
                    employee_id: operator.employeeId,
                    smyrna_id: operator.smyrnaId,
                    name: operator.name,
                    plant_code: operator.plantCode,
                    status: operator.status,
                    is_trainer: operator.isTrainer,
                    assigned_trainer: operator.assignedTrainer,
                    position: operator.position,
                    created_at: operator.createdAt,
                    updated_at: operator.updatedAt
                });

            console.log('Final operator instance for update:', operatorInstance);

            // Update operators
            const apiData = operatorInstance.toApiFormat();
            console.log('Updating operator with data:', apiData);
            const {error} = await supabase
                .from('operators')
                .update(apiData)
                .eq('employee_id', operatorInstance.employeeId);

            if (error) throw error;

            // Track history for changed fields
            const historyEntries = [];

            // Compare fields and create history entries
            const fieldsToTrack = [
                {field: 'smyrnaId', dbField: 'smyrna_id'},
                {field: 'name', dbField: 'name'},
                {field: 'plantCode', dbField: 'plant_code'},
                {field: 'status', dbField: 'status'},
                {field: 'isTrainer', dbField: 'is_trainer'},
                {field: 'assignedTrainer', dbField: 'assigned_trainer'},
                {field: 'position', dbField: 'position'}
            ];

            for (const {field, dbField} of fieldsToTrack) {
                if (currentOperator[field] !== operatorInstance[field]) {
                    const historyEntry = new OperatorHistory({
                        employee_id: operatorInstance.employeeId,
                        field_name: dbField,
                        old_value: currentOperator[field]?.toString() || '',
                        new_value: operatorInstance[field]?.toString() || '',
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

            return operatorInstance;
        } catch (error) {
            console.error(`Error updating operator with ID ${operator?.employeeId}:`, error);
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
     * Fetch operators with active status first
     */
    static async fetchOperators() {
        try {
            console.log('Fetching operators with OperatorService.fetchOperators');
            // First get all active operators
            const {data: activeData, error: activeError} = await supabase
                .from('operators')
                .select('*')
                .eq('status', 'Active')
                .order('name');

            if (activeError) throw activeError;

            // Then get operators with other statuses
            const {data: otherData, error: otherError} = await supabase
                .from('operators')
                .select('*')
                .not('status', 'eq', 'Active')
                .order('name');

            if (otherError) throw otherError;

            // Log the trainer data to help debug issues with isTrainer field
            const allOperators = [...activeData, ...otherData];
            const trainers = allOperators.filter(op => op.is_trainer === true || String(op.is_trainer).toLowerCase() === 'true');
            console.log(`Fetched ${trainers.length} trainers out of ${allOperators.length} operators`);
            trainers.forEach(trainer => {
                console.log(`Trainer: ${trainer.name}, isTrainer value: ${trainer.is_trainer} (type: ${typeof trainer.is_trainer})`);
            });

            // Combine the results with active operators first
            const operatorsData = [...(activeData || []), ...(otherData || [])];

            // Convert to our model format, ensuring employee_id is properly mapped
            return operatorsData.map(op => ({
                employeeId: op.employee_id,
                smyrnaId: op.smyrna_id,
                name: op.name,
                plantCode: op.plant_code,
                status: op.status,
                isTrainer: op.is_trainer,
                assignedTrainer: op.assigned_trainer,
                position: op.position,
                createdAt: op.created_at,
                updatedAt: op.updated_at
            }));
        } catch (error) {
            console.error('Error fetching operators:', error);
            return [];
        }
    }

    /**
     * Fetch all operators and check their availability
     * @param {Array} mixers - List of mixers to check for operator assignments
     * @returns {Array} - Operators with availability information
     */
    static async fetchOperatorsWithAvailability(mixers = []) {
        try {
            const operators = await this.fetchOperators();

            return operators.map(operator => {
                const isAssigned = mixers.some(mixer => 
                    mixer.assignedOperator === operator.employeeId && 
                    mixer.status === 'Active'
                );

                return {
                    ...operator,
                    isAvailable: operator.status === 'Active' && !isAssigned
                };
            });
        } catch (error) {
            console.error('Error fetching operators with availability:', error);
            return [];
        }
    }

    /**
     * Check if an operator is assigned to any active mixer
     * @param {string} operatorId - ID of the operator to check
     * @param {Array} mixers - List of mixers to check
     * @returns {boolean} - True if the operator is assigned to an active mixer
     */
    static isOperatorAssigned(operatorId, mixers = []) {
        if (!operatorId || operatorId === '0') return false;

        return mixers.some(mixer => 
            mixer.assignedOperator === operatorId && 
            mixer.status === 'Active'
        );
    }

    /**
     * Get detailed operator information by employee ID
     */
    static async getOperatorById(employeeId) {
        try {
            const {data, error} = await supabase
                .from('operators')
                .select('*')
                .eq('employee_id', employeeId)
                .single();

            if (error) throw error;

            return data ? Operator.fromApiFormat(data) : null;
        } catch (error) {
            console.error(`Error fetching operator ${employeeId}:`, error);
            return null;
        }
    }
}
