import React, {useEffect, useMemo, useState} from 'react'
import {ReportService} from '../../../services/ReportService'
import '../styles/ReportTypes.css'

function getRows(form) {
    return Array.isArray(form.rows) ? form.rows : []
}

function getOperatorName(row, operatorOptions) {
    if (!row || !row.name) return ''
    if (Array.isArray(operatorOptions)) {
        const found = operatorOptions.find(opt => opt.value === row.name)
        if (found) return found.label
    }
    if (row.displayName) return row.displayName
    return row.name
}

function StatsBar({insights}) {
    const items = [
        {label: 'Total Loads', value: insights.totalLoads},
        {label: 'Total Hours', value: insights.totalHours !== null ? insights.totalHours.toFixed(2) : '--'},
        {label: 'Avg Loads', value: insights.avgLoads !== null ? insights.avgLoads.toFixed(2) : '--'},
        {label: 'Avg Hours', value: insights.avgHours !== null ? insights.avgHours.toFixed(2) : '--'},
        {
            label: 'Avg Loads/Hour',
            value: insights.avgLoadsPerHour !== null ? insights.avgLoadsPerHour.toFixed(2) : '--'
        },
        {
            label: 'Avg Punch In -> 1st Load',
            value: insights.avgElapsedStart !== null ? `${insights.avgElapsedStart.toFixed(1)} min` : '--'
        },
        {
            label: 'Avg Washout -> Punch Out',
            value: insights.avgElapsedEnd !== null ? `${insights.avgElapsedEnd.toFixed(1)} min` : '--'
        }
    ]
    return (
        <div className="rpt-stats">
            {items.map((it, i) => (
                <div key={i} className="rpt-stat-card">
                    <div className="rpt-stat-label">{it.label}</div>
                    <div className="rpt-stat-value">{it.value}</div>
                </div>
            ))}
        </div>
    )
}

function WarningsBar({messages}) {
    if (!messages || messages.length === 0) return null
    return (
        <div className="rpt-warnings">
            {messages.map((msg, i) => (
                <div key={i} className="rpt-warning-chip">
                    <span className="rpt-warning-icon">⚠</span>
                    <span>{msg}</span>
                </div>
            ))}
        </div>
    )
}

function Toolbar({filterText, setFilterText, sortKey, sortDir, setSort, onExpandAll, onCollapseAll}) {
    function toggleSort(key) {
        if (sortKey === key) {
            setSort(key, sortDir === 'asc' ? 'desc' : 'asc')
        } else {
            setSort(key, 'asc')
        }
    }

    return (
        <div className="rpt-toolbar">
            <input
                type="text"
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                placeholder="Filter operators or trucks..."
                className="rpt-filter-input"
            />
            <div className="rpt-toolbar-actions">
                <button type="button" onClick={onExpandAll} className="rpt-btn">Expand All</button>
                <button type="button" onClick={onCollapseAll} className="rpt-btn">Collapse All</button>
                <button type="button" onClick={() => toggleSort('operator')} className="rpt-btn">
                    Sort Name {sortKey === 'operator' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
                <button type="button" onClick={() => toggleSort('loads')} className="rpt-btn">
                    Sort Loads {sortKey === 'loads' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
                <button type="button" onClick={() => toggleSort('hours')} className="rpt-btn">
                    Sort Hours {sortKey === 'hours' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
                <button type="button" onClick={() => toggleSort('lph')} className="rpt-btn">
                    Sort L/H {sortKey === 'lph' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
            </div>
        </div>
    )
}

function DetailTable({rows, operatorOptions, sortKey, sortDir, filterText, expandAllSeq, collapseAllSeq}) {
    const [expanded, setExpanded] = useState(new Set())

    function minutes(timeStr) {
        return ReportService.parseTimeToMinutes(timeStr)
    }

    const processed = useMemo(() => {
        const lower = (filterText || '').toLowerCase().trim()
        const filtered = rows.filter(r => {
            if (!lower) return true
            const name = getOperatorName(r, operatorOptions).toLowerCase()
            const truck = String(r.truck_number || '').toLowerCase()
            return name.includes(lower) || truck.includes(lower)
        })
        const withCalcs = filtered.map((r, idx) => {
            const start = minutes(r.start_time)
            const first = minutes(r.first_load)
            const eod = minutes(r.eod_in_yard)
            const punch = minutes(r.punch_out)
            const dStart = start !== null && first !== null ? first - start : null
            const dEnd = eod !== null && punch !== null ? punch - eod : null
            const hours = start !== null && punch !== null ? (punch - start) / 60 : null
            const lph = r.loads && hours && hours > 0 ? (r.loads / hours) : null
            const key = r.name || `idx:${idx}`
            return {r, start, first, eod, punch, dStart, dEnd, hours, lph, key}
        })
        const dir = sortDir === 'desc' ? -1 : 1

        function cmp(a, b) {
            const A = a.r
            const B = b.r
            if (sortKey === 'operator') return getOperatorName(A, operatorOptions).localeCompare(getOperatorName(B, operatorOptions)) * dir
            if (sortKey === 'loads') return ((Number(A.loads) || 0) - (Number(B.loads) || 0)) * dir
            if (sortKey === 'hours' ) return (((a.hours ?? -Infinity)) - ((b.hours ?? -Infinity))) * dir
            if (sortKey === 'lph'  ) return (((a.lph ?? -Infinity)) - ((b.lph ?? -Infinity))) * dir
            if (sortKey === 'start') return (((a.start ?? -1)) - ((b.start ?? -1))) * dir
            return 0
        }

        return sortKey ? [...withCalcs].sort(cmp) : withCalcs
    }, [rows, operatorOptions, sortKey, sortDir, filterText])

    useEffect(() => {
        if (!expandAllSeq) return
        const keys = processed.map(p => p.key)
        setExpanded(new Set(keys))
    }, [expandAllSeq, processed])

    useEffect(() => {
        if (!collapseAllSeq) return
        setExpanded(new Set())
    }, [collapseAllSeq])

    function toggleExpand(key) {
        setExpanded(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const headers = ['Operator', 'Truck #', 'Punch In -> 1st Load', 'Washout -> Punch Out', 'L/H', '']

    return (
        <div className="rpt-table-wrapper">
            <table className="rpt-table">
                <colgroup>
                    <col className="rpt-col-operator"/>
                    <col className="rpt-col-truck"/>
                    <col className="rpt-col-start"/>
                    <col className="rpt-col-end"/>
                    <col className="rpt-col-lph"/>
                    <col className="rpt-col-actions"/>
                </colgroup>
                <thead>
                <tr>
                    {headers.map((h, i) => (
                        <th key={i} className={`rpt-th ${i === 4 || i === 5 ? 'right' : ''}`}>{h}</th>
                    ))}
                </tr>
                </thead>
                <tbody>
                {processed.map(({r, dStart, dEnd, hours, lph, key}) => {
                    const warnStart = dStart !== null && dStart > 15
                    const warnEnd = dEnd !== null && dEnd > 20
                    const isOpen = expanded.has(key)
                    return (
                        <React.Fragment key={key}>
                            <tr className="rpt-row">
                                <td className="rpt-td emphasis" title={getOperatorName(r, operatorOptions)}>
                                    {getOperatorName(r, operatorOptions) || 'No Name'}
                                </td>
                                <td className="rpt-td secondary">{r.truck_number || '--'}</td>
                                <td className={`rpt-td ${warnStart ? 'warn' : ''}`}>{dStart !== null ? `${dStart} min` : '--'}</td>
                                <td className={`rpt-td ${warnEnd ? 'warn' : ''}`}>{dEnd !== null ? `${dEnd} min` : '--'}</td>
                                <td className="rpt-td right">{lph !== null && lph !== undefined && lph !== '' ? Number(lph).toFixed(2) : '--'}</td>
                                <td className="rpt-td right">
                                    <button
                                        type="button"
                                        aria-expanded={isOpen}
                                        onClick={() => toggleExpand(key)}
                                        title={isOpen ? 'Hide details' : 'Show details'}
                                        className="rpt-icon-btn"
                                    >
                                        {isOpen ? '▾' : '▸'}
                                    </button>
                                </td>
                            </tr>
                            {isOpen && (
                                <tr>
                                    <td colSpan={6} className="rpt-detail-row">
                                        <div className="rpt-detail-grid">
                                            <div>
                                                <div className="rpt-field-label">Start</div>
                                                <div className="rpt-field-value">{r.start_time || '--'}</div>
                                            </div>
                                            <div>
                                                <div className="rpt-field-label">1st Load</div>
                                                <div className="rpt-field-value">{r.first_load || '--'}</div>
                                            </div>
                                            <div>
                                                <div className="rpt-field-label">EOD In Yard</div>
                                                <div className="rpt-field-value">{r.eod_in_yard || '--'}</div>
                                            </div>
                                            <div>
                                                <div className="rpt-field-label">Punch Out</div>
                                                <div className="rpt-field-value">{r.punch_out || '--'}</div>
                                            </div>
                                            <div>
                                                <div className="rpt-field-label">Total Loads</div>
                                                <div
                                                    className={`rpt-field-value emphasis ${(r.loads !== undefined && r.loads !== '' && Number(r.loads) < 3) ? 'rpt-error-text' : ''}`}>{r.loads || '--'}</div>
                                            </div>
                                            <div>
                                                <div className="rpt-field-label">Total Hours</div>
                                                <div
                                                    className={`rpt-field-value emphasis ${(hours !== null && hours > 14) ? 'rpt-error-text' : ''}`}>{hours !== null ? hours.toFixed(2) : '--'}</div>
                                            </div>
                                            <div className="rpt-detail-grid-full">
                                                <div className="rpt-field-label">Comments</div>
                                                <div className="rpt-comment-text">{r.comments || ''}</div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    )
                })}
                </tbody>
            </table>
        </div>
    )
}

function EfficiencyPluginBody({form, operatorOptions}) {
    const [filterText, setFilterText] = useState('')
    const [sortKey, setSortKey] = useState('')
    const [sortDir, setSortDir] = useState('asc')
    const [expandAllSeq, setExpandAllSeq] = useState(0)
    const [collapseAllSeq, setCollapseAllSeq] = useState(0)
    const rows = getRows(form)
    const insights = ReportService.getPlantProductionInsights(rows)

    function setSort(k, d) {
        setSortKey(k)
        setSortDir(d)
    }

    if (!rows.length) return null
    return (
        <div className="rpt-mt-20">
            <WarningsBar messages={insights.avgWarnings}/>
            <Toolbar
                filterText={filterText}
                setFilterText={setFilterText}
                sortKey={sortKey}
                sortDir={sortDir}
                setSort={setSort}
                onExpandAll={() => setExpandAllSeq(s => s + 1)}
                onCollapseAll={() => setCollapseAllSeq(s => s + 1)}
            />
            <DetailTable
                rows={rows}
                operatorOptions={operatorOptions}
                sortKey={sortKey}
                sortDir={sortDir}
                filterText={filterText}
                expandAllSeq={expandAllSeq}
                collapseAllSeq={collapseAllSeq}
            />
            <StatsBar insights={insights}/>
        </div>
    )
}

export function EfficiencySubmitPlugin({form, operatorOptions}) {
    return <EfficiencyPluginBody form={form} operatorOptions={operatorOptions}/>
}

export function EfficiencyReviewPlugin({form, operatorOptions}) {
    return <EfficiencyPluginBody form={form} operatorOptions={operatorOptions}/>
}
