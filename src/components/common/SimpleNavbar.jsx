import React, {useState} from 'react';
import './SimpleNavbar.css';
import SmyrnaLogo from '../../assets/SmyrnaLogo.png';

const menuItems = [
    {text: 'Dashboard', id: 'Dashboard'},
    {text: 'Mixers', id: 'Mixers'},
    {text: 'Tractors', id: 'Tractors'},
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
    const [collapsed, setCollapsed] = useState(false);

    const toggleCollapse = () => {
        setCollapsed(!collapsed);
    };

    return (
        <div className="app-container">
            <div className={`vertical-navbar ${collapsed ? 'collapsed' : ''}`}>
                <div className="navbar-header">
                    <div className="logo-container">
                        <img src={SmyrnaLogo} alt="Smyrna Logo" className="navbar-logo"/>
                    </div>
                </div>
                <button className="collapse-btn" onClick={toggleCollapse}>
                    {collapsed ? '→' : '←'}
                </button>

                <nav className="navbar-menu">
                    <ul>
                        {menuItems.map((item) => (
                            <li
                                key={item.id}
                                className={`menu-item ${selectedView === item.id ? 'active' : ''}`}
                                onClick={() => onSelectView(item.id)}
                            >
                                {!collapsed && <span className="menu-text"
                                                     style={selectedView === item.id ? {color: '#b80017'} : {}}>{item.text}</span>}
                                {collapsed && <span className="menu-initial"
                                                    style={selectedView === item.id ? {color: '#b80017'} : {}}>{item.text.charAt(0)}</span>}
                            </li>
                        ))}

                        {/* User Account Section */}
                        <li
                            className={`menu-item ${selectedView === 'MyAccount' ? 'active' : ''}`}
                            onClick={() => onSelectView('MyAccount')}
                        >
                            {!collapsed && (
                                <>
                                    <span className="menu-text"
                                          style={selectedView === 'MyAccount' ? {color: '#b80017'} : {}}>My Account</span>
                                    {userName && <div className="user-name">{userName}</div>}
                                </>
                            )}
                            {collapsed && <span className="menu-initial"
                                                style={selectedView === 'MyAccount' ? {color: '#b80017'} : {}}>A</span>}
                        </li>

                        {showLogout && (
                            <li
                                className={`menu-item ${selectedView === 'Logout' ? 'active' : ''}`}
                                onClick={() => onSelectView('Logout')}
                            >
                                {!collapsed && (
                                    <>
                                        <span className="menu-text"
                                              style={selectedView === 'Logout' ? {color: '#b80017'} : {}}>Logout</span>
                                    </>
                                )}
                                {collapsed && <span className="menu-initial"
                                                    style={selectedView === 'Logout' ? {color: '#b80017'} : {}}>L</span>}
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
