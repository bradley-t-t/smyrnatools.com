import React, {useEffect, useRef, useState} from 'react'
import '../styles/ReportTypes.css'

const TAG_OPTIONS = ['Accident', 'Injury', 'Non-DOT', 'DOT', 'Compliance', 'Environmental', 'Reprimand']

function TagPicker({value, options, disabled, placeholder, onChange}) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const ref = useRef(null)
    useEffect(() => {
        function onDocClick(e) {
            if (!ref.current) return
            if (!ref.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', onDocClick)
        return () => document.removeEventListener('mousedown', onDocClick)
    }, [])
    const lower = query.toLowerCase()
    const filtered = options.filter(o => o.toLowerCase().includes(lower))
    function toggle(val) {
        if (disabled) return
        const has = value.includes(val)
        const next = has ? value.filter(v => v !== val) : [...value, val]
        onChange(next)
    }
    function selectAll() {
        if (disabled) return
        onChange(options)
    }
    function clearAll() {
        if (disabled) return
        onChange([])
    }
    return (
        <div className="rpt-tag-picker" ref={ref}>
            <button type="button" className="rpt-tag-input-btn" disabled={disabled} aria-expanded={open} onClick={() => setOpen(o => !o)}>
                <span className="rpt-tag-input-placeholder">{value.length ? `${value.length} selected` : (placeholder || 'Select tags')}</span>
                <span>{open ? '▴' : '▾'}</span>
            </button>
            {open && (
                <div className="rpt-tag-menu" role="listbox">
                    <div className="rpt-tag-menu-actions">
                        <button type="button" className="rpt-btn rpt-btn-xs" onClick={selectAll}>Select all</button>
                        <button type="button" className="rpt-btn rpt-btn-xs" onClick={clearAll}>Clear</button>
                    </div>
                    <input className="rpt-tag-search" placeholder="Search tags..." value={query} onChange={e => setQuery(e.target.value)} />
                    {filtered.map(opt => (
                        <div key={opt} className="rpt-tag-item" role="option" aria-selected={value.includes(opt)} onClick={() => toggle(opt)}>
                            <input type="checkbox" readOnly checked={value.includes(opt)} />
                            <span>{opt}</span>
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <div className="rpt-tag-item"><span className="rpt-text-secondary">No matches</span></div>
                    )}
                </div>
            )}
        </div>
    )
}

export function SafetyManagerSubmitPlugin({form, setForm, plants, readOnly}) {
    useEffect(() => {
        if (typeof form.issues === 'string') {
            setForm(f => ({
                ...f,
                issues: f.issues ? [{id: Date.now(), description: f.issues, plant: '', tag: '', tags: [], date: ''}] : []
            }))
        }
    }, [form.issues, setForm])

    useEffect(() => {
        if (!Array.isArray(form.issues)) return
        let needsUpdate = false
        const migrated = form.issues.map(i => {
            const next = {...i}
            if (!Array.isArray(next.tags)) {
                next.tags = next.tag ? [next.tag] : []
                needsUpdate = true
            }
            if (next.date === undefined) {
                next.date = ''
                needsUpdate = true
            }
            return next
        })
        if (needsUpdate) setForm(f => ({...f, issues: migrated}))
    }, [form.issues, setForm])

    const issues = Array.isArray(form.issues) ? form.issues : []

    function updateIssue(id, patch) {
        const updated = issues.map(i => i.id === id ? {...i, ...patch} : i)
        setForm(f => ({...f, issues: updated}))
    }

    function updateIssueTagsArray(id, nextArray) {
        updateIssue(id, {tags: nextArray, tag: nextArray[0] || ''})
    }

    function removeIssueTag(id, tagToRemove) {
        const issue = issues.find(i => i.id === id)
        if (!issue) return
        const next = (issue.tags || []).filter(t => t !== tagToRemove)
        updateIssue(id, {tags: next, tag: next[0] || ''})
    }

    function removeIssue(id) {
        const updated = issues.filter(i => i.id !== id)
        setForm(f => ({...f, issues: updated}))
    }

    function addIssue() {
        const today = new Date().toISOString().slice(0, 10)
        const newIssue = {id: Date.now(), description: '', plant: '', tag: '', tags: [], date: today}
        setForm(f => ({...f, issues: [...(f.issues || []), newIssue]}))
    }

    return (
        <div className="rpt-mt-32">
            <div className="rpt-header">
                <div className="rpt-title">Issues</div>
                {!readOnly && (
                    <button type="button" onClick={addIssue} className="rpt-primary-btn">
                        Add Issue
                    </button>
                )}
            </div>
            {issues.length === 0 && (
                <div className="rpt-empty">No issues added yet.</div>
            )}
            <div className="rpt-issue-list">
                {issues.map((issue, idx) => (
                    <div key={issue.id} className="rpt-card rpt-card-accent">
                        <div className="rpt-card-header">
                            <div className="rpt-card-title">Issue {idx + 1}</div>
                            <div className="rpt-card-actions">
                                {issue.plant ? <span className="rpt-badge">Plant {issue.plant}</span> : null}
                                {(issue.tags && issue.tags.length) ? <span className="rpt-badge">{issue.tags.length} tags</span> : null}
                                {issue.date ? <span className="rpt-badge">{issue.date}</span> : null}
                                {!readOnly && (
                                    <button type="button" onClick={() => removeIssue(issue.id)} className="rpt-secondary-btn">Remove</button>
                                )}
                            </div>
                        </div>
                        <div className="rpt-form-row">
                            <div className="rpt-field">
                                <label className="rpt-label">Plant<span className="rpt-required">*</span></label>
                                <select disabled={readOnly} value={issue.plant}
                                        onChange={e => updateIssue(issue.id, {plant: e.target.value})}
                                        className="rpt-select">
                                    <option value="">Select...</option>
                                    {plants.map(p => (
                                        <option key={p.plant_code} value={p.plant_code}>{p.plant_code}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="rpt-field">
                                <label className="rpt-label">Date</label>
                                <input type="date" disabled={readOnly} value={issue.date || ''}
                                       onChange={e => updateIssue(issue.id, {date: e.target.value})}
                                       className="rpt-input"/>
                            </div>
                            <div className="rpt-field">
                                <label className="rpt-label">Tags<span className="rpt-required">*</span></label>
                                <TagPicker value={issue.tags || []} options={TAG_OPTIONS} disabled={readOnly} placeholder="Select tags" onChange={vals => updateIssueTagsArray(issue.id, vals)} />
                                {(issue.tags && issue.tags.length > 0) && (
                                    <div className="rpt-tags-list">
                                        {issue.tags.map(t => (
                                            <span key={t} className="rpt-chip">
                                                {t}
                                                {!readOnly && (
                                                    <button type="button" className="rpt-chip-remove" aria-label={`Remove ${t}`} onClick={() => removeIssueTag(issue.id, t)}>×</button>
                                                )}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="rpt-mt-16">
                            <label className="rpt-label">Description<span className="rpt-required">*</span></label>
                            <textarea disabled={readOnly} value={issue.description}
                                      onChange={e => updateIssue(issue.id, {description: e.target.value})}
                                      className="rpt-textarea"/>
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
        tag: '',
        tags: [],
        date: ''
    }] : [])
    if (issues.length === 0) return (
        <div className="rpt-mt-32 rpt-empty">No issues reported.</div>
    )
    return (
        <div className="rpt-mt-32">
            <div className="rpt-title rpt-mb-16">Issues</div>
            <div className="rpt-issue-list">
                {issues.map((issue, idx) => {
                    const tags = Array.isArray(issue.tags) ? issue.tags : (issue.tag ? [issue.tag] : [])
                    return (
                        <div key={issue.id || idx} className="rpt-card rpt-card-accent">
                            <div className="rpt-card-header">
                                <div className="rpt-card-title">Issue {idx + 1}</div>
                                <div className="rpt-card-actions">
                                    {issue.plant ? <span className="rpt-badge">{issue.plant}</span> : null}
                                    {tags.length === 1 ? <span className="rpt-badge">{tags[0]}</span> : (tags.length > 1 ? <span className="rpt-badge">{tags.length} tags</span> : null)}
                                    {issue.date ? <span className="rpt-badge">{issue.date}</span> : null}
                                </div>
                            </div>
                            <div className="rpt-description">{issue.description || ''}</div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
