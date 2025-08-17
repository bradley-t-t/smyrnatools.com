import {useEffect, useState} from 'react'
import {AuthUtility} from '../../utils/AuthUtility'

export function useCurrentUserId() {
    const [userId, setUserId] = useState(null);
    useEffect(() => {
        let active = true;
        AuthUtility.getUserId().then(id => {
            if (active) setUserId(id)
        })
    }, []);
    return userId
}

export default useCurrentUserId

