import React, {useEffect, useState} from 'react';
import './SimpleNavbar.css';
import SmyrnaLogo from '../../assets/SmyrnaLogo.png';
import {usePreferences} from '../../context/PreferencesContext';
import {AccountManager} from '../../core/managers/AccountManager';

// Add FontAwesome stylesheet dynamically if not already present
const ensureFontAwesome = () => {
    if (!document.getElementById('font-awesome-stylesheet')) {
        const link = document.createElement('link');
        link.id = 'font-awesome-stylesheet';
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
        link.integrity = 'sha512-1ycn6IcaQQ40/MKBW2W4Rhis/DbILU74C1vSrLJxCq57o941Ym01SwNsOMqvEBFlcgUa6xLiPY/NS5R+E6ztJQ==';
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
    }
};

// Function to get appropriate icon for each menu item
const getIconForMenuItem = (id) => {
    switch (id) {
        case 'Dashboard':
            return <i className="fas fa-tachometer-alt"></i>;
        case 'Mixers':
            return <i className="fas fa-truck"></i>;
        case 'Tractors':
            return <i className="fas fa-tractor"></i>;
        case 'Trailers':
            return <i className="fas fa-trailer"></i>;
        case 'Heavy Equipment':
            return <i className="fas fa-snowplow"></i>;
        case 'Operators':
            return <i className="fas fa-users"></i>;
        case 'Managers':
            return <i className="fas fa-user-tie"></i>;
        case 'Plants':
            return <i className="fas fa-industry"></i>;
        case 'Regions':
            return <i className="fas fa-map-marker-alt"></i>;
        case 'List':
            return <i className="fas fa-list"></i>;
        case 'Archive':
            return <i className="fas fa-archive"></i>;
        case 'Reports':
            return <i className="fas fa-file-alt"></i>;
        case 'Settings':
            return <i className="fas fa-cog"></i>;
        case 'MyAccount':
            return <i className="fas fa-user"></i>;
        case 'Logout':
            return <i className="fas fa-sign-out-alt"></i>;
        default:
            return <i className="fas fa-clipboard-list"></i>;
    }
};

// Menu items that require specific permissions to be visible
const menuItems = [
    {text: 'Dashboard', id: 'Dashboard', permission: null, alwaysVisible: false},
    {text: 'Mixers', id: 'Mixers', permission: 'mixers.view', alwaysVisible: false},
    {text: 'Tractors', id: 'Tractors', permission: 'tractors.view', alwaysVisible: false},
    {text: 'Trailers', id: 'Trailers', permission: 'trailers.view', alwaysVisible: false},
    {text: 'Heavy Equipment', id: 'Heavy Equipment', permission: 'heavy_equipment.view', alwaysVisible: false},
    {text: 'Operators', id: 'Operators', permission: 'operators.view', alwaysVisible: false},
    {text: 'Managers', id: 'Managers', permission: 'managers.view', alwaysVisible: false},
    {text: 'Plants', id: 'Plants', permission: 'plants.view', alwaysVisible: false},
    {text: 'Regions', id: 'Regions', permission: 'regions.view', alwaysVisible: false},
    {text: 'List', id: 'List', permission: 'list.view', alwaysVisible: false},
    {text: 'Archive', id: 'Archive', permission: 'archive.view', alwaysVisible: false},
    {text: 'Reports', id: 'Reports', permission: null, alwaysVisible: false},
];

export default function SimpleNavbar({
                                         selectedView,
                                         onSelectView,
                                         children,
                                         userName = '',
                                         showLogout = false,
                                         unreadMessageCount = 0,
                                         onExternalLink,
                                         userId = null
                                     }) {
    const {preferences, toggleNavbarMinimized} = usePreferences();
    const [collapsed, setCollapsed] = useState(preferences.navbarMinimized);
    const [userPermissions, setUserPermissions] = useState([]);
    const [visibleMenuItems, setVisibleMenuItems] = useState([]);

    useEffect(() => {
        ensureFontAwesome();
    }, []);

    // Fetch user permissions when userId changes
    useEffect(() => {
        async function fetchUserPermissions() {
            if (userId) {
                const permissions = await AccountManager.getUserPermissions(userId);
                setUserPermissions(permissions);
            }
        }

        fetchUserPermissions();
    }, [userId]);

    // Fetch user permissions when userId changes
    useEffect(() => {
        async function fetchUserPermissions() {
            if (userId) {
                try {
                    const permissions = await AccountManager.getUserPermissions(userId);
                    console.log('User permissions:', permissions);
                    setUserPermissions(permissions);
                } catch (error) {
                    console.error('Error fetching user permissions:', error);
                    setUserPermissions([]);
                }
            } else {
                setUserPermissions([]);
            }
        }

        fetchUserPermissions();
    }, [userId]);

    // Filter menu items based on permissions
    useEffect(() => {
        async function filterMenuItems() {
            if (!userId) {
                // If no user ID, show nothing
                setVisibleMenuItems([]);
                return;
            }

            try {
                // Get user permissions directly from AccountManager
                const permissions = await AccountManager.getUserPermissions(userId);

                // Filter menu items based on permissions
                const filtered = menuItems.filter(item => {
                    // If permission is required, check if user has it
                    if (item.permission) {
                        return permissions.includes(item.permission);
                    }

                    // If no permission specified, hide by default (Dashboard & Reports)
                    return false;
                });

                setVisibleMenuItems(filtered);

            } catch (error) {
                console.error('Error filtering menu items:', error);
                setVisibleMenuItems([]);
            }
        }

        filterMenuItems();
    }, [userId]);

    const toggleCollapse = () => {
        setCollapsed(!collapsed);
        toggleNavbarMinimized();
    };

    // Update collapsed state when preference changes
    useEffect(() => {
        setCollapsed(preferences.navbarMinimized);
    }, [preferences.navbarMinimized]);

    // Debug: Log menu visibility whenever it changes
    useEffect(() => {
        console.log('Visible menu items:', visibleMenuItems.map(item => item.text));
    }, [visibleMenuItems]);

    return (
        <div className="app-container">
            <div className={`vertical-navbar ${collapsed ? 'collapsed' : ''}`}>
                <div className="navbar-header">
                    <div className="logo-container">
                        <img src={SmyrnaLogo} alt="Smyrna Logo" className="navbar-logo"/>
                    </div>
                </div>
                <button className="collapse-btn" onClick={toggleCollapse}>
                    <i className="fas fa-chevron-right collapse-icon"></i>
                </button>

                <nav className="navbar-menu">
                    <ul>
                        {/* Main menu items with permission checks */}
                        {visibleMenuItems.map((item) => (
                            <li
                                key={item.id}
                                className={`menu-item ${selectedView === item.id ? 'active' : ''}`}
                                onClick={() => onSelectView(item.id)}
                            >
                                <span className="menu-icon"
                                      title={item.text}>
                                    {getIconForMenuItem(item.id)}
                                </span>
                                {!collapsed && <span className="menu-text">{item.text}</span>}
                            </li>
                        ))}
                        {/* Settings - Always visible */}
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

                        {/* My Account - Always at bottom below Settings */}
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
                                    {userName && <span className="user-name">{userName}</span>}
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
    );
}
