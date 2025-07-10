import React, {useEffect, useState} from 'react';
import './index.css';
import './App.css';
import MobileNavToggle from './components/common/MobileNavToggle';
import MixersView from './components/mixers/MixersView';
import ManagersView from './components/managers/ManagersView';
import SettingsView from './components/settings/SettingsView';
import MixerDetailView from './components/mixers/MixerDetailView';
import OperatorsView from './components/operators/OperatorsView';
import WebView from './components/common/WebView';
import LoginView from './components/auth/LoginView';
import LoadingScreen from './components/common/LoadingScreen';
import MyAccountView from './components/account/MyAccountView';
import SimpleNavbar from "./components/common/SimpleNavbar";
import GuestView from './components/auth/GuestView';
import {AuthProvider} from './context/AuthContext';
import {supabase} from './core/SupabaseClient';
import {PreferencesProvider} from './context/PreferencesContext';
import {UserRoleType} from './utils/RoleManager';
import './styles/Theme.css';
import './styles/Global.css';

function AppContent() {
    const [selectedView, setSelectedView] = useState('Mixers');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [userRole, setUserRole] = useState('');

    // Handle responsive layout
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const [title, setTitle] = useState('Mixers');
    const [selectedMixer, setSelectedMixer] = useState(null);
    const [selectedTractor, setSelectedTractor] = useState(null);
    const [webViewURL, setWebViewURL] = useState(null);
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState(null);
    const [userId, setUserId] = useState(null);

    // Listen for auth sign out events
    useEffect(() => {
        const handleSignOut = () => {
            // Clear state on sign out
            setUserId(null);
            setUserRole('');
            setSelectedView('Mixers');
        };

        window.addEventListener('authSignOut', handleSignOut);

        return () => {
            window.removeEventListener('authSignOut', handleSignOut);
        };
    }, []);

    // Check for authentication on component mount
    useEffect(() => {
        const checkAuth = async () => {
            setLoading(true);
            try {
                // Get the current session from Supabase
                const {data, error} = await supabase.auth.getSession();
                if (error) {
                    console.error('Error getting session:', error);
                    return;
                }

                setSession(data.session);

                // Set the user ID if session exists
                if (data.session?.user?.id) {
                    setUserId(data.session.user.id);
                    sessionStorage.setItem('userId', data.session.user.id);
                } else {
                    // Try to get userId from sessionStorage as fallback
                    const storedUserId = sessionStorage.getItem('userId');
                    if (storedUserId) {
                        setUserId(storedUserId);
                    } else {
                        // Clear state if no user ID found
                        setUserId(null);
                        setUserRole('');
                    }
                }
            } catch (error) {
                console.error('Error checking auth:', error);
                // Clear state on error
                setUserId(null);
                setUserRole('');
            } finally {
                setLoading(false);
            }
        };

        checkAuth();

        // Set up auth state change listener
        const {data: authListener} = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
            if (session?.user?.id) {
                setUserId(session.user.id);
                sessionStorage.setItem('userId', session.user.id);
            } else if (event === 'SIGNED_OUT') {
                setUserId(null);
                sessionStorage.removeItem('userId');
            }
        });

        return () => {
            if (authListener?.subscription) {
                authListener.subscription.unsubscribe();
            }
        };
    }, []);

    // Function to fetch user profile - defined before any conditional returns
    const fetchUserProfile = async (user) => {
        try {
            const {data, error} = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
                return;
            }

            if (data && (data.first_name || data.last_name)) {
                setTitle(`Welcome, ${data.first_name || ''} ${data.last_name || ''}`.trim());
            }
        } catch (error) {
            console.error('Error in fetchUserProfile:', error);
        }
    };

    // Effect to fetch user profile when userId changes
    useEffect(() => {
        if (userId) {
            fetchUserProfile(userId);
            fetchUserRole(userId);
        }
    }, [userId]);

    // Function to fetch user role
    const fetchUserRole = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('users_roles')
                .select('role_name')
                .eq('user_id', userId)
                .single();

            if (error) {
                console.error('Error fetching user role:', error);
                setUserRole('');
                return;
            }

            if (data && data.role_name) {
                setUserRole(data.role_name);
            } else {
                setUserRole('');
            }
        } catch (error) {
            console.error('Error in fetchUserRole:', error);
            setUserRole('');
        }
    };

    // Format user name for display
    const [userDisplayName, setUserDisplayName] = useState('');

    // Update user display name when profile is fetched
    useEffect(() => {
        if (userId) {
            const getUserData = async () => {
                try {
                    const {data, error} = await supabase
                        .from('profiles')
                        .select('first_name, last_name')
                        .eq('id', userId)
                        .single();

                    if (error) {
                        console.error('Error fetching user profile:', error);
                        return;
                    }

                    if (data && (data.first_name || data.last_name)) {
                        setUserDisplayName(`${data.first_name || ''} ${data.last_name || ''}`.trim());
                    } else {
                        // Fallback to email or user ID if name not available
                        setUserDisplayName(userId.substring(0, 8));
                    }
                } catch (error) {
                    console.error('Error fetching user profile:', error);
                }
            };

            getUserData();
        }
    }, [userId]);

    // If still loading auth state, show loading indicator
    if (loading) {
        return <LoadingScreen message="Loading application..."/>;
    }

    // If not authenticated, show login
    if (!userId) {
        return <LoginView/>;
    }

    // If user has Guest role, show restricted access view
    if (userRole === UserRoleType.guest) {
        return <GuestView />;
    }

    // Handle view selection
    const handleViewSelection = (viewId) => {
        setSelectedView(viewId);
        setTitle(viewId);

        // If switching to MyAccount, ensure we have latest session
        if (viewId === 'MyAccount') {
            // Refresh the session to ensure we have latest data
            supabase.auth.getSession().then(({data}) => {
                if (data?.session?.user?.id) {
                    setUserId(data.session.user.id);
                    sessionStorage.setItem('userId', data.session.user.id);
                    setSession(data.session);
                }
            }).catch(error => {
                console.error('Error refreshing session:', error);
            });
        }

        // Reset selected items when switching views
        if (selectedMixer && viewId !== 'Mixers') {
            setSelectedMixer(null);
        }
        if (selectedTractor && viewId !== 'Tractors') {
            setSelectedTractor(null);
        }
    };

    // Handle opening external links
    const handleExternalLink = (url) => {
        setWebViewURL(url);
    };

    // Render the currently selected view
    const renderCurrentView = () => {
        if (webViewURL) {
            return (
                <WebView
                    url={webViewURL}
                    onClose={() => setWebViewURL(null)}
                />
            );
        }

        switch (selectedView) {
            case 'Mixers':
                if (selectedMixer) {
                    console.log('App.js: Rendering MixerDetailView with ID:', selectedMixer);
                    try {
                        return (
                            <MixerDetailView
                                mixerId={selectedMixer}
                                onClose={() => {
                                    setSelectedMixer(null);
                                    setTitle('Mixers');
                                }}
                            />
                        );
                    } catch (error) {
                        console.error('Error rendering MixerDetailView:', error);
                        setSelectedMixer(null);
                        setTitle('Mixers');
                        return (
                            <MixersView
                                onSelectMixer={(mixerId) => {
                                    if (mixerId) {
                                        setSelectedMixer(mixerId);
                                        setTitle('Mixer Details');
                                    }
                                }}
                            />
                        );
                    }
                }
                return (
                    <MixersView
                        onSelectMixer={(mixerId) => {
                            if (mixerId) {
                                // The filters will be preserved in the context
                                setSelectedMixer(mixerId);
                                setTitle('Mixer Details');
                            }
                        }}
                    />
                );
            case 'Operators':
                return (
                    <OperatorsView
                        title={title}
                        showSidebar={false}
                        setShowSidebar={() => {
                        }}
                    />
                );
                            case 'Managers':
                return (
                    <ManagersView
                        title={title}
                        showSidebar={false}
                        setShowSidebar={() => {}}
                    />
                );
            case 'MyAccount':
                // Try to get userId from various sources to ensure we have it
                const effectiveUserId = userId || sessionStorage.getItem('userId') || session?.user?.id;

                if (effectiveUserId) {
                    console.log('Rendering MyAccountView with userId:', effectiveUserId);
                    return <MyAccountView userId={effectiveUserId}/>;
                }

                console.log('No userId available, redirecting to login');
                return <LoginView/>;
                case 'Settings':
                  return <SettingsView />;
            default:
                return (
                    <div className="coming-soon">
                        <h2>{selectedView} view is coming soon!</h2>
                        <p>This feature is under development.</p>
                    </div>
                );
        }
    };

    return (
        <div className="App">
            {isMobile && <MobileNavToggle />}
            <SimpleNavbar
                selectedView={selectedView}
                onSelectView={handleViewSelection}
                unreadMessageCount={unreadMessageCount}
                onExternalLink={handleExternalLink}
                userName={userDisplayName}
                userDisplayName={userDisplayName}
            >
                {renderCurrentView()}
            </SimpleNavbar>
        </div>
    );
}

function App() {
  // Apply overflow protection to prevent horizontal scrolling
  React.useEffect(() => {
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';

    // Clean up on unmount
    return () => {
      document.documentElement.style.overflowX = '';
      document.body.style.overflowX = '';
    };
  }, []);

    return (
        <AuthProvider>
            <PreferencesProvider>
                <AppContent/>
            </PreferencesProvider>
        </AuthProvider>
    );
}

export default App;