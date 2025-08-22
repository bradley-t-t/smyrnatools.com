import React, {useEffect, useMemo, useState} from 'react'
import {ReportService} from '../../../../services/ReportService'

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
        {label: 'Avg Loads/Hour', value: insights.avgLoadsPerHour !== null ? insights.avgLoadsPerHour.toFixed(2) : '--'},
        {label: 'Avg Punch In -> 1st Load', value: insights.avgElapsedStart !== null ? `${insights.avgElapsedStart.toFixed(1)} min` : '--'},
        {label: 'Avg Washout -> Punch Out', value: insights.avgElapsedEnd !== null ? `${insights.avgElapsedEnd.toFixed(1)} min` : '--'}
    ]
    return (
        <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            justifyContent: 'center',
            alignItems: 'stretch',
            margin: '12px 0'
        }}>
            {items.map((it, i) => (
                <div key={i} style={{
                    width: 160,
                    height: 90,
                    background: 'var(--background-elevated)',
                    border: '1px solid var(--divider)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 1px 3px var(--shadow-sm)',
                    textAlign: 'center'
                }}>
                    <div style={{fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)'}}>{it.label}</div>
                    <div style={{fontSize: 17, fontWeight: 700, color: 'var(--text-primary)'}}>{it.value}</div>
                </div>
            ))}
        </div>
    )
}

function WarningsBar({messages}) {
    if (!messages || messages.length === 0) return null
    return (
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 8}}>
            {messages.map((msg, i) => (
                <div key={i} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    border: '1px solid var(--error)',
                    color: 'var(--error)',
                    background: 'var(--error-bg)',
                    borderRadius: 999,
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 700
                }}>
                    <span style={{fontSize: 13}}>⚠</span>
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
    const sortButtonStyle = {
        background: 'var(--background-elevated)',
        border: '1px solid var(--divider)',
        color: 'var(--text-primary)',
        borderRadius: 6,
        padding: '6px 10px',
        fontWeight: 600,
        fontSize: 13,
        cursor: 'pointer'
    }
    return (
        <div style={{display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 10px 0'}}>
            <input
                type="text"
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                placeholder="Filter operators or trucks..."
                style={{
                    background: 'var(--background)',
                    border: '1.5px solid var(--divider)',
                    borderRadius: 8,
                    fontSize: 14,
                    width: '100%',
                    maxWidth: 340,
                    height: 36,
                    padding: '0 12px',
                    color: 'var(--text-primary)',
                    boxShadow: '0 1px 3px var(--shadow-xs)',
                    outline: 'none'
                }}
            />
            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                <button type="button" onClick={onExpandAll} style={sortButtonStyle}>Expand All</button>
                <button type="button" onClick={onCollapseAll} style={sortButtonStyle}>Collapse All</button>
                <button type="button" onClick={() => toggleSort('operator')} style={sortButtonStyle}>
                    Sort Name {sortKey === 'operator' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
                <button type="button" onClick={() => toggleSort('loads')} style={sortButtonStyle}>
                    Sort Loads {sortKey === 'loads' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
                <button type="button" onClick={() => toggleSort('hours')} style={sortButtonStyle}>
                    Sort Hours {sortKey === 'hours' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
                <button type="button" onClick={() => toggleSort('lph')} style={sortButtonStyle}>
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
            if (sortKey === 'hours') return (((a.hours ?? -Infinity)) - ((b.hours ?? -Infinity))) * dir
            if (sortKey === 'lph') return (((a.lph ?? -Infinity)) - ((b.lph ?? -Infinity))) * dir
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

    return (
        <div style={{
            overflowX: 'auto',
            border: '1px solid var(--divider)',
            borderRadius: 10,
            background: 'var(--background-elevated)',
            boxShadow: '0 1px 4px var(--shadow-sm)',
            maxHeight: '60vh',
            overflowY: 'auto'
        }}>
            <table style={{width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed'}}>
                <colgroup>
                    <col style={{width: 210}}/>
                    <col style={{width: 100}}/>
                    <col style={{width: 150}}/>
                    <col style={{width: 150}}/>
                    <col style={{width: 80}}/>
                    <col style={{width: 80}}/>
                </colgroup>
                <thead>
                <tr>
                    {['Operator','Truck #','Punch In -> 1st Load','Washout -> Punch Out','L/H','']
                        .map((h, i) => (
                            <th key={i} style={{
                                position: 'sticky',
                                top: 0,
                                zIndex: 1,
                                textAlign: (i === 4 || i === 5) ? 'right' : 'left',
                                padding: '8px 10px',
                                fontSize: 12,
                                fontWeight: 800,
                                color: 'var(--text-secondary)',
                                borderBottom: '1px solid var(--divider)',
                                background: 'var(--background)',
                                whiteSpace: 'nowrap'
                            }}>{h}</th>
                        ))}
                </tr>
                </thead>
                <tbody>
                {processed.map(({r, dStart, dEnd, hours, lph, key}) => {
                    const warnStart = dStart !== null && dStart > 15
                    const warnEnd = dEnd !== null && dEnd > 15
                    const isOpen = expanded.has(key)
                    return (
                        <React.Fragment key={key}>
                            <tr style={{borderBottom: '1px solid var(--divider)'}}>
                                <td style={{padding: '8px 10px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={getOperatorName(r, operatorOptions)}>{getOperatorName(r, operatorOptions) || 'No Name'}</td>
                                <td style={{padding: '8px 10px', fontSize: 14, color: 'var(--text-secondary)', whiteSpace: 'nowrap'}}>{r.truck_number || '--'}</td>
                                <td style={{padding: '8px 10px', fontSize: 14, color: warnStart ? 'var(--error)' : 'var(--text-primary)', whiteSpace: 'nowrap'}}>{dStart !== null ? `${dStart} min` : '--'}</td>
                                <td style={{padding: '8px 10px', fontSize: 14, color: warnEnd ? 'var(--error)' : 'var(--text-primary)', whiteSpace: 'nowrap'}}>{dEnd !== null ? `${dEnd} min` : '--'}</td>
                                <td style={{padding: '8px 10px', fontSize: 14, textAlign: 'right', whiteSpace: 'nowrap'}}>{lph !== null && lph !== undefined && lph !== '' ? Number(lph).toFixed(2) : '--'}</td>
                                <td style={{padding: '8px 10px', textAlign: 'right'}}>
                                    <button
                                        type="button"
                                        aria-expanded={isOpen}
                                        onClick={() => toggleExpand(key)}
                                        title={isOpen ? 'Hide details' : 'Show details'}
                                        style={{
                                            background: 'var(--background)',
                                            border: '1px solid var(--divider)',
                                            color: 'var(--text-primary)',
                                            borderRadius: 6,
                                            padding: '4px 8px',
                                            fontWeight: 700,
                                            fontSize: 13,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {isOpen ? '▾' : '▸'}
                                    </button>
                                </td>
                            </tr>
                            {isOpen && (
                                <tr>
                                    <td colSpan={6} style={{padding: 0, background: 'var(--background)'}}>
                                        <div style={{
                                            padding: '10px 10px 10px 10px',
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                            gap: 10,
                                            borderTop: '1px dashed var(--divider)'
                                        }}>
                                            <div style={{display: 'flex', flexDirection: 'column'}}>
                                                <div style={{fontSize: 12, color: 'var(--text-secondary)'}}>Start</div>
                                                <div style={{fontSize: 14, fontWeight: 600}}>{r.start_time || '--'}</div>
                                            </div>
                                            <div style={{display: 'flex', flexDirection: 'column'}}>
                                                <div style={{fontSize: 12, color: 'var(--text-secondary)'}}>1st Load</div>
                                                <div style={{fontSize: 14, fontWeight: 600}}>{r.first_load || '--'}</div>
                                            </div>
                                            <div style={{display: 'flex', flexDirection: 'column'}}>
                                                <div style={{fontSize: 12, color: 'var(--text-secondary)'}}>EOD In Yard</div>
                                                <div style={{fontSize: 14, fontWeight: 600}}>{r.eod_in_yard || '--'}</div>
                                            </div>
                                            <div style={{display: 'flex', flexDirection: 'column'}}>
                                                <div style={{fontSize: 12, color: 'var(--text-secondary)'}}>Punch Out</div>
                                                <div style={{fontSize: 14, fontWeight: 600}}>{r.punch_out || '--'}</div>
                                            </div>
                                            <div style={{display: 'flex', flexDirection: 'column'}}>
                                                <div style={{fontSize: 12, color: 'var(--text-secondary)'}}>Total Loads</div>
                                                <div style={{fontSize: 14, fontWeight: 700, color: (r.loads !== undefined && r.loads !== '' && Number(r.loads) < 3) ? 'var(--error)' : 'var(--text-primary)'}}>{r.loads || '--'}</div>
                                            </div>
                                            <div style={{display: 'flex', flexDirection: 'column'}}>
                                                <div style={{fontSize: 12, color: 'var(--text-secondary)'}}>Total Hours</div>
                                                <div style={{fontSize: 14, fontWeight: 700, color: (hours !== null && hours > 14) ? 'var(--error)' : 'var(--text-primary)'}}>{hours !== null ? hours.toFixed(2) : '--'}</div>
                                            </div>
                                            <div style={{gridColumn: '1 / -1', display: 'flex', flexDirection: 'column'}}>
                                                <div style={{fontSize: 12, color: 'var(--text-secondary)'}}>Comments</div>
                                                <div style={{fontSize: 14, color: 'var(--text-secondary)'}}>{r.comments || ''}</div>
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
    function setSort(k, d) { setSortKey(k); setSortDir(d) }
    if (!rows.length) return null
    return (
        <div style={{marginTop: 20}}>
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
