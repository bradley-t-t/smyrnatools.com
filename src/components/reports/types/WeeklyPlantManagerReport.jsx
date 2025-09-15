import React from 'react'
import {usePreferences} from '../../../app/context/PreferencesContext';
import '../styles/ReportTypes.css'

export function PlantManagerSubmitPlugin({
                                             yph,
                                             yphGrade,
                                             yphLabel,
                                             lost,
                                             lostGrade,
                                             lostLabel,
                                             summaryTab,
                                             setSummaryTab
                                         }) {
    const {preferences} = usePreferences()
    const isDark = preferences.themeMode === 'dark'
    const formatYph = v => {
        const n = typeof v === 'number' ? v : (typeof v === 'string' ? Number(v) : NaN)
        return Number.isFinite(n) ? n.toFixed(2) : '--'
    }
    return (
        <div className="rpts-summary-tabs-container">
            <div className="rpts-summary-tabs">
                <button
                    type="button"
                    className={summaryTab === 'summary' ? 'active' : ''}
                    onClick={() => setSummaryTab('summary')}
                >
                    Metrics
                </button>
            </div>
            {summaryTab === 'summary' && (
                <div className="rpts-summary-content rpt-summary-row">
                    <div className="rpts-summary-metric-card rpt-metric-card">
                        <div className="rpts-summary-metric-title">Yards per Man-Hour</div>
                        <div
                            className={`rpts-summary-metric-value ${isDark ? 'rpt-metric-text-light' : 'rpt-metric-text-primary'}`}>
                            {formatYph(yph)}
                        </div>
                        <div
                            className={`rpts-summary-metric-grade ${isDark ? 'rpt-metric-text-light' : 'rpt-metric-text-primary'}`}>
                            {yphLabel}
                        </div>
                        <div className="rpts-summary-metric-scale">
                            <span className={yphGrade === 'excellent' ? 'active' : ''}>Excellent</span>
                            <span className={yphGrade === 'good' ? 'active' : ''}>Good</span>
                            <span className={yphGrade === 'average' ? 'active' : ''}>Average</span>
                            <span className={yphGrade === 'poor' ? 'active' : ''}>Poor</span>
                        </div>
                    </div>
                    <div className="rpts-summary-metric-card rpt-metric-card">
                        <div className="rpts-summary-metric-title">Yardage Lost</div>
                        <div
                            className={`rpts-summary-metric-value ${isDark ? 'rpt-metric-text-light' : 'rpt-metric-text-primary'}`}>
                            {lost !== null ? lost : '--'}
                        </div>
                        <div
                            className={`rpts-summary-metric-grade ${isDark ? 'rpt-metric-text-light' : 'rpt-metric-text-primary'}`}>
                            {lostLabel}
                        </div>
                        <div className="rpts-summary-metric-scale">
                            <span className={lostGrade === 'excellent' ? 'active' : ''}>Excellent</span>
                            <span className={lostGrade === 'good' ? 'active' : ''}>Good</span>
                            <span className={lostGrade === 'average' ? 'active' : ''}>Average</span>
                            <span className={lostGrade === 'poor' ? 'active' : ''}>Poor</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export function PlantManagerReviewPlugin({
                                             yph,
                                             yphGrade,
                                             yphLabel,
                                             lost,
                                             lostGrade,
                                             lostLabel,
                                             summaryTab,
                                             setSummaryTab
                                         }) {
    const {preferences} = usePreferences()
    const isDark = preferences.themeMode === 'dark'
    const formatYph = v => {
        const n = typeof v === 'number' ? v : (typeof v === 'string' ? Number(v) : NaN)
        return Number.isFinite(n) ? n.toFixed(2) : '--'
    }
    return (
        <div className="rpts-summary-tabs-container">
            <div className="rpts-summary-tabs">
                <button
                    type="button"
                    className={summaryTab === 'summary' ? 'active' : ''}
                    onClick={() => setSummaryTab('summary')}
                >
                    Metrics
                </button>
            </div>
            {summaryTab === 'summary' && (
                <div className="rpts-summary-content rpt-summary-row">
                    <div className="rpts-summary-metric-card rpt-metric-card">
                        <div className="rpts-summary-metric-title">Yards per Man-Hour</div>
                        <div
                            className={`rpts-summary-metric-value ${isDark ? 'rpt-metric-text-light' : 'rpt-metric-text-primary'}`}>
                            {formatYph(yph)}
                        </div>
                        <div
                            className={`rpts-summary-metric-grade ${isDark ? 'rpt-metric-text-light' : 'rpt-metric-text-primary'}`}>
                            {yphLabel}
                        </div>
                        <div className="rpts-summary-metric-scale">
                            <span className={yphGrade === 'excellent' ? 'active' : ''}>Excellent</span>
                            <span className={yphGrade === 'good' ? 'active' : ''}>Good</span>
                            <span className={yphGrade === 'average' ? 'active' : ''}>Average</span>
                            <span className={yphGrade === 'poor' ? 'active' : ''}>Poor</span>
                        </div>
                    </div>
                    <div className="rpts-summary-metric-card rpt-metric-card">
                        <div className="rpts-summary-metric-title">Yardage Lost</div>
                        <div
                            className={`rpts-summary-metric-value ${isDark ? 'rpt-metric-text-light' : 'rpt-metric-text-primary'}`}>
                            {lost !== null ? lost : '--'}
                        </div>
                        <div
                            className={`rpts-summary-metric-grade ${isDark ? 'rpt-metric-text-light' : 'rpt-metric-text-primary'}`}>
                            {lostLabel}
                        </div>
                        <div className="rpts-summary-metric-scale">
                            <span className={lostGrade === 'excellent' ? 'active' : ''}>Excellent</span>
                            <span className={lostGrade === 'good' ? 'active' : ''}>Good</span>
                            <span className={lostGrade === 'average' ? 'active' : ''}>Average</span>
                            <span className={lostGrade === 'poor' ? 'active' : ''}>Poor</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
