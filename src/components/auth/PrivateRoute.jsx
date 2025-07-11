import React, {useEffect, useState} from 'react';
import {Navigate} from 'react-router-dom';
import {supabase} from '../../core/clients/SupabaseClient';

/**
 * PrivateRoute component that checks if user is authenticated
 * If authenticated, renders the children components
 * If not authenticated, redirects to login page
 */
function PrivateRoute({children}) {
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        // Check if user is authenticated
        const checkAuth = async () => {
            try {
                const {data: {session}} = await supabase.auth.getSession();

                if (session) {
                    setAuthenticated(true);
                }
            } catch (error) {
                console.error('Error checking authentication:', error);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    // Show loading indicator while checking authentication
    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh'
            }}>
                <div>Loading...</div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!authenticated) {
        return <Navigate to="/" replace/>;
    }

    // Render children if authenticated
    return children;
}

export default PrivateRoute;
