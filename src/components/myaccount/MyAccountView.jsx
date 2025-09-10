import React, {useEffect, useState} from 'react';
import {supabase} from '../../services/DatabaseService';
import {AuthService} from '../../services/AuthService';
import {UserService} from "../../services/UserService";
import {usePreferences} from '../../app/context/PreferencesContext';
import './styles/MyAccountView.css';
import LoadingScreen from "../common/LoadingScreen";
import {RegionService} from '../../services/RegionService'

function MyAccountView({userId}) {
    const {preferences, updatePreferences} = usePreferences();
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [userRole, setUserRole] = useState('');
    const [plantCode, setPlantCode] = useState('');
    const [regionCode, setRegionCode] = useState('');
    const [regionName, setRegionName] = useState('');
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [, setIsAuthenticated] = useState(false);
    const [, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('profile');
    const [permittedRegions, setPermittedRegions] = useState([])
    const [regionsLoaded, setRegionsLoaded] = useState(false)
    const [hasAllRegionsPermission, setHasAllRegionsPermission] = useState(false)

    useEffect(() => {
        let cancelled = false
        async function load() {
            setLoading(true)
            setRegionsLoaded(false)
            try {
                const {data} = await supabase.auth.getSession()
                const session = data?.session
                const uid = userId || session?.user?.id || sessionStorage.getItem('userId')
                if (!uid) { setIsAuthenticated(false); throw new Error('No active session or user ID') }
                setIsAuthenticated(true)
                const allPerm = await UserService.hasPermission(uid, 'region.select.all').catch(()=>false)
                if (!cancelled) setHasAllRegionsPermission(!!allPerm)
                let sessionEmail = session?.user?.email || ''
                if (!sessionEmail) {
                    try { const {data: userData} = await supabase.from('users').select('email').eq('id', uid).single(); if (userData?.email) sessionEmail = userData.email } catch {}
                }
                setEmail(sessionEmail)
                const [{data: profileData},{data: usersData}, highestRole] = await Promise.all([
                    supabase.from('users_profiles').select('first_name, last_name, plant_code, regions').eq('id', uid).single(),
                    firstName && lastName ? Promise.resolve({data:null}) : supabase.from('users').select('*, profiles(first_name, last_name)').eq('id', uid).single(),
                    UserService.getHighestRole(uid).catch(()=>null)
                ])
                if (highestRole?.name) setUserRole(highestRole.name)
                let regionsList = []
                if (allPerm) {
                    try { regionsList = await RegionService.fetchRegions() } catch {}
                }
                if (profileData) {
                    setUser({...profileData})
                    if (profileData.first_name) setFirstName(profileData.first_name)
                    if (profileData.last_name) setLastName(profileData.last_name)
                    const pc = profileData.plant_code || ''
                    setPlantCode(pc)
                    if (!allPerm) {
                        const regionCodes = Array.isArray(profileData.regions) ? profileData.regions.filter(r => typeof r === 'string' && r.trim()) : []
                        if (regionCodes.length) {
                            try { const all = await RegionService.fetchRegions(); const codeSet = new Set(regionCodes.map(c=>c.toLowerCase())); regionsList = all.filter(r => codeSet.has((r.regionCode || '').toLowerCase())) } catch {}
                        }
                        if (!regionsList.length && pc) { try { regionsList = await RegionService.fetchRegionsByPlantCode(pc) } catch {} }
                    }
                } else if (!regionsList.length && !allPerm && usersData?.profiles) {
                    if (usersData.profiles.first_name) setFirstName(usersData.profiles.first_name)
                    if (usersData.profiles.last_name) setLastName(usersData.profiles.last_name)
                }
                if (regionsList.length) {
                    setPermittedRegions(regionsList)
                    const currentSelCode = preferences.selectedRegion?.code
                    let chosen = regionsList.find(r => (r.regionCode || r.region_code) === currentSelCode)
                    if (!chosen) chosen = regionsList[0]
                    const sel = {code: chosen.regionCode || chosen.region_code || '', name: chosen.regionName || chosen.region_name || '', type: chosen.type || chosen.region_type || ''}
                    updatePreferences('selectedRegion', sel)
                    setRegionCode(sel.code)
                    setRegionName(sel.name)
                } else {
                    setPermittedRegions([])
                    updatePreferences('selectedRegion', {code:'',name:'',type:''})
                    setRegionCode('')
                    setRegionName('')
                }
            } catch (e) { setMessage(`Error: ${e.message}`) }
            finally { if (!cancelled) { setRegionsLoaded(true); setLoading(false) } }
        }
        load(); return () => {cancelled = true}
    }, [userId])

    const updateProfile = async (e) => {
        e.preventDefault(); setLoading(true); setMessage('')
        try {
            const uid = userId || sessionStorage.getItem('userId')
            if (!uid) {
                const {data:{session},error:sessionError} = await supabase.auth.getSession(); if (sessionError || !session) throw new Error('No active session or user ID')
                const {error: pe} = await supabase.from('users_profiles').update({first_name:firstName,last_name:lastName,updated_at:new Date().toISOString()}).eq('id', session.user.id)
                if (pe) throw pe
            } else {
                const {error: pe} = await supabase.from('users_profiles').update({first_name:firstName,lastName:lastName,updated_at:new Date().toISOString()}).eq('id', uid)
                if (pe) throw pe
            }
            setMessage('Profile updated successfully!')
        } catch (err) { setMessage(`Error: ${err.message}`) } finally { setLoading(false) }
    }

    const updatePassword = async (e) => {
        e.preventDefault(); setLoading(true); setPasswordError(''); setMessage('')
        try {
            if (!currentPassword) throw new Error('Current password is required')
            if (newPassword !== confirmPassword) throw new Error('New passwords do not match')
            if (newPassword.length < 8) throw new Error('Password must be at least 8 characters')
            const {data: userData, error: userError} = await supabase.from('users').select('id, email, password_hash, salt').eq('email', email).single()
            if (userError || !userData) throw new Error('Could not verify current password')
            const {AuthUtility} = await import('../../utils/AuthUtility')
            const computedHash = await AuthUtility.hashPassword(currentPassword, userData.salt)
            if (computedHash !== userData.password_hash) throw new Error('Current password is incorrect')
            const salt = await AuthUtility.generateSalt()
            if (typeof salt !== 'string' || salt.length !== 32 || !/^[0-9a-f]{32}$/i.test(salt)) throw new Error('Failed to generate valid salt')
            const newPasswordHash = await AuthUtility.hashPassword(newPassword, salt)
            const {error: updateError} = await supabase.from('users').update({password_hash:newPasswordHash,salt,updated_at:new Date().toISOString()}).eq('id', userData.id)
            if (updateError) throw updateError
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowPasswordModal(false)
            await AuthService.signOut(); try { await supabase.auth.signOut() } catch {}
            sessionStorage.removeItem('userId'); window.location.href = '/login'
        } catch (err) { setPasswordError(err.message) } finally { setLoading(false) }
    }

    const handleSignOut = async () => {
        setLoading(true)
        try { await AuthService.signOut(); await supabase.auth.signOut(); sessionStorage.removeItem('userId'); window.location.href = '/' } catch (err) { setMessage(`Error signing out: ${err.message}`) } finally { setLoading(false) }
    }

    useEffect(() => { document.documentElement.style.setProperty('--myaccount-accent', `var(--accent)`) }, [preferences.accentColor])

    const handleChangeRegion = (e) => {
        const code = e.target.value
        if (!code) { updatePreferences('selectedRegion', {code:'',name:'',type:''}); setRegionCode(''); setRegionName(''); return }
        const r = permittedRegions.find(x => (x.regionCode || x.region_code) === code); if (!r) return
        const name = r.regionName || r.region_name || ''; const type = r.type || r.region_type || ''
        updatePreferences('selectedRegion', {code, name, type}); setRegionCode(code); setRegionName(name)
    }

    if (loading) return <LoadingScreen fullPage={true} message={message.startsWith('Error') ? 'Retrying...' : 'Loading account...'}/>

    return (
        <div className="my-account-container">
            <div className="account-hero">
                <div className="account-avatar" style={{borderColor: 'var(--myaccount-accent)'}}>
                    {firstName && lastName ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() : <i className="fas fa-user"></i>}
                </div>
                <div className="account-hero-content">
                    <h1>{(firstName || lastName) ? `${firstName || ''} ${lastName || ''}`.trim() : 'My Account'}</h1>
                    <p className="account-subtitle">{email || 'No email available'}</p>
                    <div className="account-badges-row">
                        {userRole && <div className="account-badge" style={{backgroundColor: 'var(--myaccount-accent)'}}>{userRole}</div>}
                        {(preferences.selectedRegion?.name || regionName) && <div className="account-badge" style={{backgroundColor: 'var(--myaccount-accent)'}}>{preferences.selectedRegion?.name || regionName}</div>}
                        {plantCode && <div className="account-badge plant-badge">{plantCode}</div>}
                        {hasAllRegionsPermission && <div className="account-badge" style={{backgroundColor: 'var(--myaccount-accent)'}}>All Regions</div>}
                    </div>
                </div>
            </div>
            {message && (
                <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                    <div className="message-icon">{message.includes('Error') ? <i className="fas fa-exclamation-circle"></i> : <i className="fas fa-check-circle"></i>}</div>
                    <p>{message}</p>
                    <button className="message-close" onClick={() => setMessage('')} aria-label="Dismiss message"><i className="fas fa-times"></i></button>
                </div>
            )}
            <div className="account-tabs">
                <button className={`tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')} style={activeTab === 'profile' ? {borderBottomColor: 'var(--myaccount-accent)'} : {}}><i className="fas fa-user"></i> Profile</button>
                <button className={`tab ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')} style={activeTab === 'security' ? {borderBottomColor: 'var(--myaccount-accent)'} : {}}><i className="fas fa-shield-alt"></i> Security</button>
            </div>
            <div className="account-tab-content" style={{display: activeTab === 'profile' ? 'block' : 'none'}}>
                <div className="account-section">
                    <div className="section-header">
                        <h2><i className="fas fa-id-card" style={{color: 'var(--myaccount-accent)'}}></i> Personal Information</h2>
                        <p>Update your personal details</p>
                    </div>
                    <div className="account-card elevated">
                        <form onSubmit={updateProfile} className="account-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="first_name">First Name</label>
                                    <div className="input-with-icon">
                                        <i className="fas fa-user" style={{color: 'var(--myaccount-accent)', marginRight: '8px'}}></i>
                                        <input type="text" id="first_name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Enter your first name" required style={{paddingLeft: '45px'}}/>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="last_name">Last Name</label>
                                    <div className="input-with-icon">
                                        <i className="fas fa-user" style={{color: 'var(--myaccount-accent)', marginRight: '8px'}}></i>
                                        <input type="text" id="last_name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Enter your last name" required style={{paddingLeft: '45px'}}/>
                                    </div>
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="btn primary" disabled={loading} style={{backgroundColor: 'var(--myaccount-accent)'}}><i className="fas fa-save"></i> Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
                <div className="account-section">
                    <div className="section-header">
                        <h2><i className="fas fa-info-circle" style={{color: 'var(--myaccount-accent)'}}></i> Account Details</h2>
                        <p>Your account information</p>
                    </div>
                    <div className="account-card elevated">
                        <div className="info-grid">
                            <div className="info-item">
                                <div className="info-label"><i className="fas fa-envelope" style={{color: 'var(--myaccount-accent)'}}></i>Email</div>
                                <div className="info-value">{email || 'Not available'}</div>
                            </div>
                            {userRole && <div className="info-item"><div className="info-label"><i className="fas fa-user-tag" style={{color: 'var(--myaccount-accent)'}}></i>Role</div><div className="info-value">{userRole}</div></div>}
                            <div className="info-item">
                                <div className="info-label"><i className="fas fa-globe" style={{color: 'var(--myaccount-accent)'}}></i>Region</div>
                                <div className="info-value" style={{width: '100%'}}>
                                    <select className="region-select" value={preferences.selectedRegion?.code || ''} onChange={handleChangeRegion} disabled={!regionsLoaded} style={{width: '100%', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-secondary)', color: 'var(--text-primary)'}}>
                                        <option value="">Select a region</option>
                                        {permittedRegions.map(r => <option key={r.regionCode || r.region_code} value={r.regionCode || r.region_code}>{r.regionName || r.region_name || ''}</option>)}
                                    </select>
                                </div>
                            </div>
                            {plantCode && <div className="info-item"><div className="info-label"><i className="fas fa-building" style={{color: 'var(--myaccount-accent)'}}></i>Plant Code</div><div className="info-value">{plantCode}</div></div>}
                        </div>
                    </div>
                </div>
            </div>
            <div className="account-tab-content" style={{display: activeTab === 'security' ? 'block' : 'none'}}>
                <div className="account-section">
                    <div className="section-header">
                        <h2><i className="fas fa-shield-alt" style={{color: 'var(--myaccount-accent)'}}></i> Account Security</h2>
                        <p>Manage your password and protect your account</p>
                    </div>
                    <div className="security-actions-grid">
                        <div className="security-action-card">
                            <div className="action-card-content">
                                <div className="action-icon" style={{backgroundColor: 'var(--myaccount-accent)'}}><i className="fas fa-key"></i></div>
                                <h3>Password Management</h3>
                                <p>Change your password regularly to keep your account secure</p>
                                <button className="btn action-btn" onClick={() => setShowPasswordModal(true)} style={{backgroundColor: 'var(--myaccount-accent)'}}><i className="fas fa-lock"></i> Change Password</button>
                            </div>
                        </div>
                        <div className="security-action-card">
                            <div className="action-card-content">
                                <div className="action-icon" style={{backgroundColor: 'var(--myaccount-accent)'}}><i className="fas fa-laptop"></i></div>
                                <h3>Session Management</h3>
                                <p>Control your active sessions across devices</p>
                                <div className="active-session">
                                    <div className="session-icon"><i className="fas fa-desktop"></i></div>
                                    <div className="session-info">
                                        <div className="session-name">Current Browser</div>
                                        <div className="session-details"><span className="session-status">•</span> Active now</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="account-section">
                    <div className="section-header">
                        <h2><i className="fas fa-cogs" style={{color: 'var(--myaccount-accent)'}}></i> Account Actions</h2>
                        <p>Manage your account settings and sessions</p>
                    </div>
                    <div className="account-actions">
                        <div className="myaccount-logout-container">
                            <button className="myaccount-logout-button" onClick={handleSignOut}>
                                <div className="myaccount-logout-icon"><i className="fas fa-sign-out-alt"></i></div>
                                <div className="myaccount-logout-content"><span className="myaccount-logout-title">Sign Out</span></div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {showPasswordModal && (
                <div className="modal-overlay" onClick={() => !loading && setShowPasswordModal(false)} style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{margin: '0 auto'}}>
                        <div className="modal-header">
                            <h3><i className="fas fa-key" style={{color: 'var(--myaccount-accent)'}}></i> Change Password</h3>
                            <button className="modal-close" onClick={() => !loading && setShowPasswordModal(false)} disabled={loading} aria-label="Close modal"><i className="fas fa-times"></i></button>
                        </div>
                        {passwordError && (
                            <div className="message error" style={{margin: '1rem 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--error-bg)', borderRadius: '8px', color: 'var(--danger)'}}>
                                <i className="fas fa-exclamation-circle"></i>
                                <p style={{margin: 0}}>{passwordError}</p>
                            </div>
                        )}
                        <form onSubmit={updatePassword} className="password-form">
                            <div className="form-group">
                                <label htmlFor="current_password">Current Password</label>
                                <div className="input-with-icon">
                                    <i className="fas fa-lock" style={{color: 'var(--myaccount-accent)', marginRight: '8px'}}></i>
                                    <input type="password" id="current_password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter your current password" required style={{paddingLeft: '45px'}}/>
                                </div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="new_password">New Password</label>
                                <div className="input-with-icon">
                                    <i className="fas fa-lock" style={{color: 'var(--myaccount-accent)', marginRight: '8px'}}></i>
                                    <input type="password" id="new_password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" required style={{paddingLeft: '45px'}}/>
                                </div>
                                <small>Password must be at least 8 characters</small>
                            </div>
                            <div className="form-group">
                                <label htmlFor="confirm_password">Confirm New Password</label>
                                <div className="input-with-icon">
                                    <i className="fas fa-lock" style={{color: 'var(--myaccount-accent)', marginRight: '8px'}}></i>
                                    <input type="password" id="confirm_password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" required style={{paddingLeft: '45px'}}/>
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn secondary" onClick={() => setShowPasswordModal(false)} disabled={loading}>Cancel</button>
                                <button type="submit" className="btn primary" disabled={loading || !currentPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 8} style={{backgroundColor: 'var(--myaccount-accent)'}}><i className="fas fa-check"></i> Update Password</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default MyAccountView
