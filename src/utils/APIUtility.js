const EDGE_FUNCTIONS_URL = process.env.REACT_APP_EDGE_FUNCTIONS_URL
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY
import {supabase} from '../services/DatabaseService'

const APIUtility = {
    async post(path, data, options = {}) {
        let token = SUPABASE_ANON_KEY
        try {
            const {data: sessionData} = await supabase.auth.getSession()
            const accessToken = sessionData?.session?.access_token
            if (accessToken) token = accessToken
        } catch {
        }
        const url = `${EDGE_FUNCTIONS_URL}${path}`
        if (options.keepalive && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
            try {
                const payload = {...(data || {}), token}
                const sent = navigator.sendBeacon(url, new Blob([JSON.stringify(payload)], {type: 'text/plain'}))
                const res = {ok: sent, status: sent ? 200 : 0}
                const json = sent ? {success: true} : {}
                return {res, json}
            } catch {
                const res = {ok: false, status: 0}
                const json = {}
                return {res, json}
            }
        }
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    ...(options.headers || {})
                },
                body: JSON.stringify(data),
                keepalive: Boolean(options.keepalive)
            })
            const json = await res.json().catch(() => ({}))
            return {res, json}
        } catch {
            const res = {ok: false, status: 0}
            const json = {}
            return {res, json}
        }
    }
}

export default APIUtility
export {APIUtility}