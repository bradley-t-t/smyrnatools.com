import {PlantService} from '../../services/PlantService'

function wrap(s) {
    return new Proxy({}, {get: (_, p) => typeof s[p] === 'function' ? (...a) => s[p](...a) : s[p]})
}

export function usePlant() {
    return wrap(PlantService)
}

export default usePlant

