import React, {useEffect, useState} from 'react';
import './index.css';
import './App.css';
import {supabase} from '../services/DatabaseService';
import MobileNavigation from '../components/common/MobileNavigation';
import MixersView from '../components/mixers/MixersView';
import ManagersView from '../components/managers/ManagersView';
import SettingsView from '../components/settings/SettingsView';
import MixerDetailView from '../components/mixers/MixerDetailView';
import OperatorsView from '../components/operators/OperatorsView';
import LoginView from '../components/auth/LoginView';
import LoadingScreen from '../components/common/LoadingScreen';
import MyAccountView from '../components/users/MyAccountView';
import Navigation from "../components/common/Navigation";
import GuestView from '../components/auth/GuestView';
import ListView from '../components/list/ListView';
import {AuthProvider} from '../context/AuthContext';
import {PreferencesProvider} from '../context/PreferencesContext';
import WebView from "../components/common/WebView";
import {UserService} from "../services/UserService";
import OnlineUsersOverlay from '../components/common/OnlineUsersOverlay';
import TipBanner from '../components/common/TipBanner';
import '../styles/Theme.css';
import '../styles/Global.css';

function AppContent() {
    const [selectedView, setSelectedView] = useState('Mixers');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [userRole, setUserRole] = useState('');
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
    useEffect(() => {
        const handleSignOut = () => {
            setUserId(null);
            setUserRole('');
            setSelectedView('Mixers');
        };

        window.addEventListener('authSignOut', handleSignOut);

        return () => {
            window.removeEventListener('authSignOut', handleSignOut);
        };
    }, []);
    useEffect(() => {
        const checkAuth = async () => {
            setLoading(true);
            try {
                const {data, error} = await supabase.auth.getSession();
                if (error) {
                    return;
                }

                setSession(data.session);

                if (data.session?.user?.id) {
                    setUserId(data.session.user.id);
                    sessionStorage.setItem('userId', data.session.user.id);
                } else {
                    const storedUserId = sessionStorage.getItem('userId');
                    if (storedUserId) {
                        setUserId(storedUserId);
                    } else {
                        setUserId(null);
                        setUserRole('');
                    }
                }
            } catch (error) {
                setUserId(null);
                setUserRole('');
            } finally {
                setLoading(false);
            }
        };

        checkAuth();

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

    const fetchUserProfile = async (user) => {
        try {
            const {data, error} = await supabase
                .from('users_profiles')
                .select('first_name, last_name')
                .eq('id', user.id)
                .single();

            if (error) {
                return;
            }

            if (data && (data.first_name || data.last_name)) {
                setTitle(`Welcome, ${data.first_name || ''} ${data.last_name || ''}`.trim());
            }
        } catch (error) {
        }
    };

    useEffect(() => {
        if (userId) {
            fetchUserProfile(userId);
            fetchUserRole(userId);
        }
    }, [userId]);

    const fetchUserRole = async (userId) => {
        try {
            const highestRole = await UserService.getHighestRole(userId);

            if (highestRole && highestRole.name) {
                setUserRole(highestRole.name.toLowerCase());
            } else {
                setUserRole('');
            }
        } catch (error) {
            setUserRole('');
        }
    };

    const [userDisplayName, setUserDisplayName] = useState('');

    useEffect(() => {
        if (userId) {
            const getUserData = async () => {
                try {
                    const {data, error} = await supabase
                        .from('users_profiles')
                        .select('first_name, last_name')
                        .eq('id', userId)
                        .single();

                    if (error) {
                        return;
                    }

                    if (data && (data.first_name || data.last_name)) {
                        setUserDisplayName(`${data.first_name || ''} ${data.last_name || ''}`.trim());
                    } else {
                        setUserDisplayName(userId.substring(0, 8));
                    }
                } catch (error) {
                }
            };

            getUserData();
        }
    }, [userId]);

    if (loading) {
        return <LoadingScreen message="Loading application..." fullPage={true}/>;
    }

    if (!userId) {
        return <LoginView/>;
    }

    if (userRole.toLowerCase() === 'guest') {
        return <GuestView/>;
    }

    const handleViewSelection = (viewId) => {
        setSelectedView(viewId);
        setTitle(viewId);

        if (viewId === 'MyAccount') {
            supabase.auth.getSession().then(({data}) => {
                if (data?.session?.user?.id) {
                    setUserId(data.session.user.id);
                    sessionStorage.setItem('userId', data.session.user.id);
                    setSession(data.session);
                }
            }).catch(error => {
            });
        }

        if (selectedMixer && viewId !== 'Mixers') {
            setSelectedMixer(null);
        }
        if (selectedTractor && viewId !== 'Tractors') {
            setSelectedTractor(null);
        }
    };

    const handleExternalLink = (url) => {
        setWebViewURL(url);
    };

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
                        setShowSidebar={() => {
                        }}
                    />
                );
            case 'List':
                return (
                    <ListView
                        title="Tasks List"
                        showSidebar={false}
                        setShowSidebar={() => {}}
                    />
                );
                            case 'Archive':
                return (
                    <ListView
                        title="Archived Items"
                        showSidebar={false}
                        setShowSidebar={() => {}}
                        showArchived={true}
                    />
                );
            case 'MyAccount':
                const effectiveUserId = userId || sessionStorage.getItem('userId') || session?.user?.id;

                if (effectiveUserId) {
                    return <MyAccountView userId={effectiveUserId}/>;
                }

                return <LoginView/>;
            case 'Settings':
                return <SettingsView/>;
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
            {isMobile && <MobileNavigation/>}
            <Navigation
                selectedView={selectedView}
                onSelectView={handleViewSelection}
                unreadMessageCount={unreadMessageCount}
                onExternalLink={handleExternalLink}
                userName={userDisplayName}
                userDisplayName={userDisplayName}
                userId={userId}
            >
                {renderCurrentView()}
            </Navigation>
        </div>
    );
}

function App() {
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
                <div style={{ position: 'relative', zIndex: 9999 }}>
                    <OnlineUsersOverlay/>
                    <TipBanner/>
                </div>
            </PreferencesProvider>
        </AuthProvider>
    );
}

export default App;