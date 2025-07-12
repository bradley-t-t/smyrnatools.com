import React, { useEffect } from 'react';
import { supabase } from '../../core/clients/SupabaseClient';
import { RoleService } from '../../services/auth/RoleService';
import { AccountManager } from '../../core/managers/AccountManager';

/**
 * Component that runs on app start to perform role diagnostics
 * This is a hidden component that just runs logic on mount
 */
function RoleSetupComponent() {
    useEffect(() => {
        const performDiagnostics = async () => {
            try {
                console.log('========== ROLE DIAGNOSTIC CHECKS ==========');

                // Direct database query - most reliable method
                try {
                    console.log('Checking roles with direct database query...');
                    const { data, error } = await supabase
                        .from('accounts_roles')
                        .select('*');

                    if (error) throw error;

                    if (data && data.length > 0) {
                        console.log(`✅ Direct query: Found ${data.length} roles:`, data.map(r => r.name).join(', '));
                    } else {
                        console.warn('⚠️ Direct query: No roles found in database');
                    }
                } catch (e) {
                    console.error('❌ Direct query error:', e.message);
                }

                // Check via RoleService
                try {
                    console.log('Checking roles with RoleService...');
                    const roles = await RoleService.getAllRoles();

                    if (roles && roles.length > 0) {
                        console.log(`✅ RoleService: Found ${roles.length} roles:`, roles.map(r => r.name).join(', '));
                    } else {
                        console.warn('⚠️ RoleService: No roles returned');
                    }
                } catch (e) {
                    console.error('❌ RoleService error:', e.message);
                }

                // Check via AccountManager
                try {
                    console.log('Checking roles with AccountManager...');
                    const roles = await AccountManager.getAllRoles();

                    if (roles && roles.length > 0) {
                        console.log(`✅ AccountManager: Found ${roles.length} roles:`, roles.map(r => r.name).join(', '));
                    } else {
                        console.warn('⚠️ AccountManager: No roles returned');
                    }
                } catch (e) {
                    console.error('❌ AccountManager error:', e.message);
                }

                // Check for any caching issues
                try {
                    console.log('Checking for potential caching issues...');
                    // Make two consecutive calls to see if results are consistent
                    const roles1 = await AccountManager.getAllRoles();
                    const roles2 = await RoleService.getAllRoles();

                    const count1 = roles1?.length || 0;
                    const count2 = roles2?.length || 0;

                    if (count1 !== count2) {
                        console.warn(`⚠️ Inconsistent role counts: AccountManager=${count1}, RoleService=${count2}`);
                    } else {
                        console.log(`✅ Consistent role counts across services: ${count1}`);
                    }
                } catch (e) {
                    console.error('❌ Caching check error:', e.message);
                }

                console.log('=========== END OF DIAGNOSTICS ===========');
            } catch (error) {
                console.error('Error in role diagnostics:', error);
            }
        };

        performDiagnostics();
    }, []);

    // This component doesn't render anything visible
    return null;
}

export default RoleSetupComponent;
