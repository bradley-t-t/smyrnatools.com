import React from 'react'
import {usePreferences} from '../../../../app/context/PreferencesContext';

export function PlantManagerSubmitPlugin({ form, yph, yphGrade, yphLabel, lost, lostGrade, lostLabel, summaryTab, setSummaryTab }) {
    const { preferences } = usePreferences()
    const isDark = preferences.themeMode === 'dark'
    const metricTextColor = isDark ? 'var(--text-light)' : 'var(--primary)'
    return (
        <div className="summary-tabs-container">
            <div className="summary-tabs">
                <button
                    type="button"
                    className={summaryTab === 'summary' ? 'active' : ''}
                    onClick={() => setSummaryTab('summary')}
                >
                    Metrics
                </button>
            </div>
            {summaryTab === 'summary' && (
                <div className="summary-content" style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, alignItems: 'stretch' }}>
                    <div className="summary-metric-card" style={{ borderColor: 'var(--divider)', flex: 1, marginRight: 0 }}>
                        <div className="summary-metric-title">Yards per Man-Hour</div>
                        <div className="summary-metric-value" style={{ color: metricTextColor }}>
                            {yph !== null ? yph.toFixed(2) : '--'}
                        </div>
                        <div className="summary-metric-grade" style={{ color: metricTextColor }}>
                            {yphLabel}
                        </div>
                        <div className="summary-metric-scale">
                            <span className={yphGrade === 'excellent' ? 'active' : ''}>Excellent</span>
                            <span className={yphGrade === 'good' ? 'active' : ''}>Good</span>
                            <span className={yphGrade === 'average' ? 'active' : ''}>Average</span>
                            <span className={yphGrade === 'poor' ? 'active' : ''}>Poor</span>
                        </div>
                    </div>
                    <div className="summary-metric-card" style={{ borderColor: 'var(--divider)', flex: 1, marginLeft: 0 }}>
                        <div className="summary-metric-title">Yardage Lost</div>
                        <div className="summary-metric-value" style={{ color: metricTextColor }}>
                            {lost !== null ? lost : '--'}
                        </div>
                        <div className="summary-metric-grade" style={{ color: metricTextColor }}>
                            {lostLabel}
                        </div>
                        <div className="summary-metric-scale">
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

export function PlantManagerReviewPlugin({ form, yph, yphGrade, yphLabel, lost, lostGrade, lostLabel, summaryTab, setSummaryTab }) {
    const { preferences } = usePreferences()
    const isDark = preferences.themeMode === 'dark'
    const metricTextColor = isDark ? 'var(--text-light)' : 'var(--primary)'
    return (
        <div className="summary-tabs-container">
            <div className="summary-tabs">
                <button
                    type="button"
                    className={summaryTab === 'summary' ? 'active' : ''}
                    onClick={() => setSummaryTab('summary')}
                >
                    Metrics
                </button>
            </div>
            {summaryTab === 'summary' && (
                <div className="summary-content" style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, alignItems: 'stretch' }}>
                    <div className="summary-metric-card" style={{ borderColor: 'var(--divider)', flex: 1, marginRight: 0 }}>
                        <div className="summary-metric-title">Yards per Man-Hour</div>
                        <div className="summary-metric-value" style={{ color: metricTextColor }}>
                            {yph !== null ? yph.toFixed(2) : '--'}
                        </div>
                        <div className="summary-metric-grade" style={{ color: metricTextColor }}>
                            {yphLabel}
                        </div>
                        <div className="summary-metric-scale">
                            <span className={yphGrade === 'excellent' ? 'active' : ''}>Excellent</span>
                            <span className={yphGrade === 'good' ? 'active' : ''}>Good</span>
                            <span className={yphGrade === 'average' ? 'active' : ''}>Average</span>
                            <span className={yphGrade === 'poor' ? 'active' : ''}>Poor</span>
                        </div>
                    </div>
                    <div className="summary-metric-card" style={{ borderColor: 'var(--divider)', flex: 1, marginLeft: 0 }}>
                        <div className="summary-metric-title">Yardage Lost</div>
                        <div className="summary-metric-value" style={{ color: metricTextColor }}>
                            {lost !== null ? lost : '--'}
                        </div>
                        <div className="summary-metric-grade" style={{ color: metricTextColor }}>
                            {lostLabel}
                        </div>
                        <div className="summary-metric-scale">
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
