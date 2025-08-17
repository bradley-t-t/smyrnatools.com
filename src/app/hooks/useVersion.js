import {useEffect, useState} from 'react'
import {AppService} from '../../services/AppService'

export function useVersion() {
    const [version, setVersion] = useState('');
    useEffect(() => {
        let mounted = true;
        AppService.getVersion().then(v => {
            if (mounted) setVersion(v || '')
        });
        return () => {
            mounted = false
        }
    }, []);
    return version
}

export default useVersion

