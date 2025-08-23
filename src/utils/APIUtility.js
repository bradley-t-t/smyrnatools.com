const EDGE_FUNCTIONS_URL = process.env.REACT_APP_EDGE_FUNCTIONS_URL
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY
import {supabase} from '../services/DatabaseService'

const APIUtility = {
    async post(path, data) {
        let token = SUPABASE_ANON_KEY
        try {
            const {data: sessionData} = await supabase.auth.getSession()
            const accessToken = sessionData?.session?.access_token
            if (accessToken) token = accessToken
        } catch {}
        const res = await fetch(`${EDGE_FUNCTIONS_URL}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        })
        const json = await res.json().catch(() => ({}))
        return {res, json}
    }
}

export default APIUtility
export {APIUtility}