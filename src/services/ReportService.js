class ReportServiceImpl {
    getWeekRangeFromIso(weekIso) {
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

    getMondayAndSaturday(date = new Date()) {
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

    getMondayISO(date) {
        const { monday } = this.getMondayAndSaturday(date)
        return monday.toISOString().slice(0, 10)
    }

    formatDateMMDDYY(date) {
        const mm = date.getMonth() + 1
        const dd = date.getDate()
        const yy = date.getFullYear().toString().slice(-2)
        return `${mm}-${dd}-${yy}`
    }

    getWeekRangeString(start, end) {
        return `${this.formatDateMMDDYY(start)} through ${this.formatDateMMDDYY(end)}`
    }

    getPlantNameFromReport(report) {
        if (report.data && report.data.plant) return report.data.plant
        if (report.data && report.data.rows && report.data.rows[0] && report.data.rows[0].plant_code) return report.data.rows[0].plant_code
        return ''
    }

    getPlantNameFromWeekItem(item) {
        if (item.report && item.report.data && item.report.data.plant) return item.report.data.plant
        if (item.report && item.report.data && item.report.data.rows && item.report.data.rows[0] && item.report.data.rows[0].plant_code) return item.report.data.rows[0].plant_code
        return ''
    }

    parseTimeToMinutes(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return null
        const [h, m] = timeStr.split(':').map(Number)
        if (isNaN(h) || isNaN(m)) return null
        return h * 60 + m
    }

    getOperatorName(row, operatorOptions) {
        if (!row || !row.name) return ''
        if (Array.isArray(operatorOptions)) {
            const found = operatorOptions.find(opt => opt.value === row.name)
            if (found) return found.label
        }
        if (row.displayName) return row.displayName
        return row.name
    }

    exportRowsToCSV(rows, operatorOptions, reportDate) {
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
            const start = this.parseTimeToMinutes(row.start_time)
            const firstLoad = this.parseTimeToMinutes(row.first_load)
            const eod = this.parseTimeToMinutes(row.eod_in_yard)
            const punch = this.parseTimeToMinutes(row.punch_out)
            const elapsedStart = (start !== null && firstLoad !== null) ? firstLoad - start : ''
            const elapsedEnd = (eod !== null && punch !== null) ? punch - eod : ''
            const totalHours = (start !== null && punch !== null) ? ((punch - start) / 60) : ''
            const loadsPerHour = (row.loads && totalHours && totalHours > 0) ? (row.loads / totalHours).toFixed(2) : ''
            csvRows.push([
                this.getOperatorName(row, operatorOptions),
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

    exportReportFieldsToCSV(report, form) {
        if (!report || !Array.isArray(report.fields)) return
        if (report.name === 'general_manager') {
            const plantCodes = Object.keys(form)
                .filter(key => key.startsWith('total_yardage_'))
                .map(key => key.replace('total_yardage_', ''))
            if (plantCodes.length === 0) return
            const headers = [
                'Plant Code',
                'Active Operators',
                'Runnable Trucks',
                'Down Trucks',
                'Operators Starting',
                'New Operators Training',
                'Operators Leaving',
                'Total Yardage',
                'Total Hours',
                'Yards/Hour',
                'Comments'
            ]
            const rows = plantCodes.map(pc => {
                const yardage = Number(form[`total_yardage_${pc}`]) || 0
                const hours = Number(form[`total_hours_${pc}`]) || 0
                const yph = hours > 0 ? (yardage / hours).toFixed(2) : ''
                return [
                    pc,
                    form[`active_operators_${pc}`] || '',
                    form[`runnable_trucks_${pc}`] || '',
                    form[`down_trucks_${pc}`] || '',
                    form[`operators_starting_${pc}`] || '',
                    form[`new_operators_training_${pc}`] || '',
                    form[`operators_leaving_${pc}`] || '',
                    yardage,
                    hours,
                    yph,
                    form[`comments_${pc}`] || ''
                ]
            })
            const csvRows = [headers, ...rows]
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
            return
        }
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

    getYardageMetrics(form) {
        let yards = parseFloat(form.total_yards_delivered || form['Yardage'] || form['yardage'])
        let hours = parseFloat(form.total_operator_hours || form['Total Hours'] || form['total_hours'] || form['total_operator_hours'])
        let yph = !isNaN(yards) && !isNaN(hours) && hours > 0 ? yards / hours : null
        let yphGrade = ''
        if (yph !== null) {
            if (yph >= 6) yphGrade = 'excellent'
            else if (yph >= 4) yphGrade = 'good'
            else if (yph >= 3) yphGrade = 'average'
            else yphGrade = 'poor'
        }
        let yphLabel = ''
        if (yphGrade === 'excellent') yphLabel = 'Excellent'
        else if (yphGrade === 'good') yphLabel = 'Good'
        else if (yphGrade === 'average') yphLabel = 'Average'
        else if (yphGrade === 'poor') yphLabel = 'Poor'

        let lost = null
        if (typeof form.total_yards_lost !== 'undefined' && form.total_yards_lost !== '' && !isNaN(Number(form.total_yards_lost))) {
            lost = Number(form.total_yards_lost)
        } else if (
            typeof form.yardage_lost !== 'undefined' && form.yardage_lost !== '' && !isNaN(Number(form.yardage_lost))
        ) {
            lost = Number(form.yardage_lost)
        } else if (
            typeof form.lost_yardage !== 'undefined' && form.lost_yardage !== '' && !isNaN(Number(form.lost_yardage))
        ) {
            lost = Number(form.lost_yardage)
        } else if (
            typeof form['Yardage Lost'] !== 'undefined' && form['Yardage Lost'] !== '' && !isNaN(Number(form['Yardage Lost']))
        ) {
            lost = Number(form['Yardage Lost'])
        } else if (
            typeof form['yardage_lost'] !== 'undefined' && form['yardage_lost'] !== '' && !isNaN(Number(form['yardage_lost']))
        ) {
            lost = Number(form['yardage_lost'])
        }
        if (lost !== null && lost < 0) {
            lost = 0
        }
        let lostGrade = ''
        if (lost !== null) {
            if (lost === 0) lostGrade = 'excellent'
            else if (lost < 5) lostGrade = 'good'
            else if (lost < 10) lostGrade = 'average'
            else lostGrade = 'poor'
        }
        let lostLabel = ''
        if (lostGrade === 'excellent') lostLabel = 'Excellent'
        else if (lostGrade === 'good') lostLabel = 'Good'
        else if (lostGrade === 'average') lostLabel = 'Average'
        else if (lostGrade === 'poor') lostLabel = 'Poor'

        return { yph, yphGrade, yphLabel, lost, lostGrade, lostLabel }
    }

    getYphColor(grade) {
        if (grade === 'excellent') return 'var(--excellent)'
        if (grade === 'good') return 'var(--success)'
        if (grade === 'average') return 'var(--warning)'
        if (grade === 'poor') return 'var(--error)'
        return ''
    }

    getPlantProductionInsights(rows) {
        function parseTimeToMinutes(timeStr) {
            if (!timeStr || typeof timeStr !== 'string') return null
            const [h, m] = timeStr.split(':').map(Number)
            if (isNaN(h) || isNaN(m)) return null
            return h * 60 + m
        }
        function isExcludedRow(row) {
            if (!row) return true
            const keys = Object.keys(row).filter(k => k !== 'name' && k !== 'truck_number')
            return keys.every(k => row[k] === '' || row[k] === undefined || row[k] === null || row[k] === 0)
        }
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
}

export const ReportService = new ReportServiceImpl()
