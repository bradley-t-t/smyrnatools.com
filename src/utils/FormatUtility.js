const FormatUtility = {
    formatDate: (dateStr) => {
        if (!dateStr) return ''
        const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : (/^\d{4}-\d{2}-\d{2}T/.test(dateStr) ? dateStr.slice(0,10) : null)
        if (isoDateOnly) {
            const [y,m,d] = isoDateOnly.split('-').map(n=>parseInt(n,10))
            if (!y || !m || !d) return dateStr
            const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
            const monthName = monthNames[m-1] || ''
            let suffix = 'th'
            if (d % 10 === 1 && d !== 11) suffix = 'st'
            else if (d % 10 === 2 && d !== 12) suffix = 'nd'
            else if (d % 10 === 3 && d !== 13) suffix = 'rd'
            return `${monthName} ${d}${suffix}, ${y}`
        }
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return dateStr
        const options = {month: 'long', day: 'numeric', year: 'numeric'}
        const formatted = date.toLocaleDateString('en-US', options)
        const day = date.getDate()
        let suffix = 'th'
        if (day % 10 === 1 && day !== 11) suffix = 'st'
        else if (day % 10 === 2 && day !== 12) suffix = 'nd'
        else if (day % 10 === 3 && day !== 13) suffix = 'rd'
        return formatted.replace(`${day}`, `${day}${suffix}`)
    },
    formatDateTime: (dateStr) => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return dateStr
        const options = {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}
        return date.toLocaleString('en-US', options)
    }
}

export default FormatUtility
export {FormatUtility}
