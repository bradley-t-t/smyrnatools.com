import React, {useEffect, useState} from 'react';
import {Navigate} from 'react-router-dom';
import {supabase} from '../../core/clients/SupabaseClient';

function PrivateRoute({children}) {
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const {data: {session}} = await supabase.auth.getSession();

                if (session) {
                    setAuthenticated(true);
                }
            } catch (error) {
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

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

    if (!authenticated) {
        return <Navigate to="/" replace/>;
    }

    return children;
}

export default PrivateRoute;