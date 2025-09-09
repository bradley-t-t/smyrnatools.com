import React, {useEffect, useState, useRef} from 'react'
import './styles/Navigation.css'
import SmyrnaLogo from '../../assets/images/SmyrnaLogo.png'
import FlagSmyrnaLogo from '../../assets/images/FlagSmyrnaLogo.png'
import {usePreferences} from '../../app/context/PreferencesContext'
import {UserService} from "../../services/UserService"

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
        case 'Pickup Trucks':
            return <i className="fas fa-truck-pickup"></i>
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
    {text: 'Tractors', id: 'Tractors', permission: 'tractors.view', alwaysVisible: false},
    {text: 'Trailers', id: 'Trailers', permission: 'trailers.view', alwaysVisible: false},
    {text: 'Heavy Equipment', id: 'Heavy Equipment', permission: 'equipment.view', alwaysVisible: false},
    {text: 'Pickup Trucks', id: 'Pickup Trucks', permission: 'pickup_trucks.view', alwaysVisible: false},
    {text: 'Teams', id: 'Teams', permission: 'teams.view', alwaysVisible: false},
    {text: 'Operators', id: 'Operators', permission: 'operators.view', alwaysVisible: false},
    {text: 'Managers', id: 'Managers', permission: 'managers.view', alwaysVisible: false},
    {text: 'List', id: 'List', permission: 'list.view', alwaysVisible: false},
    {text: 'Reports', id: 'Reports', permission: 'reports.view', alwaysVisible: false},
    {text: 'Plants', id: 'Plants', permission: 'plants.view', alwaysVisible: false},
    {text: 'Regions', id: 'Regions', permission: 'regions.view', alwaysVisible: false}
]

export default function Navigation({
    selectedView,
    onSelectView,
    children,
    userName = '',
    userId = null,
    listStatusFilter = ''
}) {
    const {preferences, toggleNavbarMinimized} = usePreferences()
    const [collapsed, setCollapsed] = useState(preferences.navbarMinimized)
    const [visibleMenuItems, setVisibleMenuItems] = useState([])
    const regionType = preferences.selectedRegion?.type
    const regionCode = preferences.selectedRegion?.code
    const lastMenuItemsRef = useRef([])

    useEffect(() => {
        ensureFontAwesome()
        const handleStatusFilterChange = (event) => {
            const {statusFilter} = event.detail
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
        async function filterMenuItems() {
            if (!userId) {
                setVisibleMenuItems([])
                return
            }
            try {
                const permissions = await UserService.getUserPermissions(userId)
                let filtered = menuItems.filter(item => {
                    if (item.permission) {
                        return permissions.includes(item.permission)
                    }
                    return item.permission === null
                })
                if (regionType === 'Office') {
                    filtered = filtered.filter(item => item.id === 'Reports')
                } else if (regionType === 'Aggregate') {
                    filtered = filtered.filter(item => !['Mixers', 'Teams', 'List', 'Tractors', 'Trailers'].includes(item.id))
                }
                setVisibleMenuItems(filtered)
                lastMenuItemsRef.current = filtered
            } catch (error) {
                setVisibleMenuItems([])
                lastMenuItemsRef.current = []
            }
        }
        filterMenuItems()
    }, [userId, regionType, regionCode])

    useEffect(() => {
        if (
            visibleMenuItems.length > 0 &&
            !visibleMenuItems.some(item => item.id === selectedView) &&
            selectedView !== 'Settings' &&
            selectedView !== 'MyAccount'
        ) {
            onSelectView(visibleMenuItems[0].id)
        }
    }, [visibleMenuItems, selectedView, onSelectView])

    useEffect(() => {
        setCollapsed(preferences.navbarMinimized)
    }, [preferences.navbarMinimized])

    const toggleCollapse = () => {
        setCollapsed(!collapsed)
        toggleNavbarMinimized()
    }

    return (
        <div className="app-container">
            <div className={`vertical-navbar ${collapsed ? 'collapsed' : ''}`}>
                <div className="navbar-header">
                    <div className="logo-container">
                        {collapsed ? (
                            <img
                                src={FlagSmyrnaLogo}
                                alt="Smyrna Logo"
                                className="navbar-logo"
                                title="Smyrna Ready Mix"
                                width={40}
                                height={40}
                                style={{imageRendering: 'auto'}}
                                draggable={false}
                                decoding="async"
                                loading="eager"
                            />
                        ) : (
                            <img
                                src={SmyrnaLogo}
                                alt="Smyrna Logo"
                                className="navbar-logo large"
                                title="Smyrna Ready Mix"
                                width={260}
                                height={90}
                                style={{imageRendering: 'auto', maxWidth: 260, maxHeight: 90, margin: 0, padding: 0}}
                                draggable={false}
                                decoding="async"
                                loading="eager"
                            />
                        )}
                    </div>
                </div>
                <button className="collapse-btn" onClick={toggleCollapse}>
                    <i className="fas fa-chevron-right collapse-icon"></i>
                </button>
                <nav className="navbar-menu">
                    <ul style={!collapsed ? {padding: 0, margin: 0, gap: 0, rowGap: 0} : {}}>
                        {visibleMenuItems.map((item) => {
                            const isActive = item.id === 'List' ? selectedView === 'List' : selectedView === item.id
                            return (
                                <li
                                    key={item.id}
                                    className={`menu-item ${isActive ? 'active' : ''} ${collapsed ? 'menu-item-collapsed' : ''}`}
                                    onClick={() => {
                                        if (window.appSwitchView && (item.id === 'List' || item.id === 'Archive')) {
                                            window.appSwitchView(item.id)
                                        } else {
                                            onSelectView(item.id)
                                        }
                                    }}
                                    style={collapsed ? {} : {
                                        padding: '13px 18px',
                                        minHeight: 0,
                                        lineHeight: 1.35,
                                        fontSize: 17
                                    }}
                                >
                                    <span
                                        className={`menu-icon${collapsed ? ' menu-icon-collapsed' : ''}`}
                                        title={item.text}
                                        style={collapsed ? {} : {marginRight: 14, fontSize: 20, minWidth: 24}}
                                    >
                                        {getIconForMenuItem(item.id)}
                                    </span>
                                    {!collapsed && <span className="menu-text" style={{fontSize: 17, padding: 0, margin: 0}}>{item.text}</span>}
                                </li>
                            )
                        })}
                        <li
                            className={`menu-item ${selectedView === 'Settings' ? 'active' : ''} ${collapsed ? 'menu-item-collapsed' : ''}`}
                            onClick={() => {
                                if (window.appSwitchView) {
                                    window.appSwitchView('Settings')
                                } else {
                                    onSelectView('Settings')
                                }
                            }}
                            style={collapsed ? {} : {
                                padding: '13px 18px',
                                minHeight: 0,
                                lineHeight: 1.35,
                                fontSize: 17
                            }}
                        >
                            <span
                                className={`menu-icon${collapsed ? ' menu-icon-collapsed' : ''}`}
                                title="Settings"
                                style={collapsed ? {} : {marginRight: 14, fontSize: 20, minWidth: 24}}
                            >
                                {getIconForMenuItem('Settings')}
                            </span>
                            {!collapsed && <span className="menu-text" style={{fontSize: 17, padding: 0, margin: 0}}>Settings</span>}
                        </li>
                        <li
                            className={`menu-item ${selectedView === 'MyAccount' ? 'active' : ''} ${collapsed ? 'menu-item-collapsed' : ''}`}
                            onClick={() => {
                                if (window.appSwitchView) {
                                    window.appSwitchView('MyAccount')
                                } else {
                                    onSelectView('MyAccount')
                                }
                            }}
                            style={collapsed ? {} : {
                                padding: '13px 18px',
                                minHeight: 0,
                                lineHeight: 1.35,
                                fontSize: 17
                            }}
                        >
                            <span
                                className={`menu-icon${collapsed ? ' menu-icon-collapsed' : ''}`}
                                title="My Account"
                                style={collapsed ? {} : {marginRight: 14, fontSize: 20, minWidth: 24}}
                            >
                                {getIconForMenuItem('MyAccount')}
                            </span>
                            {!collapsed && (
                                <div className="user-menu-content">
                                    <span className="menu-text" style={{fontSize: 17, padding: 0, margin: 0}}>My Account</span>
                                    {userName && <span className="user-name" style={{paddingLeft: 0}}>{userName}</span>}
                                </div>
                            )}
                        </li>
                    </ul>
                </nav>
            </div>
            <div className={`content-area ${collapsed ? 'expanded' : ''}`}>{children}</div>
        </div>
    )
}