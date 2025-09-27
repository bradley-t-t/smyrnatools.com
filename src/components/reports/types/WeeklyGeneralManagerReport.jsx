import React from 'react'
import '../styles/ReportTypes.css'
import {supabase} from '../../../services/DatabaseService'
import {ReportService} from '../../../services/ReportService'
import {ReportUtility} from '../../../utils/ReportUtility'
import {reportTypeMap} from '../../../config/types/ReportTypes'

function getWeekWindow(weekIso){
    if(!weekIso) return null
    const mondayIso = ReportUtility.getMondayISO(weekIso)
    if(!mondayIso) return null
    const start = new Date(mondayIso + 'T00:00:00Z')
    if(isNaN(start.getTime())) return null
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate()+7)
    return {start,end,startIso:start.toISOString(),endIso:end.toISOString()}
}

function Field({label, type = 'number', value, onChange, required, disabled}) {
    return (
        <div className="rpt-field">
            <label className="rpt-label">
                {label}
                {required ? <span className="rpt-required">*</span> : null}
            </label>
            {type === 'textarea' ? (
                <textarea className="rpt-textarea" value={value ?? ''} onChange={onChange} disabled={disabled}/>
            ) : (
                <input className="rpt-input" type={type} value={value ?? ''} onChange={onChange} disabled={disabled}/>
            )}
        </div>
    )
}

export function GeneralManagerSubmitPlugin({form, setForm, plants = [], readOnly, weekIso}) {
    function set(name, val) {
        setForm(prev => ({...prev, [name]: val}))
    }

    function num(v) {
        if (v === '' || v === null || v === undefined) return '';
        const n = Number(v);
        if (!Number.isFinite(n)) return '';
        return n < 0 ? 0 : n
    }

    function normUpper(code) {
        return String(code || '').trim().toUpperCase()
    }

    function normNumeric(code) {
        const s = String(code || '').trim();
        const d = s.replace(/^0+/, '');
        return d.length ? d : s.toUpperCase()
    }

    const [idx, setIdx] = React.useState(0)
    const count = Array.isArray(plants) ? plants.length : 0
    const safeIdx = count === 0 ? 0 : Math.min(Math.max(idx, 0), count - 1)
    React.useEffect(() => {
        if (safeIdx !== idx) setIdx(safeIdx)
    }, [count])
    const [opCounts, setOpCounts] = React.useState({
        Total: 0,
        Active: 0,
        'Light Duty': 0,
        'Pending Start': 0,
        Training: 0,
        Terminated: 0,
        'No Hire': 0
    })
    const [mxCounts, setMxCounts] = React.useState({Total: 0, Active: 0, Spare: 0, 'In Shop': 0})
    const [effIdx, setEffIdx] = React.useState(0)
    const [effReports, setEffReports] = React.useState([])
    const [aggReport, setAggReport] = React.useState(null)
    const [weekRangeLabel, setWeekRangeLabel] = React.useState('')
    React.useEffect(() => {
        const w = weekIso || form?.week
        if (w) {
            const iso = ReportUtility.getMondayISO(w)
            const label = ReportService.getWeekRangeFromIso(iso)
            setWeekRangeLabel(label)
            console.log('GM Report Week (Submit):', w, 'Range:', label)
        } else {
            setWeekRangeLabel('')
            console.log('GM Report Week (Submit): none')
        }
    }, [weekIso, form?.week])
    React.useEffect(() => {
        let cancelled = false

        async function load() {
            const codes = Array.isArray(plants) ? plants.map(p => p.plant_code).filter(Boolean) : []
            if (codes.length === 0) {
                if (!cancelled) {
                    setOpCounts({
                        Total: 0,
                        Active: 0,
                        'Light Duty': 0,
                        'Pending Start': 0,
                        Training: 0,
                        Terminated: 0,
                        'No Hire': 0
                    })
                    setMxCounts({Total: 0, Active: 0, Spare: 0, 'In Shop': 0})
                }
            } else {
                const {data: opsData} = await supabase.from('operators').select('status, position, plant_code').in('plant_code', codes)
                if (!cancelled) {
                    if (Array.isArray(opsData)) {
                        const c = {
                            Total: 0,
                            Active: 0,
                            'Light Duty': 0,
                            'Pending Start': 0,
                            Training: 0,
                            Terminated: 0,
                            'No Hire': 0
                        }
                        c.Total = opsData.length
                        opsData.forEach(op => {
                            const s = op.status || '';
                            if (s in c) c[s] += 1
                        })
                        setOpCounts(c)
                    } else {
                        setOpCounts({
                            Total: 0,
                            Active: 0,
                            'Light Duty': 0,
                            'Pending Start': 0,
                            Training: 0,
                            Terminated: 0,
                            'No Hire': 0
                        })
                    }
                }
                const {data: mxData} = await supabase.from('mixers').select('status, assigned_plant').in('assigned_plant', codes)
                if (!cancelled) {
                    if (Array.isArray(mxData)) {
                        const c = {Total: 0, Active: 0, Spare: 0, 'In Shop': 0}
                        const filtered = mxData.filter(m => (m.status || '') !== 'Retired')
                        c.Total = filtered.length
                        filtered.forEach(m => {
                            const s = m.status || '';
                            if (s in c) c[s] += 1
                        })
                        setMxCounts(c)
                    } else {
                        setMxCounts({Total: 0, Active: 0, Spare: 0, 'In Shop': 0})
                    }
                }
            }
        }

        load();
        return () => {
            cancelled = true
        }
    }, [plants])
    React.useEffect(() => {
        let cancelled = false
        function sameIsoDay(a,b){return a&&b&&a.slice(0,10)===b.slice(0,10)}
        function toMondayIso(d){ if(!d) return ''; const dt=new Date(d); if(isNaN(dt)) return ''; return ReportUtility.getMondayISO(dt)}

        async function loadEff() {
            const codes = Array.isArray(plants)?plants.map(p=>p.plant_code).filter(Boolean):[]
            if(!weekIso || codes.length===0){ if(!cancelled){ setEffReports([]); setAggReport(null) } return }
            const targetMondayIso = ReportUtility.getMondayISO(weekIso)
            if(!targetMondayIso){ if(!cancelled){ setEffReports([]); setAggReport(null) } return }
            const targetMondayDate = new Date(targetMondayIso+'T00:00:00Z')
            const prevSunday = new Date(targetMondayDate); prevSunday.setUTCDate(prevSunday.getUTCDate()-1)
            const windowEnd = new Date(targetMondayDate); windowEnd.setUTCDate(windowEnd.getUTCDate()+8) // include next Monday plus cushion day
            const qStart = prevSunday.toISOString()
            const qEnd = windowEnd.toISOString()
            const normU = s=>String(s||'').trim().toUpperCase()
            const normN = s=>{const t=String(s||'').trim();const d=t.replace(/^0+/,'');return d.length?d:t.toUpperCase()}
            const setU = new Set(codes.map(normU)); const setN = new Set(codes.map(normN))
            let {data: prod}= await supabase.from('reports').select('id,data,week,submitted_at,report_date_range_start,completed').eq('report_name','plant_production').gte('week', qStart).lt('week', qEnd)
            if(!Array.isArray(prod)) prod=[]
            // also pull by report_date_range_start if empty
            if(prod.length===0){ const resp= await supabase.from('reports').select('id,data,week,submitted_at,report_date_range_start,completed').eq('report_name','plant_production').gte('report_date_range_start', qStart).lt('report_date_range_start', qEnd); if(Array.isArray(resp.data)) prod=resp.data }
            function anchorMatches(r){
                const weekField = r.week || r.report_date_range_start || r?.data?.report_date
                const mondayIso = toMondayIso(weekField)
                return sameIsoDay(mondayIso, targetMondayIso)
            }
            const effRaw = prod.filter(anchorMatches).filter(r=>{ const pc=r?.data?.plant; if(!pc) return false; const u=normU(pc); const n=normN(pc); return setU.has(u)||setN.has(n) })
            const byPlant=new Map()
            effRaw.forEach(r=>{ const k=normU(r.data.plant); const prev=byPlant.get(k); if(!prev) byPlant.set(k,r); else { const take=(prev.completed!==r.completed)?(r.completed?r:prev):((prev.submitted_at||'')<(r.submitted_at||'')?r:prev); byPlant.set(k,take) }})
            const effFinal=[...byPlant.values()].sort((a,b)=>{ const da=String(a.data.plant||''); const db=String(b.data.plant||''); const na=parseInt(da.replace(/\D/g,''),10); const nb=parseInt(db.replace(/\D/g,''),10); const aN=Number.isFinite(na); const bN=Number.isFinite(nb); if(aN&&bN&&na!==nb) return na-nb; if(aN&&!bN) return -1; if(!aN&&bN) return 1; return da.localeCompare(db,undefined,{numeric:true,sensitivity:'base'}) })
            if(!cancelled){ setEffReports(effFinal.map(r=>({ id:r.id, plant_code:r.data.plant, plant_name:r.data.plant, report_date:r.data.report_date||'', rows:Array.isArray(r.data.rows)?r.data.rows:[], data:r.data, completed:r.completed, submitted_at:r.submitted_at }))); setEffIdx(0) }
            // aggregate
            let {data: agg}= await supabase.from('reports').select('id,data,week,report_date_range_start,completed,submitted_at').eq('report_name','aggregate_production').gte('week', qStart).lt('week', qEnd)
            if(!Array.isArray(agg)) agg=[]
            if(agg.length===0){ const resp= await supabase.from('reports').select('id,data,week,report_date_range_start,completed,submitted_at').eq('report_name','aggregate_production').gte('report_date_range_start', qStart).lt('report_date_range_start', qEnd); if(Array.isArray(resp.data)) agg=resp.data }
            const aggFiltered = agg.filter(anchorMatches)
            aggFiltered.sort((a,b)=>{ if(a.completed!==b.completed) return a.completed? -1:1; return (b.submitted_at||'').localeCompare(a.submitted_at||'') })
            const pick = aggFiltered.find(a=>a.completed) || aggFiltered[0] || null
            if(!cancelled) setAggReport(pick)
        }
        loadEff(); return ()=>{cancelled=true}
    }, [plants, weekIso])
    return (
        <div className="rpt-card rpt-card-accent">
            <div className="rpt-card-header">
                <div className="rpt-card-title">Status Overviews</div>
            </div>
            <div className="rpt-form-row rpt-flex-col rpt-gap-12">
                <div className="rpt-card rpt-p-12">
                    <div className="rpt-card-header">
                        <div className="rpt-card-title">Mixers</div>
                    </div>
                    <div className="rpt-stats">
                        <div className="rpt-stat-card">
                            <div className="rpt-stat-label">Total</div>
                            <div className="rpt-stat-value">{mxCounts.Total}</div>
                        </div>
                        <div className="rpt-stat-card">
                            <div className="rpt-stat-label">Active</div>
                            <div className="rpt-stat-value">{mxCounts.Active}</div>
                        </div>
                        <div className="rpt-stat-card">
                            <div className="rpt-stat-label">In Shop</div>
                            <div className="rpt-stat-value">{mxCounts['In Shop']}</div>
                        </div>
                        <div className="rpt-stat-card">
                            <div className="rpt-stat-label">Spare</div>
                            <div className="rpt-stat-value">{mxCounts.Spare}</div>
                        </div>
                    </div>
                </div>
                <div className="rpt-card rpt-p-12 rpt-mb-16">
                    <div className="rpt-card-header">
                        <div className="rpt-card-title">Operators</div>
                    </div>
                    <div className="rpt-stats">
                        <div className="rpt-stat-card">
                            <div className="rpt-stat-label">Total</div>
                            <div className="rpt-stat-value">{opCounts.Total}</div>
                        </div>
                        <div className="rpt-stat-card">
                            <div className="rpt-stat-label">Active</div>
                            <div className="rpt-stat-value">{opCounts.Active}</div>
                        </div>
                        <div className="rpt-stat-card">
                            <div className="rpt-stat-label">Light Duty</div>
                            <div className="rpt-stat-value">{opCounts['Light Duty']}</div>
                        </div>
                        <div className="rpt-stat-card">
                            <div className="rpt-stat-label">Pending Start</div>
                            <div className="rpt-stat-value">{opCounts['Pending Start']}</div>
                        </div>
                        <div className="rpt-stat-card">
                            <div className="rpt-stat-label">Training</div>
                            <div className="rpt-stat-value">{opCounts.Training}</div>
                        </div>
                        <div className="rpt-stat-card">
                            <div className="rpt-stat-label">Terminated</div>
                            <div className="rpt-stat-value">{opCounts.Terminated}</div>
                        </div>
                        <div className="rpt-stat-card">
                            <div className="rpt-stat-label">No Hire</div>
                            <div className="rpt-stat-value">{opCounts['No Hire']}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="rpt-card-header">
                <div className="rpt-card-title">Per-Plant Summary</div>
                {count > 0 && (
                    <div className="rpt-badge">{safeIdx + 1} of {count}</div>
                )}
            </div>
            {count === 0 ? (
                <div className="rpt-empty">No plants found.</div>
            ) : (
                <div className="rpt-form-row rpt-flex-col">
                    <div className="rpt-dots-bar">
                        {plants.map((p, i) => (
                            <div
                                key={p.plant_code}
                                onClick={() => setIdx(i)}
                                className={`rpt-dot ${i === safeIdx ? 'active' : ''}`}
                                aria-label={`Plant ${i + 1}`}
                            />
                        ))}
                    </div>
                    {(() => {
                        const p = plants[safeIdx]
                        const code = p.plant_code
                        const f = {
                            ops: `active_operators_${code}`,
                            runnable: `runnable_trucks_${code}`,
                            down: `down_trucks_${code}`,
                            starting: `operators_starting_${code}`,
                            leaving: `operators_leaving_${code}`,
                            training: `new_operators_training_${code}`,
                            yardage: `total_yardage_${code}`,
                            hours: `total_hours_${code}`,
                            notes: `notes_${code}`
                        }
                        return (
                            <div className="rpt-card rpt-p-16">
                                <div className="rpt-card-header">
                                    <div className="rpt-card-title">{p.plant_name} ({code})</div>
                                    <div className="rpt-card-actions">
                                        <button
                                            type="button"
                                            className="rpt-secondary-btn"
                                            onClick={() => setIdx(i => Math.max(i - 1, 0))}
                                            disabled={safeIdx === 0}
                                        >
                                            ← Prev Plant
                                        </button>
                                        <button
                                            type="button"
                                            className="rpt-primary-btn"
                                            onClick={() => setIdx(i => Math.min(i + 1, count - 1))}
                                            disabled={safeIdx === count - 1}
                                        >
                                            Next Plant →
                                        </button>
                                    </div>
                                </div>
                                <div className="rpt-form-row">
                                    <Field label="# of Operators" value={form[f.ops] ?? ''}
                                           onChange={e => set(f.ops, num(e.target.value))} required
                                           disabled={readOnly}/>
                                    <Field label="# of Runnable Trucks" value={form[f.runnable] ?? ''}
                                           onChange={e => set(f.runnable, num(e.target.value))} required
                                           disabled={readOnly}/>
                                    <Field label="Down Trucks" value={form[f.down] ?? ''}
                                           onChange={e => set(f.down, num(e.target.value))} required
                                           disabled={readOnly}/>
                                </div>
                                <div className="rpt-form-row">
                                    <Field label="Operators Starting" value={form[f.starting] ?? ''}
                                           onChange={e => set(f.starting, num(e.target.value))} required
                                           disabled={readOnly}/>
                                    <Field label="Operators Leaving" value={form[f.leaving] ?? ''}
                                           onChange={e => set(f.leaving, num(e.target.value))} required
                                           disabled={readOnly}/>
                                    <Field label="New Operators Training" value={form[f.training] ?? ''}
                                           onChange={e => set(f.training, num(e.target.value))} required
                                           disabled={readOnly}/>
                                    <Field label="Total Yardage" value={form[f.yardage] ?? ''}
                                           onChange={e => set(f.yardage, num(e.target.value))} required
                                           disabled={readOnly}/>
                                </div>
                                <div className="rpt-form-row">
                                    <Field label="Total Hours" value={form[f.hours] ?? ''}
                                           onChange={e => set(f.hours, num(e.target.value))} required
                                           disabled={readOnly}/>
                                </div>
                                <div className="rpt-form-row">
                                    <Field label="Notes" type="textarea" value={form[f.notes] ?? ''}
                                           onChange={e => set(f.notes, e.target.value)} required={false}
                                           disabled={readOnly}/>
                                </div>
                            </div>
                        )
                    })()}
                </div>
            )}
            <div className="rpt-card-header rpt-mt-16">
                <div className="rpt-card-title">Plant Efficiency Reports</div>
                {effReports.length > 0 && (
                    <div className="rpt-badge">{effIdx + 1} of {effReports.length}</div>
                )}
            </div>
            {effReports.length === 0 ? (
                <div className="rpt-empty">No plant efficiency reports found for this week.</div>
            ) : (
                <div className="rpt-form-row rpt-flex-col">
                    <div className="rpt-dots-bar">
                        {effReports.map((r, i) => (
                            <div
                                key={r.id}
                                onClick={() => setEffIdx(i)}
                                className={`rpt-dot ${i === effIdx ? 'active' : ''}`}
                                aria-label={`Efficiency Report ${i + 1}`}
                            />
                        ))}
                    </div>
                    {(() => {
                        const r = effReports[effIdx]
                        const insights = ReportService.getPlantProductionInsights(r.rows || [])
                        return (
                            <div className="rpt-card rpt-p-16">
                                <div className="rpt-card-header">
                                    <div className="rpt-card-title">{r.plant_name} ({r.plant_code}){r.report_date ? ` - ${r.report_date}` : ''}</div>
                                    <div className="rpt-card-actions">
                                        <button
                                            type="button"
                                            className="rpt-secondary-btn"
                                            onClick={() => setEffIdx(i => Math.max(i - 1, 0))}
                                            disabled={effIdx === 0}
                                        >
                                            ← Prev Report
                                        </button>
                                        <button
                                            type="button"
                                            className="rpt-primary-btn"
                                            onClick={() => setEffIdx(i => Math.min(i + 1, effReports.length - 1))}
                                            disabled={effIdx === effReports.length - 1}
                                        >
                                            Next Report →
                                        </button>
                                    </div>
                                </div>
                                <div className="rpt-stats">
                                    <div className="rpt-stat-card">
                                        <div className="rpt-stat-label">Total Loads</div>
                                        <div className="rpt-stat-value">{insights.totalLoads || 0}</div>
                                    </div>
                                    <div className="rpt-stat-card">
                                        <div className="rpt-stat-label">Total Hours</div>
                                        <div
                                            className="rpt-stat-value">{insights.totalHours !== null ? insights.totalHours.toFixed(2) : '--'}</div>
                                    </div>
                                    <div className="rpt-stat-card">
                                        <div className="rpt-stat-label">Avg Loads</div>
                                        <div
                                            className="rpt-stat-value">{insights.avgLoads !== null ? insights.avgLoads.toFixed(2) : '--'}</div>
                                    </div>
                                    <div className="rpt-stat-card">
                                        <div className="rpt-stat-label">Avg Hours</div>
                                        <div
                                            className="rpt-stat-value">{insights.avgHours !== null ? insights.avgHours.toFixed(2) : '--'}</div>
                                    </div>
                                    <div className="rpt-stat-card">
                                        <div className="rpt-stat-label">Avg L/H</div>
                                        <div
                                            className="rpt-stat-value">{insights.avgLoadsPerHour !== null ? insights.avgLoadsPerHour.toFixed(2) : '--'}</div>
                                    </div>
                                    <div className="rpt-stat-card">
                                        <div className="rpt-stat-label">Punch In → 1st</div>
                                        <div
                                            className="rpt-stat-value">{insights.avgElapsedStart !== null ? `${insights.avgElapsedStart.toFixed(1)} min` : '--'}</div>
                                    </div>
                                    <div className="rpt-stat-card">
                                        <div className="rpt-stat-label">Washout → Punch</div>
                                        <div
                                            className="rpt-stat-value">{insights.avgElapsedEnd !== null ? `${insights.avgElapsedEnd.toFixed(1)} min` : '--'}</div>
                                    </div>
                                </div>
                            </div>
                        )
                    })()}
                    <div className="rpt-card rpt-p-16">
                        <div className="rpt-card-header">
                            <div className="rpt-card-title">Aggregate Production</div>
                        </div>
                        {aggReport ? (
                            <div className="rpt-stats">
                                {reportTypeMap.aggregate_production.fields.map(f => (
                                    <div className="rpt-stat-card" key={f.name}>
                                        <div className="rpt-stat-label">{f.label}</div>
                                        <div className="rpt-stat-value">{aggReport.data?.[f.name] ?? 0}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rpt-empty">No aggregate production report found.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export function GeneralManagerReviewPlugin({form, plants = [], weekIso}) {
    const included = Array.isArray(plants) ? plants.filter(p => {
        const code = p.plant_code
        const keys = [
            `active_operators_${code}`,
            `runnable_trucks_${code}`,
            `down_trucks_${code}`,
            `operators_starting_${code}`,
            `operators_leaving_${code}`,
            `new_operators_training_${code}`,
            `total_yardage_${code}`,
            `total_hours_${code}`,
            `notes_${code}`
        ]
        return keys.some(k => form[k] !== undefined && form[k] !== '')
    }) : []
    const [opCounts, setOpCounts] = React.useState({
        Total: 0,
        Active: 0,
        'Light Duty': 0,
        'Pending Start': 0,
        Training: 0,
        Terminated: 0,
        'No Hire': 0
    })
    const [mxCounts, setMxCounts] = React.useState({Total: 0, Active: 0, Spare: 0, 'In Shop': 0})
    const [effIdx, setEffIdx] = React.useState(0)
    const [effReports, setEffReports] = React.useState([])
    const [aggReport, setAggReport] = React.useState(null)
    const [weekRangeLabel, setWeekRangeLabel] = React.useState('')

    function normUpper(code) {
        return String(code || '').trim().toUpperCase()
    }

    function normNumeric(code) {
        const s = String(code || '').trim();
        const d = s.replace(/^0+/, '');
        return d.length ? d : s.toUpperCase()
    }

    React.useEffect(() => {
        const w = weekIso || form?.week
        if (w) {
            const iso = ReportUtility.getMondayISO(w)
            const label = ReportService.getWeekRangeFromIso(iso)
            setWeekRangeLabel(label)
            console.log('GM Report Week (Review):', w, 'Range:', label)
        } else {
            setWeekRangeLabel('')
            console.log('GM Report Week (Review): none')
        }
    }, [weekIso, form?.week])
    React.useEffect(() => {
        let cancelled = false

        async function load() {
            const codes = Array.isArray(plants) ? plants.map(p => p.plant_code).filter(Boolean) : []
            if (codes.length === 0) {
                if (!cancelled) {
                    setOpCounts({
                        Total: 0,
                        Active: 0,
                        'Light Duty': 0,
                        'Pending Start': 0,
                        Training: 0,
                        Terminated: 0,
                        'No Hire': 0
                    })
                    setMxCounts({Total: 0, Active: 0, Spare: 0, 'In Shop': 0})
                }
                return
            }
            const {data: mxData} = await supabase.from('mixers').select('status, assigned_plant').in('assigned_plant', codes)
            if (!cancelled) {
                if (Array.isArray(mxData)) {
                    const c = {Total: 0, Active: 0, Spare: 0, 'In Shop': 0}
                    const filtered = mxData.filter(m => (m.status || '') !== 'Retired')
                    c.Total = filtered.length
                    filtered.forEach(m => {
                        const s = m.status || '';
                        if (s in c) c[s] += 1
                    })
                    setMxCounts(c)
                } else {
                    setMxCounts({Total: 0, Active: 0, Spare: 0, 'In Shop': 0})
                }
            }
            const {data: opsData} = await supabase.from('operators').select('status, position, plant_code').in('plant_code', codes)
            if (!cancelled) {
                if (Array.isArray(opsData)) {
                    const c = {
                        Total: 0,
                        Active: 0,
                        'Light Duty': 0,
                        'Pending Start': 0,
                        Training: 0,
                        Terminated: 0,
                        'No Hire': 0
                    }
                    c.Total = opsData.length
                    opsData.forEach(op => {
                        const s = op.status || '';
                        if (s in c) c[s] += 1
                    })
                    setOpCounts(c)
                } else {
                    setOpCounts({
                        Total: 0,
                        Active: 0,
                        'Light Duty': 0,
                        'Pending Start': 0,
                        Training: 0,
                        Terminated: 0,
                        'No Hire': 0
                    })
                }
            }
        }

        load();
        return () => {
            cancelled = true
        }
    }, [plants])
    React.useEffect(() => {
        let cancelled = false
        function sameIsoDay(a,b){return a&&b&&a.slice(0,10)===b.slice(0,10)}
        function toMondayIso(d){ if(!d) return ''; const dt=new Date(d); if(isNaN(dt)) return ''; return ReportUtility.getMondayISO(dt)}

        async function loadEffAndAgg() {
            const codes = Array.isArray(plants) ? plants.map(p => p.plant_code).filter(Boolean) : []
            if (!weekIso || codes.length === 0) { if(!cancelled){ setEffReports([]); setAggReport(null) } return }
            const targetMondayIso = ReportUtility.getMondayISO(weekIso)
            if(!targetMondayIso){ if(!cancelled){ setEffReports([]); setAggReport(null) } return }
            const targetMondayDate = new Date(targetMondayIso+'T00:00:00Z')
            const prevSunday = new Date(targetMondayDate); prevSunday.setUTCDate(prevSunday.getUTCDate()-1)
            const windowEnd = new Date(targetMondayDate); windowEnd.setUTCDate(windowEnd.getUTCDate()+8)
            const qStart = prevSunday.toISOString(); const qEnd = windowEnd.toISOString()
            const normU=s=>String(s||'').trim().toUpperCase(); const normN=s=>{const t=String(s||'').trim();const d=t.replace(/^0+/,'');return d.length?d:t.toUpperCase()}; const setU=new Set(codes.map(normU)); const setN=new Set(codes.map(normN))
            let {data: prod}= await supabase.from('reports').select('id,data,week,submitted_at,report_date_range_start,completed').eq('report_name','plant_production').gte('week', qStart).lt('week', qEnd)
            if(!Array.isArray(prod)) prod=[]
            if(prod.length===0){ const resp= await supabase.from('reports').select('id,data,week,submitted_at,report_date_range_start,completed').eq('report_name','plant_production').gte('report_date_range_start', qStart).lt('report_date_range_start', qEnd); if(Array.isArray(resp.data)) prod=resp.data }
            function anchorMatches(r){ const weekField = r.week || r.report_date_range_start || r?.data?.report_date; const mondayIso = toMondayIso(weekField); return sameIsoDay(mondayIso, targetMondayIso) }
            const effRaw = prod.filter(anchorMatches).filter(r=>{ const pc=r?.data?.plant; if(!pc) return false; const u=normU(pc); const n=normN(pc); return setU.has(u)||setN.has(n) })
            const byPlant=new Map(); effRaw.forEach(r=>{ const k=normU(r.data.plant); const prev=byPlant.get(k); if(!prev) byPlant.set(k,r); else { const take=(prev.completed!==r.completed)?(r.completed?r:prev):((prev.submitted_at||'')<(r.submitted_at||'')?r:prev); byPlant.set(k,take) }})
            const effFinal=[...byPlant.values()].sort((a,b)=>{ const da=String(a.data.plant||''); const db=String(b.data.plant||''); const na=parseInt(da.replace(/\D/g,''),10); const nb=parseInt(db.replace(/\D/g,''),10); const aN=Number.isFinite(na); const bN=Number.isFinite(nb); if(aN&&bN&&na!==nb) return na-nb; if(aN&&!bN) return -1; if(!aN&&bN) return 1; return da.localeCompare(db,undefined,{numeric:true,sensitivity:'base'}) })
            if(!cancelled){ setEffReports(effFinal.map(r=>({ id:r.id, plant_code:r.data.plant, plant_name:r.data.plant, report_date:r.data.report_date||'', rows:Array.isArray(r.data.rows)?r.data.rows:[], data:r.data, completed:r.completed, submitted_at:r.submitted_at }))); setEffIdx(0) }
            let {data: agg}= await supabase.from('reports').select('id,data,week,report_date_range_start,completed,submitted_at').eq('report_name','aggregate_production').gte('week', qStart).lt('week', qEnd)
            if(!Array.isArray(agg)) agg=[]
            if(agg.length===0){ const resp= await supabase.from('reports').select('id,data,week,report_date_range_start,completed,submitted_at').eq('report_name','aggregate_production').gte('report_date_range_start', qStart).lt('report_date_range_start', qEnd); if(Array.isArray(resp.data)) agg=resp.data }
            const aggFiltered = agg.filter(anchorMatches)
            aggFiltered.sort((a,b)=>{ if(a.completed!==b.completed) return a.completed? -1:1; return (b.submitted_at||'').localeCompare(a.submitted_at||'') })
            const pick = aggFiltered.find(a=>a.completed) || aggFiltered[0] || null
            if(!cancelled) setAggReport(pick)
        }
        loadEffAndAgg(); return ()=>{cancelled=true}
    }, [plants, weekIso])
    if (included.length === 0 && effReports.length === 0) return (<div className="rpt-empty">No data in this report.</div>)
    return (
        <div className="rpt-card rpt-card-accent">
            <div className="rpt-card-header">
                <div className="rpt-card-title">Status Overviews</div>
            </div>
            <div className="rpt-form-row rpt-flex-col rpt-gap-12">
                <div className="rpt-card rpt-p-12">
                    <div className="rpt-card-header"><div className="rpt-card-title">Mixers</div></div>
                    <div className="rpt-stats">
                        <div className="rpt-stat-card"><div className="rpt-stat-label">Total</div><div className="rpt-stat-value">{mxCounts.Total}</div></div>
                        <div className="rpt-stat-card"><div className="rpt-stat-label">Active</div><div className="rpt-stat-value">{mxCounts.Active}</div></div>
                        <div className="rpt-stat-card"><div className="rpt-stat-label">In Shop</div><div className="rpt-stat-value">{mxCounts['In Shop']}</div></div>
                        <div className="rpt-stat-card"><div className="rpt-stat-label">Spare</div><div className="rpt-stat-value">{mxCounts.Spare}</div></div>
                    </div>
                </div>
                <div className="rpt-card rpt-p-12 rpt-mb-16">
                    <div className="rpt-card-header"><div className="rpt-card-title">Operators</div></div>
                    <div className="rpt-stats">
                        <div className="rpt-stat-card"><div className="rpt-stat-label">Total</div><div className="rpt-stat-value">{opCounts.Total}</div></div>
                        <div className="rpt-stat-card"><div className="rpt-stat-label">Active</div><div className="rpt-stat-value">{opCounts.Active}</div></div>
                        <div className="rpt-stat-card"><div className="rpt-stat-label">Light Duty</div><div className="rpt-stat-value">{opCounts['Light Duty']}</div></div>
                        <div className="rpt-stat-card"><div className="rpt-stat-label">Pending Start</div><div className="rpt-stat-value">{opCounts['Pending Start']}</div></div>
                        <div className="rpt-stat-card"><div className="rpt-stat-label">Training</div><div className="rpt-stat-value">{opCounts.Training}</div></div>
                        <div className="rpt-stat-card"><div className="rpt-stat-label">Terminated</div><div className="rpt-stat-value">{opCounts.Terminated}</div></div>
                        <div className="rpt-stat-card"><div className="rpt-stat-label">No Hire</div><div className="rpt-stat-value">{opCounts['No Hire']}</div></div>
                    </div>
                </div>
            </div>
            {included.length > 0 && (<div className="rpt-card-header"><div className="rpt-card-title">Per-Plant Summary</div><div className="rpt-badge">{included.length} plants</div></div>)}
            {included.length === 0 ? null : (
                <div className="rpt-form-row rpt-flex-col">
                    {included.map(p => { const code = p.plant_code; const f = { ops: `active_operators_${code}`, runnable: `runnable_trucks_${code}`, down: `down_trucks_${code}`, starting: `operators_starting_${code}`, leaving: `operators_leaving_${code}`, training: `new_operators_training_${code}`, yardage: `total_yardage_${code}`, hours: `total_hours_${code}`, notes: `notes_${code}` }; return (
                        <div className="rpt-card rpt-p-16" key={code}>
                            <div className="rpt-card-header"><div className="rpt-card-title">{p.plant_name} ({code})</div></div>
                            <div className="rpt-form-row"><Field label="# of Operators" value={form[f.ops] ?? ''} onChange={()=>{}} required disabled/><Field label="# of Runnable Trucks" value={form[f.runnable] ?? ''} onChange={()=>{}} required disabled/><Field label="Down Trucks" value={form[f.down] ?? ''} onChange={()=>{}} required disabled/></div>
                            <div className="rpt-form-row"><Field label="Operators Starting" value={form[f.starting] ?? ''} onChange={()=>{}} required disabled/><Field label="Operators Leaving" value={form[f.leaving] ?? ''} onChange={()=>{}} required disabled/><Field label="New Operators Training" value={form[f.training] ?? ''} onChange={()=>{}} required disabled/><Field label="Total Yardage" value={form[f.yardage] ?? ''} onChange={()=>{}} required disabled/></div>
                            <div className="rpt-form-row"><Field label="Total Hours" value={form[f.hours] ?? ''} onChange={()=>{}} required disabled/></div>
                            {form[f.notes] ? (<div className="rpt-form-row"><Field label="Notes" type="textarea" value={form[f.notes] ?? ''} onChange={()=>{}} required={false} disabled/></div>) : null}
                        </div>
                    ) })}
                </div>
            )}
            <div className="rpt-card-header rpt-mt-16"><div className="rpt-card-title">Plant Efficiency Reports</div>{effReports.length > 0 && (<div className="rpt-badge">{effIdx + 1} of {effReports.length}</div>)}</div>
            {effReports.length === 0 ? (<div className="rpt-empty">No plant efficiency reports found for this week.</div>) : (
                <div className="rpt-form-row rpt-flex-col">
                    <div className="rpt-dots-bar">{effReports.map((r,i)=>(<div key={r.id} onClick={()=>setEffIdx(i)} className={`rpt-dot ${i===effIdx?'active':''}`} aria-label={`Efficiency Report ${i+1}`}></div>))}</div>
                    {(() => { const r = effReports[effIdx]; const insights = ReportService.getPlantProductionInsights(r.rows || []); return (
                        <div className="rpt-card rpt-p-16">
                            <div className="rpt-card-header"><div className="rpt-card-title">{r.plant_name} ({r.plant_code}){r.report_date ? ` - ${r.report_date}` : ''}</div><div className="rpt-card-actions"><button type="button" className="rpt-secondary-btn" onClick={()=>setEffIdx(i=>Math.max(i-1,0))} disabled={effIdx===0}>← Prev Report</button><button type="button" className="rpt-primary-btn" onClick={()=>setEffIdx(i=>Math.min(i+1,effReports.length-1))} disabled={effIdx===effReports.length-1}>Next Report →</button></div></div>
                            <div className="rpt-stats"><div className="rpt-stat-card"><div className="rpt-stat-label">Total Loads</div><div className="rpt-stat-value">{insights.totalLoads || 0}</div></div><div className="rpt-stat-card"><div className="rpt-stat-label">Total Hours</div><div className="rpt-stat-value">{insights.totalHours !== null ? insights.totalHours.toFixed(2) : '--'}</div></div><div className="rpt-stat-card"><div className="rpt-stat-label">Avg Loads</div><div className="rpt-stat-value">{insights.avgLoads !== null ? insights.avgLoads.toFixed(2) : '--'}</div></div><div className="rpt-stat-card"><div className="rpt-stat-label">Avg Hours</div><div className="rpt-stat-value">{insights.avgHours !== null ? insights.avgHours.toFixed(2) : '--'}</div></div><div className="rpt-stat-card"><div className="rpt-stat-label">Avg L/H</div><div className="rpt-stat-value">{insights.avgLoadsPerHour !== null ? insights.avgLoadsPerHour.toFixed(2) : '--'}</div></div><div className="rpt-stat-card"><div className="rpt-stat-label">Punch In → 1st</div><div className="rpt-stat-value">{insights.avgElapsedStart !== null ? `${insights.avgElapsedStart.toFixed(1)} min` : '--'}</div></div><div className="rpt-stat-card"><div className="rpt-stat-label">Washout → Punch</div><div className="rpt-stat-value">{insights.avgElapsedEnd !== null ? `${insights.avgElapsedEnd.toFixed(1)} min` : '--'}</div></div></div>
                        </div>
                    ) })()}
                    <div className="rpt-card rpt-p-16"><div className="rpt-card-header"><div className="rpt-card-title">Aggregate Production</div></div>{aggReport ? (<div className="rpt-stats">{reportTypeMap.aggregate_production.fields.map(f => (<div className="rpt-stat-card" key={f.name}><div className="rpt-stat-label">{f.label}</div><div className="rpt-stat-value">{aggReport.data?.[f.name] ?? 0}</div></div>))}</div>) : (<div className="rpt-empty">No aggregate production report found.</div>)}</div>
                </div>
            )}
        </div>
    )
}
