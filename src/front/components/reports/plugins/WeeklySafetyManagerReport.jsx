import React, {useEffect} from 'react'

const TAG_OPTIONS = ['Accident', 'Injury', 'Non-DOT', 'DOT', 'Compliance', 'Environmental', 'Reprimand']

export function SafetyManagerSubmitPlugin({form, setForm, plants, readOnly}) {
    useEffect(() => {
        if (typeof form.issues === 'string') {
            setForm(f => ({
                ...f,
                issues: f.issues ? [{id: Date.now(), description: f.issues, plant: '', tag: ''}] : []
            }))
        }
    }, [form.issues, setForm])
    const issues = Array.isArray(form.issues) ? form.issues : []

    function updateIssue(id, patch) {
        const updated = issues.map(i => i.id === id ? {...i, ...patch} : i)
        setForm(f => ({...f, issues: updated}))
    }

    function removeIssue(id) {
        const updated = issues.filter(i => i.id !== id)
        setForm(f => ({...f, issues: updated}))
    }

    function addIssue() {
        const newIssue = {id: Date.now(), description: '', plant: '', tag: ''}
        setForm(f => ({...f, issues: [...(f.issues || []), newIssue]}))
    }

    return (
        <div style={{marginTop: 32}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
                <div style={{fontWeight: 700, fontSize: 18}}>Issues</div>
                {!readOnly && (
                    <button type="button" onClick={addIssue} style={{
                        background: 'var(--accent)',
                        color: 'var(--text-light)',
                        border: 'none',
                        borderRadius: 6,
                        padding: '8px 16px',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}>
                        Add Issue
                    </button>
                )}
            </div>
            {issues.length === 0 && (
                <div style={{color: 'var(--text-secondary)', fontSize: 14}}>No issues added yet.</div>
            )}
            <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>
                {issues.map((issue, idx) => (
                    <div key={issue.id} style={{
                        border: '1px solid var(--divider)',
                        borderRadius: 10,
                        background: 'var(--background-elevated)',
                        padding: 18,
                        boxShadow: '0 1px 4px var(--shadow-sm)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 12
                        }}>
                            <div style={{fontWeight: 600, fontSize: 15}}>Issue {idx + 1}</div>
                            {!readOnly && (
                                <button type="button" onClick={() => removeIssue(issue.id)} style={{
                                    background: 'var(--divider)',
                                    color: 'var(--text-primary)',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '6px 12px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}>Remove</button>
                            )}
                        </div>
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: 16}}>
                            <div style={{flex: '1 1 180px', minWidth: 160}}>
                                <label style={{
                                    fontWeight: 600,
                                    fontSize: 14,
                                    display: 'block',
                                    marginBottom: 6
                                }}>Plant<span style={{color: 'var(--error)'}}>*</span></label>
                                <select disabled={readOnly} value={issue.plant}
                                        onChange={e => updateIssue(issue.id, {plant: e.target.value})} style={{
                                    width: '100%',
                                    height: 40,
                                    border: '1px solid var(--divider)',
                                    borderRadius: 6,
                                    background: 'var(--background)',
                                    color: 'var(--text-primary)',
                                    padding: '0 10px'
                                }}>
                                    <option value="">Select...</option>
                                    {plants.map(p => (
                                        <option key={p.plant_code} value={p.plant_code}>{p.plant_code}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{flex: '1 1 180px', minWidth: 160}}>
                                <label
                                    style={{fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 6}}>Tag<span
                                    style={{color: 'var(--error)'}}>*</span></label>
                                <select disabled={readOnly} value={issue.tag}
                                        onChange={e => updateIssue(issue.id, {tag: e.target.value})} style={{
                                    width: '100%',
                                    height: 40,
                                    border: '1px solid var(--divider)',
                                    borderRadius: 6,
                                    background: 'var(--background)',
                                    color: 'var(--text-primary)',
                                    padding: '0 10px'
                                }}>
                                    <option value="">Select...</option>
                                    {TAG_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{marginTop: 16}}>
                            <label style={{fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 6}}>Description<span
                                style={{color: 'var(--error)'}}>*</span></label>
                            <textarea disabled={readOnly} value={issue.description}
                                      onChange={e => updateIssue(issue.id, {description: e.target.value})} style={{
                                width: '100%',
                                minHeight: 80,
                                border: '1px solid var(--divider)',
                                borderRadius: 6,
                                background: 'var(--background)',
                                color: 'var(--text-primary)',
                                padding: '8px 10px',
                                resize: 'vertical'
                            }}/>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function SafetyManagerReviewPlugin({form}) {
    const issues = Array.isArray(form.issues) ? form.issues : (typeof form.issues === 'string' && form.issues ? [{
        id: 0,
        description: form.issues,
        plant: '',
        tag: ''
    }] : [])
    if (issues.length === 0) return (
        <div style={{marginTop: 32, color: 'var(--text-secondary)', fontSize: 14}}>No issues reported.</div>
    )
    return (
        <div style={{marginTop: 32}}>
            <div style={{fontWeight: 700, fontSize: 18, marginBottom: 12}}>Issues</div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
                {issues.map((issue, idx) => (
                    <div key={issue.id || idx} style={{
                        border: '1px solid var(--divider)',
                        borderRadius: 10,
                        background: 'var(--background-elevated)',
                        padding: 16
                    }}>
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 8}}>
                            <div style={{fontWeight: 600}}>Issue {idx + 1}</div>
                            <div style={{fontSize: 14, fontWeight: 600}}>Plant: <span
                                style={{fontWeight: 500}}>{issue.plant || '--'}</span></div>
                            <div style={{fontSize: 14, fontWeight: 600}}>Tag: <span
                                style={{fontWeight: 500}}>{issue.tag || '--'}</span></div>
                        </div>
                        <div style={{
                            whiteSpace: 'pre-wrap',
                            fontSize: 14,
                            lineHeight: 1.4
                        }}>{issue.description || ''}</div>
                    </div>
                ))}
            </div>
        </div>
    )
}

