export function compareByStatusThenNumber(a, b, statusField = 'status', numberField = 'truckNumber') {
    const order = {Active: 0, Spare: 1, 'In Shop': 2, Retired: 3};
    const sa = order[a?.[statusField]] ?? 99;
    const sb = order[b?.[statusField]] ?? 99;
    if (sa !== sb) return sa - sb;
    const aNum = parseInt(String(a?.[numberField] ?? '').replace(/\D/g, '') || '0');
    const bNum = parseInt(String(b?.[numberField] ?? '').replace(/\D/g, '') || '0');
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    return String(a?.[numberField] ?? '').localeCompare(String(b?.[numberField] ?? ''));
}

export function countUnassignedActiveOperators(items, operators, searchText, {
    position,
    selectedPlant,
    operatorIdField = 'employeeId',
    assignedOperatorField = 'assignedOperator',
    assignedPlantField = 'assignedPlant'
}) {
    const normalized = String(searchText || '').trim().toLowerCase().replace(/\s+/g, '');
    const ops = (operators || []).filter(op => {
        if (op?.status !== 'Active') return false;
        if (position && op?.position !== position) return false;
        if (selectedPlant && op?.plantCode !== selectedPlant) return false;
        if (!normalized) return true;
        const nameNoSpace = String(op?.name || '').toLowerCase().replace(/\s+/g, '');
        const smyrna = String(op?.smyrnaId || '').toLowerCase();
        return nameNoSpace.includes(normalized) || smyrna.includes(normalized);
    });
    const active = (items || []).filter(it => it?.status === 'Active' && (!selectedPlant || it?.[assignedPlantField] === selectedPlant));
    let count = 0;
    for (const op of ops) {
        const isAssigned = active.some(it => it?.[assignedOperatorField] === op?.[operatorIdField]);
        if (!isAssigned) count++;
    }
    return count;
}

