const ReportUtility = {
    parseTimeToMinutes(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return null
        const parts = timeStr.split(':').map(Number)
        if (parts.length < 2) return null
        const [h, m] = parts
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null
        return h * 60 + m
    },
    mondayOf(dateInput) {
        const d = dateInput instanceof Date ? new Date(dateInput) : new Date(dateInput)
        if (isNaN(d.getTime())) return null
        const day = d.getDay()
        const monday = new Date(d)
        monday.setDate(d.getDate() - ((day + 6) % 7))
        monday.setHours(0, 0, 0, 0)
        return monday
    },
    getMondayISO(dateInput) {
        const monday = this.mondayOf(dateInput || new Date())
        return monday ? monday.toISOString().slice(0, 10) : ''
    },
    getWeekDatesFromIso(weekIso) {
        if (!weekIso) return {monday: null, saturday: null}
        const monday = new Date(weekIso)
        monday.setDate(monday.getDate() + 1)
        monday.setHours(0, 0, 0, 0)
        const saturday = new Date(monday)
        saturday.setDate(monday.getDate() + 5)
        saturday.setHours(0, 0, 0, 0)
        return {monday, saturday}
    },
    formatDateMMDDYY(date) {
        if (!(date instanceof Date) || isNaN(date.getTime())) return ''
        const mm = date.getMonth() + 1
        const dd = date.getDate()
        const yy = date.getFullYear().toString().slice(-2)
        return `${mm}-${dd}-${yy}`
    },
    formatDate(dateInput, locale) {
        if (!dateInput) return ''
        const d = new Date(dateInput)
        if (isNaN(d.getTime())) return ''
        return d.toLocaleDateString(locale)
    },
    getWeekVerbose(weekIso, locale) {
        if (!weekIso) return ''
        const {monday, saturday} = this.getWeekDatesFromIso(weekIso)
        if (!monday || !saturday) return ''
        const left = monday.toLocaleDateString(locale, {weekday: 'short', month: 'short', day: 'numeric'})
        const right = saturday.toLocaleDateString(locale, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
        return `${left}  – ${right}`
    },
    formatVerboseDate(dateInput, locale) {
        if (!dateInput) return ''
        const d = new Date(dateInput)
        if (isNaN(d.getTime())) return ''
        return d.toLocaleDateString(locale, {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'})
    },
    formatDateTime(dt, locale) {
        if (!dt) return ''
        const date = new Date(dt)
        if (isNaN(date.getTime())) return ''
        return date.toLocaleString(locale)
    },
    getTodayISODate() {
        return new Date().toISOString().slice(0, 10)
    },
    getTruckNumberForOperator(row, mixers) {
        if (row && row.truck_number) return row.truck_number
        if (!row || !row.name) return ''
        const mixer = (mixers || []).find(m => m.assigned_operator === row.name)
        if (mixer && mixer.truck_number) return mixer.truck_number
        return ''
    },
    validatePlantProduction(form, operatorOptions) {
        if (!form || typeof form !== 'object') return 'Invalid form'
        if (!form.plant) return 'Please select a plant before submitting.'
        if (!form.report_date) return 'Please select a report date before submitting.'
        const rows = Array.isArray(form.rows) ? form.rows : []
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i]
            const label = Array.isArray(operatorOptions) ? (operatorOptions.find(o => o.value === r.name)?.label || `Operator ${i + 1}`) : `Operator ${i + 1}`
            const start = this.parseTimeToMinutes(r.start_time)
            const first = this.parseTimeToMinutes(r.first_load)
            const eod = this.parseTimeToMinutes(r.eod_in_yard)
            const punch = this.parseTimeToMinutes(r.punch_out)
            if (!r.start_time || start === null) return `${label}: Start Time is required and must be a valid time.`
            if (!r.first_load || first === null) return `${label}: 1st Load time is required and must be a valid time.`
            if (!r.eod_in_yard || eod === null) return `${label}: EOD In Yard time is required and must be a valid time.`
            if (!r.punch_out || punch === null) return `${label}: Punch Out time is required and must be a valid time.`
            if (first - start < 0) return `${label}: 1st Load time must be after Start Time.`
            if (punch - eod < 0) return `${label}: Punch Out time must be after EOD In Yard.`
            if (start !== null && punch !== null && punch - start <= 0) return `${label}: Total hours must be greater than 0.`
            const loadsVal = r.loads
            if (loadsVal === undefined || loadsVal === null || String(loadsVal) === '') return `${label}: Total Loads is required.`
            const loadsNum = Number(loadsVal)
            if (!Number.isFinite(loadsNum) || loadsNum < 0 || !Number.isInteger(loadsNum)) return `${label}: Total Loads must be a non-negative whole number.`
        }
        return ''
    },
    getExcludedOperators(rows, operatorOptions) {
        const r = Array.isArray(rows) ? rows : []
        const opts = Array.isArray(operatorOptions) ? operatorOptions : []
        return opts.filter(opt => !r.some(row => row.name === opt.value)).map(opt => opt.value)
    },
    getLastNWeekIsos(n, fromDate) {
        const weeks = []
        const base = fromDate instanceof Date ? fromDate : new Date()
        const currentMonday = this.mondayOf(base)
        if (!currentMonday) return weeks
        const ptr = new Date(currentMonday)
        for (let i = 0; i < n; i++) {
            weeks.push(ptr.toISOString().slice(0, 10))
            ptr.setDate(ptr.getDate() - 7)
        }
        return weeks
    },
    getTotalWeeksSince(startDate, todayDate) {
        const today = todayDate instanceof Date ? todayDate : new Date()
        const currentMonday = this.mondayOf(today)
        const startMonday = this.mondayOf(startDate)
        if (!currentMonday || !startMonday) return 0
        const diffMs = currentMonday.getTime() - startMonday.getTime()
        const weeks = Math.floor(diffMs / 604800000) + 1
        return Math.max(weeks, 0)
    },
    computeMyReportStatus({completed, hasSavedData, weekIso, today}) {
        const now = today instanceof Date ? today : new Date()
        const {saturday} = this.getWeekDatesFromIso(weekIso)
        let statusText = ''
        let statusClass = ''
        let buttonLabel = ''
        if (completed) {
            statusText = 'Completed'
            statusClass = 'success'
            buttonLabel = 'View'
        } else if (hasSavedData) {
            statusText = 'Continue Editing'
            statusClass = 'info'
            buttonLabel = 'Edit'
        } else if (saturday && saturday >= now) {
            statusText = 'Current Week'
            statusClass = 'info'
            buttonLabel = 'Submit'
        } else {
            statusText = 'Past Due'
            statusClass = 'error'
            buttonLabel = 'Submit'
        }
        return {statusText, statusClass, buttonLabel}
    }
}

export default ReportUtility
export {ReportUtility}
