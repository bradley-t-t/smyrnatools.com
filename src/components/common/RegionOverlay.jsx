import React, {useEffect, useMemo, useState} from 'react'
import {usePreferences} from '../../app/context/PreferencesContext'
import {UserService} from '../../services/UserService'
import {RegionService} from '../../services/RegionService'
import './styles/RegionOverlay.css'

function RegionOverlay() {
    const {preferences, setSelectedRegion, setRegionOverlayMinimized} = usePreferences()
    const [userId, setUserId] = useState(sessionStorage.getItem('userId') || '')
    const [canSelectRegion, setCanSelectRegion] = useState(false)
    const [allRegions, setAllRegions] = useState([])
    const [loading, setLoading] = useState(true)

    const currentRegionCode = preferences.selectedRegion?.code || ''
    const currentRegionName = preferences.selectedRegion?.name || ''
    const isMinimized = !!preferences.regionOverlayMinimized

    const currentRegionDisplay = useMemo(() => {
        if (!currentRegionCode && !currentRegionName) return 'Select Region'
        if (currentRegionCode && currentRegionName) return `${currentRegionCode} • ${currentRegionName}`
        return currentRegionName || currentRegionCode
    }, [currentRegionCode, currentRegionName])

    useEffect(() => {
        let mounted = true

        async function init() {
            try {
                let uid = userId
                if (!uid) {
                    const user = await UserService.getCurrentUser()
                    uid = user?.id || ''
                    if (uid) setUserId(uid)
                }
                if (!uid) {
                    setLoading(false)
                    return
                }
                const hasPerm = await UserService.hasPermission(uid, 'region.select')
                if (mounted) setCanSelectRegion(!!hasPerm)
                const plantCode = await UserService.getUserPlant(uid)
                let defaultRegion = {code: '', name: ''}
                if (plantCode) {
                    try {
                        const regions = await RegionService.fetchRegionsByPlantCode(plantCode)
                        if (Array.isArray(regions) && regions.length > 0) {
                            const r = regions[0]
                            defaultRegion = {
                                code: r.regionCode || r.region_code || '',
                                name: r.regionName || r.region_name || ''
                            }
                        }
                    } catch {
                    }
                }
                if (!preferences.selectedRegion?.code && defaultRegion.code) {
                    setSelectedRegion(defaultRegion.code, defaultRegion.name)
                }
                try {
                    const regions = await RegionService.fetchRegions()
                    if (mounted) setAllRegions(regions)
                } catch {
                }
            } finally {
                if (mounted) setLoading(false)
            }
        }

        init()
        return () => {
            mounted = false
        }
    }, [])

    const handleChangeRegion = e => {
        const code = e.target.value
        if (!code) {
            setSelectedRegion('', '')
            return
        }
        const r = allRegions.find(x => (x.region_code || x.regionCode) === code)
        const name = r ? (r.region_name || r.regionName || '') : ''
        setSelectedRegion(code, name)
    }

    const toggleMinimize = () => setRegionOverlayMinimized(!isMinimized)

    if (!userId || loading) return null

    return (
        <div className={`region-overlay ${isMinimized ? 'minimized' : ''}`}>
            {isMinimized ? (
                <div className="region-minimized-pill" onClick={toggleMinimize} title={currentRegionDisplay}>
                    <i className="fas fa-globe"/>
                    <span className="region-label">{currentRegionName || currentRegionCode || 'Region'}</span>
                </div>
            ) : (
                <div className="region-panel">
                    <div className="region-header">
                        <div className="header-title">
                            <i className="fas fa-globe"/>
                            <span>Region</span>
                        </div>
                        <div className="header-actions">
                            <button className="action-button circle" onClick={toggleMinimize} title="Minimize">
                                <i className="fas fa-xmark"/>
                            </button>
                        </div>
                    </div>
                    <div className="region-body">
                        <select className="ios-select region-select" value={currentRegionCode}
                                onChange={handleChangeRegion} disabled={!canSelectRegion}>
                            <option value="">Select a region</option>
                            {allRegions.map(r => {
                                const code = r.region_code || r.regionCode
                                const name = r.region_name || r.regionName || ''
                                return (
                                    <option key={code} value={code}>{code} • {name}</option>
                                )
                            })}
                        </select>
                        {!canSelectRegion && (
                            <div className="region-note">Locked to your plant region</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default RegionOverlay
