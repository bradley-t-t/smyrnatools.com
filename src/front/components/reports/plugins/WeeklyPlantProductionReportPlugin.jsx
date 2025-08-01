import React from 'react'

function parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null
    const [h, m] = timeStr.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return null
    return h * 60 + m
}

function getRows(form) {
    return Array.isArray(form.rows) ? form.rows : []
}

function isExcludedRow(row) {
    if (!row) return true
    const keys = Object.keys(row).filter(k => k !== 'name' && k !== 'truck_number')
    return keys.every(k => row[k] === '' || row[k] === undefined || row[k] === null || row[k] === 0)
}

function getInsights(rows) {
    let totalLoads = 0
    let totalHours = 0
    let totalElapsedStart = 0
    let totalElapsedEnd = 0
    let countElapsedStart = 0
    let countElapsedEnd = 0
    let warnings = []
    let loadsPerHourSum = 0
    let loadsPerHourCount = 0

    const includedRows = rows.filter(row => !isExcludedRow(row))

    includedRows.forEach((row, idx) => {
        const start = parseTimeToMinutes(row.start_time)
        const firstLoad = parseTimeToMinutes(row.first_load)
        const punchOut = parseTimeToMinutes(row.punch_out)
        const eod = parseTimeToMinutes(row.eod_in_yard)
        const loads = Number(row.loads)

        let hours = null
        if (start !== null && punchOut !== null) {
            hours = (punchOut - start) / 60
            if (hours > 0) totalHours += hours
        }

        if (!isNaN(loads)) totalLoads += loads

        if (start !== null && firstLoad !== null) {
            const elapsed = firstLoad - start
            if (!isNaN(elapsed)) {
                totalElapsedStart += elapsed
                countElapsedStart++
                if (elapsed > 15) {
                    warnings.push({
                        row: rows.indexOf(row),
                        message: `Start to 1st Load is ${elapsed} min (> 15 min)`
                    })
                }
            }
        }

        if (eod !== null && punchOut !== null) {
            const elapsed = punchOut - eod
            if (!isNaN(elapsed)) {
                totalElapsedEnd += elapsed
                countElapsedEnd++
                if (elapsed > 15) {
                    warnings.push({
                        row: rows.indexOf(row),
                        message: `EOD to Punch Out is ${elapsed} min (> 15 min)`
                    })
                }
            }
        }

        if (!isNaN(loads) && hours && hours > 0) {
            loadsPerHourSum += loads / hours
            loadsPerHourCount++
        }

        if (!isNaN(loads) && loads < 3) {
            warnings.push({
                row: rows.indexOf(row),
                message: `Total Loads is ${loads} (< 3)`
            })
        }

        if (hours !== null && hours > 14) {
            warnings.push({
                row: rows.indexOf(row),
                message: `Total Hours is ${hours.toFixed(2)} (> 14 hours)`
            })
        }
    })

    const avgElapsedStart = countElapsedStart ? totalElapsedStart / countElapsedStart : null
    const avgElapsedEnd = countElapsedEnd ? totalElapsedEnd / countElapsedEnd : null
    const avgLoads = includedRows.length ? totalLoads / includedRows.length : null
    const avgHours = includedRows.length ? totalHours / includedRows.length : null
    const avgLoadsPerHour = loadsPerHourCount ? loadsPerHourSum / loadsPerHourCount : null

    let avgWarnings = []
    if (avgElapsedStart !== null && avgElapsedStart > 15) {
        avgWarnings.push(`Avg Start to 1st Load is ${avgElapsedStart.toFixed(1)} min (> 15 min)`)
    }
    if (avgElapsedEnd !== null && avgElapsedEnd > 15) {
        avgWarnings.push(`Avg EOD to Punch Out is ${avgElapsedEnd.toFixed(1)} min (> 15 min)`)
    }
    if (avgLoads !== null && avgLoads < 3) {
        avgWarnings.push(`Avg Total Loads is ${avgLoads.toFixed(2)} (< 3)`)
    }
    if (avgHours !== null && avgHours > 14) {
        avgWarnings.push(`Avg Total Hours is ${avgHours.toFixed(2)} (> 14 hours)`)
    }

    return {
        totalLoads,
        totalHours,
        avgElapsedStart,
        avgElapsedEnd,
        avgLoads,
        avgHours,
        avgLoadsPerHour,
        warnings,
        avgWarnings
    }
}

function StatCard({ label, value, highlight }) {
    return (
        <div
            style={{
                flex: 1,
                minWidth: 120,
                background: 'var(--background-elevated)',
                borderRadius: 10,
                border: '1px solid var(--divider)',
                margin: 6,
                padding: '18px 0 12px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                fontWeight: 600,
                fontSize: 16,
                boxShadow: '0 1px 4px var(--shadow-sm)'
            }}
        >
            <div style={{ fontSize: 28, fontWeight: 700, color: highlight ? 'var(--accent)' : 'var(--text-primary)' }}>{value}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
        </div>
    )
}

function WarningCard({ message }) {
    return (
        <div
            style={{
                background: 'var(--warning-bg)',
                color: 'var(--warning)',
                border: '1px solid var(--warning)',
                borderRadius: 8,
                padding: '10px 16px',
                margin: '8px 0',
                fontWeight: 600,
                fontSize: 15,
                display: 'flex',
                alignItems: 'center',
                gap: 8
            }}
        >
            <span style={{ fontSize: 18, marginRight: 6 }}>⚠</span>
            <span>{message}</span>
        </div>
    )
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

function RowCard({ row, idx, elapsedStart, elapsedEnd, totalHours, warning, operatorOptions }) {
    let warnings = []
    if (elapsedStart !== null && elapsedStart > 15) {
        warnings.push(`Start to 1st Load is ${elapsedStart} min (> 15 min)`)
    }
    if (elapsedEnd !== null && elapsedEnd > 15) {
        warnings.push(`EOD to Punch Out is ${elapsedEnd} min (> 15 min)`)
    }
    if (totalHours !== null && totalHours > 14) {
        warnings.push(`Total Hours is ${totalHours.toFixed(2)} (> 14 hours)`)
    }
    if (warning && !warnings.includes(warning.message)) {
        warnings.push(warning.message)
    }
    return (
        <div
            style={{
                border: '1px solid var(--divider)',
                borderRadius: 10,
                marginBottom: 18,
                background: 'var(--background-elevated)',
                boxShadow: '0 1px 4px var(--shadow-sm)',
                padding: 0,
                overflow: 'hidden'
            }}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 18px',
                borderBottom: '1px solid var(--divider)',
                fontWeight: 600,
                fontSize: 17,
                background: 'var(--background)'
            }}>
                <span style={{ flex: 1 }}>{getOperatorName(row, operatorOptions) || <span style={{ color: 'var(--text-secondary)' }}>No Name</span>}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 15 }}>{row.truck_number ? row.truck_number : ''}</span>
            </div>
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0,
                padding: '0 0 0 0',
                fontSize: 15
            }}>
                <StatCard label="Start Time" value={row.start_time || '--'} />
                <StatCard label="1st Load" value={row.first_load || '--'} />
                <StatCard label="Elapsed (Start→1st)" value={elapsedStart !== null ? `${elapsedStart} min` : '--'} highlight={elapsedStart > 15} />
                <StatCard label="EOD In Yard" value={row.eod_in_yard || '--'} />
                <StatCard label="Punch Out" value={row.punch_out || '--'} />
                <StatCard label="Elapsed (EOD→Punch)" value={elapsedEnd !== null ? `${elapsedEnd} min` : '--'} highlight={elapsedEnd > 15} />
                <StatCard label="Total Loads" value={row.loads || '--'} highlight={row.loads !== undefined && row.loads !== '' && Number(row.loads) < 3} />
                <StatCard label="Total Hours" value={totalHours !== null ? totalHours.toFixed(2) : '--'} highlight={totalHours !== null && totalHours > 14} />
                <StatCard label="Loads/Hour" value={(row.loads && totalHours && totalHours > 0) ? (row.loads / totalHours).toFixed(2) : '--'} />
            </div>
            {row.comments && (
                <div style={{
                    padding: '8px 18px 14px 18px',
                    color: 'var(--text-secondary)',
                    fontSize: 15
                }}>
                    <span style={{ fontWeight: 500 }}>Comments:</span> {row.comments}
                </div>
            )}
            {warnings.map((msg, i) => (
                <WarningCard key={i} message={msg} />
            ))}
        </div>
    )
}

function CardAverages({ insights }) {
    return (
        <div>
            {insights.avgWarnings && insights.avgWarnings.length > 0 && (
                <div>
                    {insights.avgWarnings.map((msg, i) => (
                        <WarningCard key={i} message={msg} />
                    ))}
                </div>
            )}
            <div
                style={{
                    marginTop: 18,
                    marginBottom: 24,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0,
                    justifyContent: 'center'
                }}
            >
                <StatCard label="Total Loads" value={insights.totalLoads} />
                <StatCard label="Total Hours" value={insights.totalHours !== null ? insights.totalHours.toFixed(2) : '--'} />
                <StatCard label="Avg Loads" value={insights.avgLoads !== null ? insights.avgLoads.toFixed(2) : '--'} />
                <StatCard label="Avg Hours" value={insights.avgHours !== null ? insights.avgHours.toFixed(2) : '--'} />
                <StatCard label="Avg Loads/Hour" value={insights.avgLoadsPerHour !== null ? insights.avgLoadsPerHour.toFixed(2) : '--'} />
                <StatCard label="Avg Elapsed (Start→1st)" value={insights.avgElapsedStart !== null ? `${insights.avgElapsedStart.toFixed(1)} min` : '--'} />
                <StatCard label="Avg Elapsed (EOD→Punch)" value={insights.avgElapsedEnd !== null ? `${insights.avgElapsedEnd.toFixed(1)} min` : '--'} />
            </div>
        </div>
    )
}

export function PlantProductionSubmitPlugin({ form, operatorOptions }) {
    const rows = getRows(form)
    const insights = getInsights(rows)
    if (!rows.length) return null
    return (
        <div style={{ marginTop: 32 }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
                Weekly Plant Production
            </div>
            <CardAverages insights={insights} />
            <div>
                {rows.map((row, i) => {
                    const start = parseTimeToMinutes(row.start_time)
                    const punch = parseTimeToMinutes(row.punch_out)
                    const firstLoad = parseTimeToMinutes(row.first_load)
                    const eod = parseTimeToMinutes(row.eod_in_yard)
                    const elapsedStart = (start !== null && firstLoad !== null) ? firstLoad - start : null
                    const elapsedEnd = (eod !== null && punch !== null) ? punch - eod : null
                    const totalHours = (start !== null && punch !== null) ? (punch - start) / 60 : null
                    const warning = insights.warnings.find(w => w.row === i)
                    return (
                        <RowCard
                            row={row}
                            idx={i}
                            elapsedStart={elapsedStart}
                            elapsedEnd={elapsedEnd}
                            totalHours={totalHours}
                            warning={warning}
                            key={i}
                            operatorOptions={operatorOptions}
                        />
                    )
                })}
            </div>
        </div>
    )
}

export function PlantProductionReviewPlugin({ form, operatorOptions }) {
    return <PlantProductionSubmitPlugin form={form} operatorOptions={operatorOptions} />
}
