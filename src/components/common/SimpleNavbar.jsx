import React, {useState, useEffect} from 'react';
import './SimpleNavbar.css';
import SmyrnaLogo from '../../assets/SmyrnaLogo.png';
import { usePreferences } from '../../context/PreferencesContext';

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
    switch(id) {
        case 'Dashboard': return <i className="fas fa-tachometer-alt"></i>;
        case 'Mixers': return <i className="fas fa-truck"></i>;
        case 'Tractors': return <i className="fas fa-tractor"></i>;
        case 'Trailers': return <i className="fas fa-trailer"></i>;
        case 'Heavy Equipment': return <i className="fas fa-snowplow"></i>;
        case 'Operators': return <i className="fas fa-users"></i>;
        case 'Plants': return <i className="fas fa-industry"></i>;
        case 'Regions': return <i className="fas fa-map-marker-alt"></i>;
        case 'Reports': return <i className="fas fa-file-alt"></i>;
        case 'Settings': return <i className="fas fa-cog"></i>;
        case 'MyAccount': return <i className="fas fa-user"></i>;
        case 'Logout': return <i className="fas fa-sign-out-alt"></i>;
        default: return <i className="fas fa-clipboard-list"></i>;
    }
};

const menuItems = [
    {text: 'Dashboard', id: 'Dashboard'},
    {text: 'Mixers', id: 'Mixers'},
    {text: 'Tractors', id: 'Tractors'},
    {text: 'Trailers', id: 'Trailers'},
    {text: 'Heavy Equipment', id: 'Heavy Equipment'},
    {text: 'Operators', id: 'Operators'},
    {text: 'Plants', id: 'Plants'},
    {text: 'Regions', id: 'Regions'},
    {text: 'Reports', id: 'Reports'},
    {text: 'Settings', id: 'Settings'},
];

export default function SimpleNavbar({
                                         selectedView,
                                         onSelectView,
                                         children,
                                         userName = '',
                                         showLogout = false,
                                         unreadMessageCount = 0,
                                         onExternalLink
                                     }) {
    const { preferences, toggleNavbarMinimized } = usePreferences();
    const [collapsed, setCollapsed] = useState(preferences.navbarMinimized);

    useEffect(() => {
        ensureFontAwesome();
    }, []);

    const toggleCollapse = () => {
        setCollapsed(!collapsed);
        toggleNavbarMinimized();
    };

    // Update collapsed state when preference changes
    useEffect(() => {
        setCollapsed(preferences.navbarMinimized);
    }, [preferences.navbarMinimized]);

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
                        {menuItems.map((item) => (
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

                        {/* User Account Section */}
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

                        {showLogout && (
                            <li
                                className={`menu-item ${selectedView === 'Logout' ? 'active' : ''}`}
                                onClick={() => onSelectView('Logout')}
                            >
                                <span className="menu-icon"
                                      title="Logout">
                                    {getIconForMenuItem('Logout')}
                                </span>
                                {!collapsed && (
                                                                              <span className="menu-text">Logout</span>
                                )}
                            </li>
                        )}
                    </ul>
                </nav>
            </div>

            <div className={`content-area ${collapsed ? 'expanded' : ''}`}>
                {children}
            </div>
        </div>
    );
}
