import React, {useEffect, useState} from 'react'
import PropTypes from 'prop-types'
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
import MyAccountView from '../front/components/myaccount/MyAccountView'
import Navigation from "../front/components/common/Navigation"
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
import TractorsView from '../front/components/tractors/TractorsView'
import TrailersView from '../front/components/trailers/TrailersView'
import EquipmentsView from '../front/components/equipment/EquipmentsView'
import '../front/styles/Theme.css'
import '../front/styles/Global.css'
import PlantsView from '../front/components/plants/PlantsView'
import RegionsView from '../front/components/regions/RegionsView'
import SmyrnaLogo from '../assets/images/SmyrnaLogo.png'
import GuestView from '../front/components/guest/GuestView'
import DesktopOnly from '../front/components/desktop-only/DesktopOnly'

function VersionPopup({version}) {
    if (!version) return null
    return (
        <div className="version-popup-centered">Version: {version}</div>
    )
}

VersionPopup.propTypes = {version: PropTypes.string}

function UpdateLoadingScreen({version}) {
    const [progress, setProgress] = useState(0)
    useEffect(() => {
        const start = Date.now()
        const interval = setInterval(() => {
            const elapsed = Date.now() - start
            const minDuration = 15000
            const randomStep = Math.floor(Math.random() * 7) + 2
            setProgress(prev => Math.min(100, prev + randomStep))
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
                <div className="loading-animation"><img src={SmyrnaLogo} alt="Loading" className="bouncing-logo"/></div>
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
                <VersionPopup version={version}/>
            </div>
        </div>
    )
}

UpdateLoadingScreen.propTypes = {version: PropTypes.string}

function AppContent() {
    const [userId, setUserId] = useState(null)
    const [selectedView, setSelectedView] = useState('Mixers')
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
    const [title, setTitle] = useState('Mixers')
    const [selectedMixer, setSelectedMixer] = useState(null)
    const [selectedTractor, setSelectedTractor] = useState(null)
    const [webViewURL, setWebViewURL] = useState(null)
    const [session, setSession] = useState(null)
    const [userDisplayName, setUserDisplayName] = useState('')
    const [currentVersion, setCurrentVersion] = useState('')
    const [updateMode, setUpdateMode] = useState(false)
    const [latestVersion, setLatestVersion] = useState('')
    const [isGuestOnly, setIsGuestOnly] = useState(false)
    const [rolesLoaded, setRolesLoaded] = useState(false)

    useEffect(() => {
        fetch('/version.json', {cache: 'no-store'}).then(res => res.json()).then(data => setCurrentVersion(data.version || '')).catch(() => setCurrentVersion(''))
    }, [])

    useEffect(() => {
        let intervalId

        function pollVersion() {
            fetch('/version.json', {cache: 'no-store'}).then(res => res.json()).then(data => {
                if (data.version && currentVersion && compareVersions(data.version, currentVersion) > 0) {
                    setLatestVersion(data.version)
                    setUpdateMode(true)
                }
            }).catch(() => {
            })
        }

        if (currentVersion) intervalId = setInterval(pollVersion, 30000)
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
        UserService.getCurrentUser().catch(() => {
        })
    }, [userId])

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    useEffect(() => {
        let timeoutId

        function updateOnlineStatus() {
            if (!navigator.onLine) {
                timeoutId = setTimeout(() => {
                }, 5000)
            } else {
                clearTimeout(timeoutId)
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
            setUserId(null);
            setSelectedView('Mixers');
            setIsGuestOnly(false);
            setRolesLoaded(false)
        }
        window.addEventListener('authSignOut', handleSignOut)
        return () => window.removeEventListener('authSignOut', handleSignOut)
    }, [])

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const {data, error} = await supabase.auth.getSession()
                if (error) return
                setSession(data.session)
                if (data.session?.user?.id) {
                    setUserId(data.session.user.id)
                    sessionStorage.setItem('userId', data.session.user.id)
                } else {
                    const storedUserId = sessionStorage.getItem('userId')
                    setUserId(storedUserId || null)
                }
            } catch {
                setUserId(null)
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
            if (authListener?.subscription) authListener.subscription.unsubscribe()
        }
    }, [])

    useEffect(() => {
        let cancelled = false

        async function loadRoles() {
            if (!userId) return
            try {
                const roles = await UserService.getUserRoles(userId)
                if (cancelled) return
                const guestOnly = roles.length > 0 && roles.every(r => (r?.name || '').toLowerCase() === 'guest')
                setIsGuestOnly(guestOnly)
                setRolesLoaded(true)
                if (guestOnly) setSelectedView('Guest')
            } catch {
                if (!cancelled) {
                    setIsGuestOnly(false);
                    setRolesLoaded(true)
                }
            }
        }

        setRolesLoaded(false)
        if (userId) loadRoles()
        return () => {
            cancelled = true
        }
    }, [userId])

    const fetchUserProfile = async (user) => {
        const {
            data,
            error
        } = await supabase.from('users_profiles').select('first_name, last_name').eq('id', user.id).single()
        if (!error && data && (data.first_name || data.last_name)) setTitle(`Welcome, ${data.first_name || ''} ${data.last_name || ''}`.trim())
    }

    useEffect(() => {
        if (userId) fetchUserProfile(userId)
    }, [userId])

    useEffect(() => {
        if (!userId) return
        const getUserData = async () => {
            const {
                data,
                error
            } = await supabase.from('users_profiles').select('first_name, last_name').eq('id', userId).single()
            if (!error && data && (data.first_name || data.last_name)) setUserDisplayName(`${data.first_name || ''} ${data.last_name || ''}`.trim())
            else setUserDisplayName(userId.substring(0, 8))
        }
        getUserData()
    }, [userId])

    const handleViewSelection = (viewId) => {
        if (isGuestOnly && viewId !== 'Guest') return
        setSelectedView(viewId)
        if (viewId === 'Guest') setTitle('Access Pending')
        else setTitle(viewId)
        if (viewId === 'MyAccount') {
            supabase.auth.getSession().then(({data}) => {
                if (data?.session?.user?.id) {
                    setUserId(data.session.user.id)
                    sessionStorage.setItem('userId', data.session.user.id)
                    setSession(data.session)
                }
            }).catch(() => {
            })
        }
        if (selectedMixer && viewId !== 'Mixers') setSelectedMixer(null)
        if (selectedTractor && viewId !== 'Tractors') setSelectedTractor(null)
    }

    const handleExternalLink = (url) => setWebViewURL(url)

    const renderCurrentView = () => {
        if (!userId) return <LoginView/>
        if (!rolesLoaded) return null
        if (isGuestOnly) return <GuestView/>
        if (webViewURL) return <WebView url={webViewURL} onClose={() => setWebViewURL(null)}/>
        if (selectedView === 'Plants') return <PlantsView title="Plants"/>
        if (selectedView === 'Regions') return <RegionsView title="Regions"/>
        switch (selectedView) {
            case 'Mixers': {
                if (selectedMixer) {
                    try {
                        return <MixerDetailView mixerId={selectedMixer} onClose={() => {
                            setSelectedMixer(null);
                            setTitle('Mixers')
                        }}/>
                    } catch {
                        setSelectedMixer(null)
                        setTitle('Mixers')
                    }
                }
                return <MixersView onSelectMixer={(mixerId) => {
                    if (mixerId) {
                        setSelectedMixer(mixerId);
                        setTitle('Mixer Details')
                    }
                }}/>
            }
            case 'Operators':
                return <OperatorsView title={title}/>
            case 'Managers':
                return <ManagersView title={title}/>
            case 'List':
                return <ListView title="Tasks List"/>
            case 'Archive':
                return <ListView title="Archived Items" showArchived/>
            case 'MyAccount': {
                const effectiveUserId = userId || sessionStorage.getItem('userId') || session?.user?.id
                return effectiveUserId ? <MyAccountView userId={effectiveUserId}/> : <LoginView/>
            }
            case 'Settings':
                return <SettingsView/>
            case 'Teams':
                return <TeamsView/>
            case 'ScheduledOff':
                return <OperatorScheduledOffView operatorId={userId}/>
            case 'Reports':
                return <ReportsView/>
            case 'Tractors':
                return <TractorsView title="Tractor Fleet" onSelectTractor={setSelectedTractor}/>
            case 'Trailers':
                return <TrailersView title="Trailer Fleet" onSelectTrailer={() => {
                }}/>
            case 'Heavy Equipment':
                return <EquipmentsView title="Equipment Fleet" onSelectEquipment={() => {
                }}/>
            default:
                return <div className="coming-soon"><h2>{selectedView} view is coming soon!</h2><p>This feature is under
                    development.</p></div>
        }
    }

    if (isMobile) return <DesktopOnly/>
    if (updateMode) return <UpdateLoadingScreen version={latestVersion || currentVersion}/>

    if (!userId) return (
        <div className="App">{renderCurrentView()}</div>
    )
    if (!rolesLoaded) return null
    if (isGuestOnly) return (
        <div className="App">
            <GuestView/>
        </div>
    )

    return (
        <div className="App">
            {isMobile && <MobileNavigation/>}
            <Navigation
                selectedView={selectedView}
                onSelectView={handleViewSelection}
                onExternalLink={handleExternalLink}
                userName={userDisplayName}
                userDisplayName={userDisplayName}
                userId={userId}
            >
                {renderCurrentView()}
            </Navigation>
        </div>
    )
}

function App() {
    React.useEffect(() => {
        document.documentElement.style.overflowX = 'hidden'
        document.body.style.overflowX = 'hidden'
        return () => {
            document.documentElement.style.overflowX = '';
            document.body.style.overflowX = ''
        }
    }, [])
    return (
        <AuthProvider>
            <PreferencesProvider>
                <AppContent/>
                <div style={{position: 'relative', zIndex: 9999}}><OnlineUsersOverlay/><TipBanner/></div>
            </PreferencesProvider>
        </AuthProvider>
    )
}

export default App
