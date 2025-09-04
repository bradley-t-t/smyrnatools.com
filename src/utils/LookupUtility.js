export function getOperatorName(operators, operatorId) {
    if (!operatorId || operatorId === '0') return 'None';
    const operator = Array.isArray(operators) ? operators.find(op => op.employeeId === operatorId) : null;
    return operator ? operator.name : 'Unknown';
}

export function getOperatorSmyrnaId(operators, operatorId) {
    if (!operatorId || operatorId === '0') return '';
    const operator = Array.isArray(operators) ? operators.find(op => op.employeeId === operatorId) : null;
    return operator?.smyrnaId || '';
}

export function getPlantName(plants, plantCode, emptyLabel = 'No Plant') {
    const plant = Array.isArray(plants) ? plants.find(p => p.plantCode === plantCode) : null;
    return plant ? plant.plantName : (plantCode || emptyLabel);
}

export function getTractorTruckNumber(tractors, tractorId, emptyLabel = 'None') {
    if (!tractorId) return emptyLabel;
    const tractor = Array.isArray(tractors) ? tractors.find(t => t.id === tractorId) : null;
    return tractor ? (tractor.truckNumber || 'Unknown') : emptyLabel;
}

export function isIdAssignedToMultiple(items, field, id) {
    if (!id || id === '0') return false;
    const list = Array.isArray(items) ? items : [];
    return list.filter(it => it && it[field] === id).length > 1;
}

const LookupUtility = {
    getOperatorName,
    getOperatorSmyrnaId,
    getPlantName,
    getTractorTruckNumber,
    isIdAssignedToMultiple
};
export default LookupUtility;
