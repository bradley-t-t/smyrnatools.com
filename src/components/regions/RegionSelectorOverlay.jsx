import React, {useEffect, useMemo, useState} from 'react'
import {usePreferences} from '../../app/context/PreferencesContext'
import {UserService} from '../../services/UserService'
import {RegionService} from '../../services/RegionService'
import './styles/RegionSelectorOverlay.css'

function RegionSelectorOverlay() {
    const {preferences, updatePreferences} = usePreferences()
    const [userId, setUserId] = useState(sessionStorage.getItem('userId') || '')
    const [canSelectRegion, setCanSelectRegion] = useState(false)
    const [allRegions, setAllRegions] = useState([])
    const [regionLoading, setRegionLoading] = useState(true)
    const [isMinimized, setIsMinimized] = useState(true)

    const currentRegionName = preferences.selectedRegion?.name || ''
    const currentRegionDisplay = useMemo(() => {
        if (!currentRegionName) return 'Select Region'
        return currentRegionName
    }, [currentRegionName])

    useEffect(() => {
        let mounted = true
        async function initRegion() {
            try {
                let uid = userId
                if (!uid) {
                    try {
                        const user = await UserService.getCurrentUser()
                        uid = user?.id || ''
                        if (uid) setUserId(uid)
                    } catch {}
                }
                if (!uid) {
                    setRegionLoading(false)
                    return
                }
                try {
                    const hasPerm = await UserService.hasPermission(uid, 'region.select')
                    if (mounted) setCanSelectRegion(!!hasPerm)
                } catch {}
                let defaultRegion = {code: '', name: '', type: ''}
                try {
                    const plantCode = await UserService.getUserPlant(uid)
                    if (plantCode) {
                        try {
                            const regionsByPlant = await RegionService.fetchRegionsByPlantCode(plantCode)
                            if (Array.isArray(regionsByPlant) && regionsByPlant.length > 0) {
                                const r = regionsByPlant[0]
                                defaultRegion = {
                                    code: r.regionCode || r.region_code || '',
                                    name: r.regionName || r.region_name || '',
                                    type: r.type || r.region_type || ''
                                }
                            }
                        } catch {}
                    }
                } catch {}
                if (!preferences.selectedRegion?.code && defaultRegion.code) {
                    updatePreferences('selectedRegion', {code: defaultRegion.code, name: defaultRegion.name, type: defaultRegion.type || ''})
                }
                try {
                    const regions = await RegionService.fetchRegions()
                    if (mounted) setAllRegions(regions)
                } catch {}
            } finally {
                if (mounted) setRegionLoading(false)
            }
        }
        initRegion()
        return () => {
            mounted = false
        }
    }, [])

    const handleChangeRegion = e => {
        const code = e.target.value
        if (!code) {
            updatePreferences('selectedRegion', {code: '', name: '', type: ''})
            return
        }
        const r = allRegions.find(x => (x.region_code || x.regionCode) === code)
        const name = r ? (r.region_name || r.regionName || '') : ''
        const type = r ? (r.type || r.region_type || '') : ''
        updatePreferences('selectedRegion', {code, name, type})
    }

    if (!canSelectRegion || regionLoading) return null

    return (
        <div className={`region-selector-overlay${isMinimized ? ' minimized' : ''}`}>
            {isMinimized ? (
                <div className="region-minimized-compact" onClick={() => setIsMinimized(false)} title={currentRegionDisplay}>
                    <span className="region-icon"><i className="fas fa-globe"></i></span>
                    <span className="region-label">{currentRegionDisplay}</span>
                    <button className="action-button icon-only" tabIndex={-1}>
                        <i className="fas fa-chevron-down"></i>
                    </button>
                </div>
            ) : (
                <div className="region-expanded">
                    <div className="region-header">
                        <span className="region-icon"><i className="fas fa-globe"></i></span>
                        <span className="region-title">Region</span>
                        <button className="action-button icon-only" onClick={() => setIsMinimized(true)} tabIndex={-1}>
                            <i className="fas fa-xmark"></i>
                        </button>
                    </div>
                    <select className="region-select" value={preferences.selectedRegion?.code || ''} onChange={handleChangeRegion}>
                        <option value="">Select a region</option>
                        {allRegions.map(r => (
                            <option key={r.region_code || r.regionCode} value={r.region_code || r.regionCode}>
                                {r.region_name || r.regionName || ''}
                            </option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    )
}

export default RegionSelectorOverlay
