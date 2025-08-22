const EDGE_FUNCTIONS_URL = process.env.REACT_APP_EDGE_FUNCTIONS_URL
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY

const APIUtility = {
    async post(path, data) {
        const res = await fetch(`${EDGE_FUNCTIONS_URL}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify(data)
        })
        const json = await res.json().catch(() => ({}))
        return {res, json}
    }
}

export default APIUtility
export {APIUtility}