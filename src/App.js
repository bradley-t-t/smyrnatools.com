import React, {useEffect, useState} from 'react';
import './index.css';
import './App.css';
import MixersView from './components/mixers/MixersView';
import SettingsView from './components/settings/SettingsView';
import MixerDetailView from './components/mixers/MixerDetailView';
import OperatorsView from './components/operators/OperatorsView';
import WebView from './components/common/WebView';
import LoginView from './components/auth/LoginView';
import LoadingScreen from './components/common/LoadingScreen';
import MyAccountView from './components/account/MyAccountView';
import SimpleNavbar from "./components/common/SimpleNavbar";
import {AuthProvider} from './context/AuthContext';
import {supabase} from './core/SupabaseClient';
import {PreferencesProvider} from './context/PreferencesContext';
import './styles/Theme.css';
import './styles/Global.css';

function AppContent() {
    const [selectedView, setSelectedView] = useState('Mixers');
    const [title, setTitle] = useState('Mixers');
    const [selectedMixer, setSelectedMixer] = useState(null);
    const [selectedTractor, setSelectedTractor] = useState(null);
    const [webViewURL, setWebViewURL] = useState(null);
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState(null);
    const [userId, setUserId] = useState(null);

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
                    }
                }
            } catch (error) {
                console.error('Error checking auth:', error);
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
        }
    }, [userId]);

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
                    return (
                        <MixerDetailView
                            mixerId={selectedMixer}
                            onClose={() => {
                                setSelectedMixer(null);
                                setTitle('Mixers');
                            }}
                        />
                    );
                }
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
            case 'Operators':
                return (
                    <OperatorsView
                        title={title}
                        showSidebar={false}
                        setShowSidebar={() => {
                        }}
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
  // Apply overflow protection
  React.useEffect(() => {
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';

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