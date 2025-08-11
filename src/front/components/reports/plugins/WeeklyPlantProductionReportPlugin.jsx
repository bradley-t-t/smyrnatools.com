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

function RowCard({ row, idx, operatorOptions }) {
    const start = parseTimeToMinutes(row.start_time)
    const punch = parseTimeToMinutes(row.punch_out)
    const firstLoad = parseTimeToMinutes(row.first_load)
    const eod = parseTimeToMinutes(row.eod_in_yard)
    const elapsedStart = (start !== null && firstLoad !== null) ? firstLoad - start : null
    const elapsedEnd = (eod !== null && punch !== null) ? punch - eod : null
    const totalHours = (start !== null && punch !== null) ? (punch - start) / 60 : null
    const loadsPerHour = (row.loads && totalHours && totalHours > 0) ? (row.loads / totalHours).toFixed(2) : ''
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                border: '1px solid var(--divider)',
                borderRadius: 10,
                background: 'var(--background-elevated)',
                marginBottom: 18,
                boxShadow: '0 1px 4px var(--shadow-sm)',
                padding: '0 0 0 0'
            }}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '14px 18px',
                borderBottom: '1px solid var(--divider)',
                background: 'var(--background)'
            }}>
                <div style={{ flex: 2, fontWeight: 700, fontSize: 17, color: 'var(--accent)' }}>
                    {getOperatorName(row, operatorOptions) || <span style={{ color: 'var(--text-secondary)' }}>No Name</span>}
                </div>
                <div style={{ flex: 1, fontWeight: 600, fontSize: 15, color: 'var(--text-secondary)' }}>
                    Truck #{row.truck_number || '--'}
                </div>
            </div>
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0,
                padding: '14px 18px'
            }}>
                <div style={{ flex: 1, minWidth: 160, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Start</div>
                    <div style={{ fontWeight: 600 }}>{row.start_time || '--'}</div>
                </div>
                <div style={{ flex: 1, minWidth: 160, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>1st Load</div>
                    <div style={{ fontWeight: 600 }}>{row.first_load || '--'}</div>
                </div>
                <div style={{ flex: 1, minWidth: 160, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Elapsed (Start→1st)</div>
                    <div style={{ fontWeight: 600, color: elapsedStart > 15 ? 'var(--warning)' : undefined }}>
                        {elapsedStart !== null ? `${elapsedStart} min` : '--'}
                    </div>
                </div>
                <div style={{ flex: 1, minWidth: 160, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>EOD In Yard</div>
                    <div style={{ fontWeight: 600 }}>{row.eod_in_yard || '--'}</div>
                </div>
                <div style={{ flex: 1, minWidth: 160, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Punch Out</div>
                    <div style={{ fontWeight: 600 }}>{row.punch_out || '--'}</div>
                </div>
                <div style={{ flex: 1, minWidth: 160, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Elapsed (EOD→Punch)</div>
                    <div style={{ fontWeight: 600, color: elapsedEnd > 15 ? 'var(--warning)' : undefined }}>
                        {elapsedEnd !== null ? `${elapsedEnd} min` : '--'}
                    </div>
                </div>
                <div style={{ flex: 1, minWidth: 120, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total Loads</div>
                    <div style={{ fontWeight: 600, color: row.loads !== undefined && row.loads !== '' && Number(row.loads) < 3 ? 'var(--warning)' : undefined }}>
                        {row.loads || '--'}
                    </div>
                </div>
                <div style={{ flex: 1, minWidth: 120, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total Hours</div>
                    <div style={{ fontWeight: 600, color: totalHours !== null && totalHours > 14 ? 'var(--warning)' : undefined }}>
                        {totalHours !== null ? totalHours.toFixed(2) : '--'}
                    </div>
                </div>
                <div style={{ flex: 1, minWidth: 120, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loads/Hour</div>
                    <div style={{ fontWeight: 600 }}>{loadsPerHour || '--'}</div>
                </div>
                <div style={{ flex: 2, minWidth: 180, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Comments</div>
                    <div style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{row.comments || ''}</div>
                </div>
            </div>
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

function exportRowsToCSV(rows, operatorOptions, reportDate) {
    if (!Array.isArray(rows) || rows.length === 0) return
    const dateStr = reportDate ? ` - ${reportDate}` : ''
    const title = `Plant Production Report${dateStr}`
    const headers = [
        title,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]
    const tableHeaders = [
        'Operator Name',
        'Truck Number',
        'Start Time',
        '1st Load',
        'Elapsed (Start→1st)',
        'EOD In Yard',
        'Punch Out',
        'Elapsed (EOD→Punch)',
        'Total Loads',
        'Total Hours',
        'Loads/Hour',
        'Comments'
    ]
    const csvRows = [headers, tableHeaders]
    rows.forEach(row => {
        const start = parseTimeToMinutes(row.start_time)
        const firstLoad = parseTimeToMinutes(row.first_load)
        const eod = parseTimeToMinutes(row.eod_in_yard)
        const punch = parseTimeToMinutes(row.punch_out)
        const elapsedStart = (start !== null && firstLoad !== null) ? firstLoad - start : ''
        const elapsedEnd = (eod !== null && punch !== null) ? punch - eod : ''
        const totalHours = (start !== null && punch !== null) ? ((punch - start) / 60) : ''
        const loadsPerHour = (row.loads && totalHours && totalHours > 0) ? (row.loads / totalHours).toFixed(2) : ''
        csvRows.push([
            getOperatorName(row, operatorOptions),
            row.truck_number || '',
            row.start_time || '',
            row.first_load || '',
            elapsedStart !== '' ? `${elapsedStart} min` : '',
            row.eod_in_yard || '',
            row.punch_out || '',
            elapsedEnd !== '' ? `${elapsedEnd} min` : '',
            row.loads || '',
            totalHours !== '' ? totalHours.toFixed(2) : '',
            loadsPerHour,
            row.comments || ''
        ])
    })
    const csvContent = csvRows.map(r =>
        r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
    ).join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const safeDate = reportDate ? reportDate.replace(/[^0-9\-]/g, '') : ''
    const a = document.createElement('a')
    a.href = url
    a.download = `Plant Production Report${safeDate ? ' - ' + safeDate : ''}.csv`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }, 0)
}

export function PlantProductionSubmitPlugin({ form, operatorOptions }) {
    const rows = getRows(form)
    const insights = getInsights(rows)
    const reportDate = form.report_date || ''
    const plantCode = form.plant || (Array.isArray(form.rows) && form.rows.length > 0 ? form.rows[0].plant_code : '')
    if (!rows.length) return null
    return (
        <div style={{ marginTop: 32 }}>
            <div style={{
                fontWeight: 700,
                fontSize: 22,
                marginBottom: 8,
                letterSpacing: 0.2,
                color: 'var(--accent)'
            }}>
                {`Plant Production Report${reportDate ? ` - ${reportDate}` : ''}${plantCode ? ` - ${plantCode}'s Report` : ''}`}
            </div>
            <CardAverages insights={insights} />
            <div>
                {rows.map((row, i) => (
                    <RowCard row={row} idx={i} key={i} operatorOptions={operatorOptions} />
                ))}
            </div>
        </div>
    )
}

export function PlantProductionReviewPlugin({ form, operatorOptions }) {
    const rows = getRows(form)
    const insights = getInsights(rows)
    const reportDate = form.report_date || ''
    const plantCode = form.plant || (Array.isArray(form.rows) && form.rows.length > 0 ? form.rows[0].plant_code : '')
    if (!rows.length) return null
    return (
        <div style={{ marginTop: 32 }}>
            <div style={{
                fontWeight: 700,
                fontSize: 22,
                marginBottom: 8,
                letterSpacing: 0.2,
                color: 'var(--accent)'
            }}>
                {`Plant Production Report${reportDate ? ` - ${reportDate}` : ''}${plantCode ? ` - ${plantCode}'s Report` : ''}`}
            </div>
            <CardAverages insights={insights} />
            <div>
                {rows.map((row, i) => (
                    <RowCard row={row} idx={i} key={i} operatorOptions={operatorOptions} />
                ))}
            </div>
        </div>
    )
}
