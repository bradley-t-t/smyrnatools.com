export function getWeekRangeFromIso(weekIso) {
    const monday = new Date(weekIso)
    monday.setDate(monday.getDate() + 1)
    monday.setHours(0, 0, 0, 0)
    const saturday = new Date(monday)
    saturday.setDate(monday.getDate() + 5)
    function formatDateMMDDYY(date) {
        const mm = date.getMonth() + 1
        const dd = date.getDate()
        const yy = date.getFullYear().toString().slice(-2)
        return `${mm}-${dd}-${yy}`
    }
    return `${formatDateMMDDYY(monday)} through ${formatDateMMDDYY(saturday)}`
}

export function getMondayAndSaturday(date = new Date()) {
    const d = new Date(date)
    const day = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((day + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    const saturday = new Date(monday)
    saturday.setDate(monday.getDate() + 5)
    saturday.setHours(0, 0, 0, 0)
    return { monday, saturday }
}

export function getMondayISO(date) {
    const { monday } = getMondayAndSaturday(date)
    return monday.toISOString().slice(0, 10)
}

export function formatDateMMDDYY(date) {
    const mm = date.getMonth() + 1
    const dd = date.getDate()
    const yy = date.getFullYear().toString().slice(-2)
    return `${mm}-${dd}-${yy}`
}

export function getWeekRangeString(start, end) {
    return `${formatDateMMDDYY(start)} through ${formatDateMMDDYY(end)}`
}

export function getPlantNameFromReport(report) {
    if (report.data && report.data.plant) return report.data.plant
    if (report.data && report.data.rows && report.data.rows[0] && report.data.rows[0].plant_code) return report.data.rows[0].plant_code
    return ''
}

export function getPlantNameFromWeekItem(item) {
    if (item.report && item.report.data && item.report.data.plant) return item.report.data.plant
    if (item.report && item.report.data && item.report.data.rows && item.report.data.rows[0] && item.report.data.rows[0].plant_code) return item.report.data.rows[0].plant_code
    return ''
}

export function parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null
    const [h, m] = timeStr.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return null
    return h * 60 + m
}

export function getOperatorName(row, operatorOptions) {
    if (!row || !row.name) return ''
    if (Array.isArray(operatorOptions)) {
        const found = operatorOptions.find(opt => opt.value === row.name)
        if (found) return found.label
    }
    if (row.displayName) return row.displayName
    return row.name
}

export function exportRowsToCSV(rows, operatorOptions, reportDate) {
    if (!Array.isArray(rows) || rows.length === 0) return
    const dateStr = reportDate ? ` - ${reportDate}` : ''
    const title = `Plant Production Report${dateStr}`
    const headers = Array(12).fill('')
    headers[0] = title
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

export function exportReportFieldsToCSV(report, form) {
    if (!report || !Array.isArray(report.fields)) return
    const headers = report.fields.map(f => f.label || f.name)
    const values = report.fields.map(f => form[f.name] || '')
    const csvRows = [headers, values]
    const csvContent = csvRows.map(r =>
        r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
    ).join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.title || report.name}.csv`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }, 0)
}

