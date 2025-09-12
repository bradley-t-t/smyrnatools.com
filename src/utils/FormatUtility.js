const FormatUtility = {
    formatDate: (dateStr) => {
        if (!dateStr) return ''
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
