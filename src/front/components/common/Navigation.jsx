import React, {useEffect, useState} from 'react'
import './styles/Navigation.css'
import SmyrnaLogo from '../../assets/images/SmyrnaLogo.png'
import {usePreferences} from '../../../app/context/PreferencesContext'
import {UserService} from "../../../services/UserService"

const ensureFontAwesome = () => {
    if (!document.getElementById('font-awesome-stylesheet')) {
        const link = document.createElement('link')
        link.id = 'font-awesome-stylesheet'
        link.rel = 'stylesheet'
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css'
        link.integrity = 'sha512-1ycn6IcaQQ40/MKBW2W4Rhis/DbILU74C1vSrLJxCq57o941Ym01SwNsOMqvEBFlcgUa6xLiPY/NS5R+E6ztJQ=='
        link.crossOrigin = 'anonymous'
        document.head.appendChild(link)
    }
}

const getIconForMenuItem = (id) => {
    switch (id) {
        case 'Dashboard':
            return <i className="fas fa-tachometer-alt"></i>
        case 'Mixers':
            return <i className="fas fa-truck"></i>
        case 'Tractors':
            return <i className="fas fa-tractor"></i>
        case 'Trailers':
            return <i className="fas fa-trailer"></i>
        case 'Heavy Equipment':
            return <i className="fas fa-snowplow"></i>
        case 'Operators':
            return <i className="fas fa-users"></i>
        case 'Managers':
            return <i className="fas fa-user-tie"></i>
        case 'Plants':
            return <i className="fas fa-industry"></i>
        case 'Regions':
            return <i className="fas fa-map-marker-alt"></i>
        case 'List':
            return <i className="fas fa-list"></i>
        case 'Archive':
            return <i className="fas fa-archive"></i>
        case 'Settings':
            return <i className="fas fa-cog"></i>
        case 'MyAccount':
            return <i className="fas fa-user"></i>
        case 'Logout':
            return <i className="fas fa-sign-out-alt"></i>
        case 'Teams':
            return <i className="fas fa-people-arrows"></i>
        case 'Reports':
            return <i className="fas fa-file-alt"></i>
        default:
            return <i className="fas fa-clipboard-list"></i>
    }
}

const menuItems = [
    {text: 'Mixers', id: 'Mixers', permission: 'mixers.view', alwaysVisible: false},
    {text: 'Teams', id: 'Teams', permission: 'teams.view', alwaysVisible: false},
    {text: 'Tractors', id: 'Tractors', permission: 'tractors.view', alwaysVisible: false},
    {text: 'Trailers', id: 'Trailers', permission: 'trailers.view', alwaysVisible: false},
    {text: 'Heavy Equipment', id: 'Heavy Equipment', permission: 'heavy_equipment.view', alwaysVisible: false},
    {text: 'Operators', id: 'Operators', permission: 'operators.view', alwaysVisible: false},
    {text: 'Scheduled Off', id: 'ScheduledOff', permission: 'operators_scheduled_off.view', alwaysVisible: false},
    {text: 'Managers', id: 'Managers', permission: 'managers.view', alwaysVisible: false},
    {text: 'Plants', id: 'Plants', permission: 'plants.view', alwaysVisible: false},
    {text: 'Regions', id: 'Regions', permission: 'regions.view', alwaysVisible: false},
    {text: 'List', id: 'List', permission: 'list.view', alwaysVisible: false},
    {text: 'Reports', id: 'Reports', permission: 'reports.view', alwaysVisible: false}
]

export default function Navigation({
                                         selectedView,
                                         onSelectView,
                                         children,
                                         userName = '',
                                         showLogout = false,
                                         unreadMessageCount = 0,
                                         onExternalLink,
                                         userId = null,
                                         listStatusFilter = ''
                                     }) {
    const {preferences, toggleNavbarMinimized} = usePreferences()
    const [collapsed, setCollapsed] = useState(preferences.navbarMinimized)
    const [userPermissions, setUserPermissions] = useState([])
    const [visibleMenuItems, setVisibleMenuItems] = useState([])

    useEffect(() => {
        ensureFontAwesome()

        const handleStatusFilterChange = (event) => {
            const { statusFilter } = event.detail
            if (statusFilter === 'completed' || listStatusFilter === 'completed') {
                setVisibleMenuItems([...visibleMenuItems])
            }
        }

        window.addEventListener('list-status-filter-change', handleStatusFilterChange)

        return () => {
            window.removeEventListener('list-status-filter-change', handleStatusFilterChange)
        }
    }, [listStatusFilter, visibleMenuItems])

    useEffect(() => {
        async function fetchUserPermissions() {
            if (userId) {
                try {
                    const permissions = await UserService.getUserPermissions(userId)
                    setUserPermissions(permissions)
                } catch (error) {
                    setUserPermissions([])
                }
            } else {
                setUserPermissions([])
            }
        }

        fetchUserPermissions()
    }, [userId])

    useEffect(() => {
        async function filterMenuItems() {
            if (!userId) {
                setVisibleMenuItems([])
                return
            }

            try {
                const permissions = await UserService.getUserPermissions(userId)
                const filtered = menuItems.filter(item => {
                    if (item.permission) {
                        return permissions.includes(item.permission)
                    }
                    return item.permission === null
                })

                setVisibleMenuItems(filtered)
            } catch (error) {
                setVisibleMenuItems([])
            }
        }

        filterMenuItems()
    }, [userId])

    const toggleCollapse = () => {
        setCollapsed(!collapsed)
        toggleNavbarMinimized()
    }

    useEffect(() => {
        setCollapsed(preferences.navbarMinimized)
    }, [preferences.navbarMinimized])

    return (
        <div className="app-container">
            <div className={`vertical-navbar ${collapsed ? 'collapsed' : ''}`}>
                <div className="navbar-header">
                    <div className="logo-container">
                        <img src={SmyrnaLogo} alt="Smyrna Logo" className="navbar-logo" title="Smyrna Ready Mix"/>
                    </div>
                </div>
                <button className="collapse-btn" onClick={toggleCollapse}>
                    <i className="fas fa-chevron-right collapse-icon"></i>
                </button>

                <nav className="navbar-menu">
                    <ul>
                        {visibleMenuItems.map((item) => {
                            let isActive = false

                            if (item.id === 'List') {
                                isActive = selectedView === 'List'
                            } else {
                                isActive = selectedView === item.id
                            }

                            return (
                                <li
                                    key={item.id}
                                    className={`menu-item ${isActive ? 'active' : ''}`}
                                    onClick={() => {
                                        if (window.appSwitchView && (item.id === 'List' || item.id === 'Archive')) {
                                            window.appSwitchView(item.id)
                                        } else {
                                            onSelectView(item.id)
                                        }
                                    }}
                                >
                                    <span className="menu-icon"
                                          title={item.text}>
                                        {getIconForMenuItem(item.id)}
                                    </span>
                                    {!collapsed && <span className="menu-text">{item.text}</span>}
                                </li>
                            )
                        })}
                        <li
                            className={`menu-item ${selectedView === 'Settings' ? 'active' : ''}`}
                            onClick={() => onSelectView('Settings')}
                        >
                            <span className="menu-icon"
                                  title="Settings">
                                {getIconForMenuItem('Settings')}
                            </span>
                            {!collapsed && <span className="menu-text">Settings</span>}
                        </li>
                        <li
                            className={`menu-item ${selectedView === 'MyAccount' ? 'active' : ''}`}
                            onClick={() => onSelectView('MyAccount')}
                        >
                            <span className="menu-icon"
                                  title="My Account">
                                {getIconForMenuItem('MyAccount')}
                            </span>
                            {!collapsed && (
                                <div className="user-menu-content">
                                    <span className="menu-text">My Account</span>
                                    {userName && <span className="user-name" style={{ paddingLeft: 0 }}>{userName}</span>}
                                </div>
                            )}
                        </li>
                    </ul>
                </nav>
            </div>

            <div className={`content-area ${collapsed ? 'expanded' : ''}`}>
                {children}
            </div>
        </div>
    )
}