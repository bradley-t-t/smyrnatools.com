import React, {useEffect, useState} from 'react'
import './index.css'
import './App.css'
import {supabase} from '../services/DatabaseService'
import MobileNavigation from '../front/components/common/MobileNavigation'
import MixersView from '../front/components/mixers/MixersView'
import ManagersView from '../front/components/managers/ManagersView'
import SettingsView from '../front/components/settings/SettingsView'
import MixerDetailView from '../front/components/mixers/MixerDetailView'
import OperatorsView from '../front/components/operators/OperatorsView'
import LoginView from '../front/components/login/LoginView'
import LoadingScreen from '../front/components/common/LoadingScreen'
import MyAccountView from '../front/components/myaccount/MyAccountView'
import Navigation from "../front/components/common/Navigation"
import GuestView from '../front/components/guest/GuestView'
import ListView from '../front/components/list/ListView'
import {AuthProvider} from './context/AuthContext'
import {PreferencesProvider} from './context/PreferencesContext'
import WebView from "../front/components/common/WebView"
import {UserService} from "../services/UserService"
import OnlineUsersOverlay from '../front/components/common/OnlineUsersOverlay'
import TipBanner from '../front/components/common/TipBanner'
import TeamsView from '../front/components/teams/TeamsView'
import OperatorScheduledOffView from '../front/components/operators/OperatorScheduledOffView'
import ReportsView from '../front/components/reports/ReportsView'
import ConnectionScreen from '../front/components/common/ConnectionScreen'
import TractorsView from '../front/components/tractors/TractorsView'
import TrailersView from '../front/components/trailers/TrailersView'
import EquipmentsView from '../front/components/equipment/EquipmentsView'
import '../front/styles/Theme.css'
import '../front/styles/Global.css'
import PlantsView from '../front/components/plants/PlantsView'

function VersionPopup({ version }) {
    if (!version) return null
    return (
        <div className="version-popup-centered">
            Version: {version} Author: Trenton Taylor
        </div>
    )
}

function UpdateLoadingScreen({ version }) {
    const [progress, setProgress] = useState(0)
    useEffect(() => {
        let start = Date.now()
        let interval = setInterval(() => {
            let elapsed = Date.now() - start
            let minDuration = 15000
            let randomStep = Math.floor(Math.random() * 7) + 2
            if (progress < 100) {
                setProgress(prev => Math.min(100, prev + randomStep))
            }
            if (elapsed >= minDuration && progress >= 100) {
                clearInterval(interval)
                setTimeout(() => {
                    window.location.reload(true)
                }, 500)
            }
        }, 300)
        return () => clearInterval(interval)
    }, [progress])
    return (
        <div className="loading-screen full-page">
            <div className="loading-content">
                <div className="loading-animation">
                    <img src={require('../assets/images/SmyrnaLogo.png')} alt="Loading" className="bouncing-logo"/>
                </div>
                <p className="loading-message">Smyrna Tools is Updating...</p>
                <div style={{
                    width: '100%',
                    height: '12px',
                    borderRadius: '6px',
                    background: 'var(--card-bg)',
                    marginTop: '32px',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: 'var(--accent)',
                        transition: 'width 0.3s'
                    }}/>
                </div>
                <VersionPopup version={version} />
            </div>
        </div>
    )
}

function AppContent() {
    const [userId, setUserId] = useState(null)
    const [selectedView, setSelectedView] = useState('Mixers')
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
    const [userRole, setUserRole] = useState('')
    const [connectionLost, setConnectionLost] = useState(false)
    const [userCheckFailed, setUserCheckFailed] = useState(false)
    const [title, setTitle] = useState('Mixers')
    const [selectedMixer, setSelectedMixer] = useState(null)
    const [selectedTractor, setSelectedTractor] = useState(null)
    const [webViewURL, setWebViewURL] = useState(null)
    const [unreadMessageCount, setUnreadMessageCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [session, setSession] = useState(null)
    const [userDisplayName, setUserDisplayName] = useState('')
    const [currentVersion, setCurrentVersion] = useState('')
    const [updateMode, setUpdateMode] = useState(false)
    const [latestVersion, setLatestVersion] = useState('')

    useEffect(() => {
        fetch('/version.json', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setCurrentVersion(data.version || ''))
            .catch(() => setCurrentVersion(''))
    }, [])

    useEffect(() => {
        let intervalId
        function pollVersion() {
            fetch('/version.json', { cache: 'no-store' })
                .then(res => res.json())
                .then(data => {
                    if (data.version && currentVersion && compareVersions(data.version, currentVersion) > 0) {
                        setLatestVersion(data.version)
                        setUpdateMode(true)
                    }
                })
        }
        if (currentVersion) {
            intervalId = setInterval(pollVersion, 30000)
        }
        return () => {
            if (intervalId) clearInterval(intervalId)
        }
    }, [currentVersion])

    function compareVersions(a, b) {
        const pa = a.split('.').map(Number)
        const pb = b.split('.').map(Number)
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const na = pa[i] || 0
            const nb = pb[i] || 0
            if (na > nb) return 1
            if (na < nb) return -1
        }
        return 0
    }

    useEffect(() => {
        async function checkCurrentUser() {
            try {
                const user = await UserService.getCurrentUser()
                if (!user) {
                    setUserCheckFailed(true)
                } else {
                    setUserCheckFailed(false)
                }
            } catch {
                setUserCheckFailed(true)
            }
        }
        checkCurrentUser()
    }, [userId])

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768)
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    useEffect(() => {
        let timeoutId
        function updateOnlineStatus() {
            if (!navigator.onLine) {
                timeoutId = setTimeout(() => {
                    setConnectionLost(true)
                }, 5000)
            } else {
                clearTimeout(timeoutId)
                setConnectionLost(false)
            }
        }
        window.addEventListener('online', updateOnlineStatus)
        window.addEventListener('offline', updateOnlineStatus)
        updateOnlineStatus()
        return () => {
            window.removeEventListener('online', updateOnlineStatus)
            window.removeEventListener('offline', updateOnlineStatus)
            clearTimeout(timeoutId)
        }
    }, [])

    useEffect(() => {
        const handleSignOut = () => {
            setUserId(null)
            setUserRole('')
            setSelectedView('Mixers')
        }
        window.addEventListener('authSignOut', handleSignOut)
        return () => {
            window.removeEventListener('authSignOut', handleSignOut)
        }
    }, [])

    useEffect(() => {
        const checkAuth = async () => {
            setLoading(true)
            try {
                const {data, error} = await supabase.auth.getSession()
                if (error) {
                    return
                }
                setSession(data.session)
                if (data.session?.user?.id) {
                    setUserId(data.session.user.id)
                    sessionStorage.setItem('userId', data.session.user.id)
                } else {
                    const storedUserId = sessionStorage.getItem('userId')
                    if (storedUserId) {
                        setUserId(storedUserId)
                    } else {
                        setUserId(null)
                        setUserRole('')
                    }
                }
            } catch (error) {
                setUserId(null)
                setUserRole('')
            } finally {
                setLoading(false)
            }
        }
        checkAuth()
        const {data: authListener} = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session)
            if (session?.user?.id) {
                setUserId(session.user.id)
                sessionStorage.setItem('userId', session.user.id)
            } else if (event === 'SIGNED_OUT') {
                setUserId(null)
                sessionStorage.removeItem('userId')
            }
        })
        return () => {
            if (authListener?.subscription) {
                authListener.subscription.unsubscribe()
            }
        }
    }, [])

    const fetchUserProfile = async (user) => {
        try {
            const {data, error} = await supabase
                .from('users_profiles')
                .select('first_name, last_name')
                .eq('id', user.id)
                .single()
            if (error) {
                return
            }
            if (data && (data.first_name || data.last_name)) {
                setTitle(`Welcome, ${data.first_name || ''} ${data.last_name || ''}`.trim())
            }
        } catch (error) {
        }
    }

    useEffect(() => {
        if (userId) {
            fetchUserProfile(userId)
            fetchUserRole(userId)
        }
    }, [userId])

    const fetchUserRole = async (userId) => {
        try {
            const highestRole = await UserService.getHighestRole(userId)
            if (highestRole && highestRole.name) {
                setUserRole(highestRole.name.toLowerCase())
            } else {
                setUserRole('')
            }
        } catch (error) {
            setUserRole('')
        }
    }

    useEffect(() => {
        if (userId) {
            const getUserData = async () => {
                try {
                    const {data, error} = await supabase
                        .from('users_profiles')
                        .select('first_name, last_name')
                        .eq('id', userId)
                        .single()
                    if (error) {
                        return
                    }
                    if (data && (data.first_name || data.last_name)) {
                        setUserDisplayName(`${data.first_name || ''} ${data.last_name || ''}`.trim())
                    } else {
                        setUserDisplayName(userId.substring(0, 8))
                    }
                } catch (error) {
                }
            }
            getUserData()
        }
    }, [userId])

    const handleViewSelection = (viewId) => {
        setSelectedView(viewId)
        setTitle(viewId)
        if (viewId === 'MyAccount') {
            supabase.auth.getSession().then(({data}) => {
                if (data?.session?.user?.id) {
                    setUserId(data.session.user.id)
                    sessionStorage.setItem('userId', data.session.user.id)
                    setSession(data.session)
                }
            }).catch(error => {
            })
        }
        if (selectedMixer && viewId !== 'Mixers') {
            setSelectedMixer(null)
        }
        if (selectedTractor && viewId !== 'Tractors') {
            setSelectedTractor(null)
        }
    }

    const handleExternalLink = (url) => {
        setWebViewURL(url)
    }

    const renderCurrentView = () => {
        if (!userId) {
            return <LoginView/>
        }
        if (webViewURL) {
            return (
                <WebView
                    url={webViewURL}
                    onClose={() => setWebViewURL(null)}
                />
            )
        }
        if (selectedView === 'Plants') {
            return (
                <PlantsView
                    title="Plants"
                    showSidebar={false}
                    setShowSidebar={() => {}}
                />
            )
        }
        switch (selectedView) {
            case 'Mixers':
                if (selectedMixer) {
                    try {
                        return (
                            <MixerDetailView
                                mixerId={selectedMixer}
                                onClose={() => {
                                    setSelectedMixer(null)
                                    setTitle('Mixers')
                                }}
                            />
                        )
                    } catch (error) {
                        setSelectedMixer(null)
                        setTitle('Mixers')
                        return (
                            <MixersView
                                onSelectMixer={(mixerId) => {
                                    if (mixerId) {
                                        setSelectedMixer(mixerId)
                                        setTitle('Mixer Details')
                                    }
                                }}
                            />
                        )
                    }
                }
                return (
                    <MixersView
                        onSelectMixer={(mixerId) => {
                            if (mixerId) {
                                setSelectedMixer(mixerId)
                                setTitle('Mixer Details')
                            }
                        }}
                    />
                )
            case 'Operators':
                return (
                    <OperatorsView
                        title={title}
                        showSidebar={false}
                        setShowSidebar={() => {
                        }}
                    />
                )
            case 'Managers':
                return (
                    <ManagersView
                        title={title}
                        showSidebar={false}
                        setShowSidebar={() => {
                        }}
                    />
                )
            case 'List':
                return (
                    <ListView
                        title="Tasks List"
                        showSidebar={false}
                        setShowSidebar={() => {}}
                    />
                )
            case 'Archive':
                return (
                    <ListView
                        title="Archived Items"
                        showSidebar={false}
                        setShowSidebar={() => {}}
                        showArchived={true}
                    />
                )
            case 'MyAccount':
                const effectiveUserId = userId || sessionStorage.getItem('userId') || session?.user?.id
                if (effectiveUserId) {
                    return <MyAccountView userId={effectiveUserId}/>
                }
                return <LoginView/>
            case 'Settings':
                return <SettingsView/>
            case 'Teams':
                return <TeamsView />
            case 'ScheduledOff':
                return <OperatorScheduledOffView operatorId={userId} />
            case 'Reports':
                return <ReportsView />
            case 'Tractors':
                return (
                    <TractorsView
                        title="Tractor Fleet"
                        showSidebar={false}
                        setShowSidebar={() => {}}
                        onSelectTractor={setSelectedTractor}
                    />
                )
            case 'Trailers':
                return (
                    <TrailersView
                        title="Trailer Fleet"
                        showSidebar={false}
                        setShowSidebar={() => {}}
                        onSelectTrailer={() => {}}
                    />
                )
            case 'Heavy Equipment':
                return (
                    <EquipmentsView
                        title="Equipment Fleet"
                        showSidebar={false}
                        setShowSidebar={() => {}}
                        onSelectEquipment={() => {}}
                    />
                )
            default:
                return (
                    <div className="coming-soon">
                        <h2>{selectedView} view is coming soon!</h2>
                        <p>This feature is under development.</p>
                    </div>
                )
        }
    }

    if (updateMode) {
        return <UpdateLoadingScreen version={latestVersion || currentVersion}/>
    }

    return (
        <div className="App">
            {isMobile && userId && <MobileNavigation/>}
            {userId ? (
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
            ) : (
                renderCurrentView()
            )}
        </div>
    )
}

function App() {
    React.useEffect(() => {
        document.documentElement.style.overflowX = 'hidden'
        document.body.style.overflowX = 'hidden'
        return () => {
            document.documentElement.style.overflowX = ''
            document.body.style.overflowX = ''
        }
    }, [])
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
    )
}

export default App
