import React, { useEffect, useState } from 'react';
import { supabase } from '../../core/clients/SupabaseClient';
import { DatabaseService } from '../../core/services/DatabaseService';

/**
 * Component for debugging roles in database
 */
function RoleDebugComponent() {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('RoleDebugComponent: Querying roles directly');

            // Try with Supabase client first
            const { data, error } = await supabase
                .from('accounts_roles')
                .select('*');

            if (error) {
                console.error('RoleDebugComponent: Error with Supabase client:', error);
                setError(`Supabase client error: ${error.message}`);
                return;
            }

            console.log('RoleDebugComponent: Found roles with Supabase client:', data);

            // Try with raw SQL query as well
            try {
                console.log('RoleDebugComponent: Attempting raw SQL query');
                const rawData = await DatabaseService.getAllRecords('accounts_roles');
                console.log('RoleDebugComponent: Raw SQL query result:', rawData);

                // If raw query worked but Supabase client didn't, use raw data
                if ((data === null || data.length === 0) && rawData && rawData.length > 0) {
                    console.log('RoleDebugComponent: Using raw SQL results instead');
                    setRoles(rawData);
                    return;
                }
            } catch (sqlErr) {
                console.error('RoleDebugComponent: Raw SQL error:', sqlErr);
            }

            setRoles(data || []);
        } catch (err) {
            console.error('RoleDebugComponent: Exception:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const addDefaultRoles = async () => {
        try {
            setLoading(true);
            const defaultRoles = [
                { name: 'User', permissions: ['my_account.view'], weight: 1 },
                { name: 'Supervisor', permissions: ['my_account.view', 'operators.view'], weight: 2 },
                { name: 'Manager', permissions: ['my_account.view', 'operators.view', 'operators.edit'], weight: 3 },
                { name: 'Admin', permissions: ['my_account.view', 'operators.view', 'operators.edit', 'admin.access'], weight: 4 }
            ];

            const { error } = await supabase
                .from('accounts_roles')
                .insert(defaultRoles);

            if (error) {
                console.error('Error adding default roles:', error);
                setError(error.message);
                return;
            }

            console.log('Added default roles successfully');
            fetchRoles();
        } catch (err) {
            console.error('Exception adding roles:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ 
            position: 'fixed', 
            bottom: '10px', 
            right: '10px', 
            backgroundColor: '#f5f5f5', 
            border: '1px solid #ddd',
            borderRadius: '5px',
            padding: '10px',
            zIndex: 9999,
            fontSize: '12px',
            maxWidth: '300px',
            maxHeight: '200px',
            overflow: 'auto'
        }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Role Database Debug</h4>

            {loading ? (
                <p>Loading roles...</p>
            ) : error ? (
                <div>
                    <p style={{ color: 'red' }}>Error: {error}</p>
                    <button onClick={fetchRoles}>Retry</button>
                </div>
            ) : (
                <div>
                    <p>Roles in database: {roles.length}</p>
                    <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                        {roles.map(role => (
                            <li key={role.id}>{role.name} (weight: {role.weight})</li>
                        ))}
                    </ul>
                    {roles.length === 0 && (
                        <button onClick={addDefaultRoles}>Add Default Roles</button>
                    )}
                    <button onClick={fetchRoles} style={{ marginLeft: '10px' }}>Refresh</button>
                </div>
            )}
        </div>
    );
}

export default RoleDebugComponent;
