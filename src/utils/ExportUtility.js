import {supabase} from '../services/DatabaseService'
import {ReportService} from '../services/ReportService'
import {ReportUtility} from './ReportUtility'
import SmyrnaLogo from '../assets/images/SmyrnaLogo.png'

function normUpper(code) { return String(code || '').trim().toUpperCase() }
function normNumeric(code) { const s = String(code || '').trim(); const d = s.replace(/^0+/, ''); return d.length ? d : s.toUpperCase() }
function sameIsoDay(a,b){ return a && b && a.slice(0,10)===b.slice(0,10) }
function toMondayIso(d){ if(!d) return ''; const dt=new Date(d); if(isNaN(dt)) return ''; return ReportUtility.getMondayISO(dt) }

async function fetchEfficiencyReports(plants, weekIso) {
    const codes = Array.isArray(plants) ? plants.map(p => p.plant_code).filter(Boolean) : []
    if (!weekIso || codes.length === 0) return []
    const targetMondayIso = ReportUtility.getMondayISO(weekIso)
    if(!targetMondayIso) return []
    const targetMondayDate = new Date(targetMondayIso+'T00:00:00Z')
    const prevSunday = new Date(targetMondayDate); prevSunday.setUTCDate(prevSunday.getUTCDate()-1)
    const windowEnd = new Date(targetMondayDate); windowEnd.setUTCDate(windowEnd.getUTCDate()+8)
    const qStart = prevSunday.toISOString(); const qEnd = windowEnd.toISOString()
    let {data: byWeek} = await supabase.from('reports').select('id,data,week,submitted_at,report_date_range_start,completed').eq('report_name','plant_production').gte('week', qStart).lt('week', qEnd)
    if(!Array.isArray(byWeek)) byWeek=[]
    let {data: byRange} = await supabase.from('reports').select('id,data,week,submitted_at,report_date_range_start,completed').eq('report_name','plant_production').gte('report_date_range_start', qStart).lt('report_date_range_start', qEnd)
    if(!Array.isArray(byRange)) byRange=[]
    const mergedMap = new Map()
    ;[...byWeek,...byRange].forEach(r=>{ if(r && !mergedMap.has(r.id)) mergedMap.set(r.id,r) })
    const all = [...mergedMap.values()]
    function anchorMatches(r){ const weekField = r.week || r.report_date_range_start || r?.data?.report_date; const mondayIso = toMondayIso(weekField); return sameIsoDay(mondayIso,targetMondayIso) }
    const codeSetU = new Set(codes.map(normUpper)); const codeSetN = new Set(codes.map(normNumeric))
    const filtered = all.filter(anchorMatches).filter(r=>{ const pc=r?.data?.plant; if(!pc) return false; const u=normUpper(pc); const n=normNumeric(pc); return codeSetU.has(u)||codeSetN.has(n) })
    const byPlant = new Map()
    filtered.forEach(r=>{ const pc=r?.data?.plant; const key=normUpper(pc); const prev=byPlant.get(key); if(!prev) byPlant.set(key,r); else { const take=(prev.completed!==r.completed)?(r.completed?r:prev):((prev.submitted_at||'')<(r.submitted_at||'')?r:prev); byPlant.set(key,take) }})
    const final = [...byPlant.values()].sort((a,b)=>{ const da=String(a.data?.plant||''); const db=String(b.data?.plant||''); const na=parseInt(da.replace(/\D/g,''),10); const nb=parseInt(db.replace(/\D/g,''),10); const aN=Number.isFinite(na); const bN=Number.isFinite(nb); if(aN&&bN&&na!==nb) return na-nb; if(aN&&!bN) return -1; if(!aN&&bN) return 1; return da.localeCompare(db,undefined,{numeric:true,sensitivity:'base'}) })
    return final.map(r=>({ id:r.id, plant_code:r.data.plant, plant_name:r.data.plant, report_date:r.data.report_date||'', rows:Array.isArray(r.data.rows)?r.data.rows:[], data:r.data, completed:r.completed, submitted_at:r.submitted_at }))
}

function getCssVarHex(name, fallback) {
    try { if (typeof window === 'undefined') return fallback; const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); if (!v) return fallback; let hex = v; if (/^rgb/i.test(v)) { const nums = v.replace(/rgba?\(/,'').replace(/\)/,'').split(',').map(x=>parseInt(x.trim())); hex = '#'+nums.slice(0,3).map(n=>n.toString(16).padStart(2,'0')).join('') } return /^#([0-9a-f]{6})$/i.test(hex)?hex:fallback } catch(e){ return fallback }
}
function hexToARGB(hex) { const h = hex.replace('#',''); return 'FF'+h.toUpperCase() }
function halfStep(n) { if (typeof n !== 'number' || !isFinite(n)) return n; return Math.round(n*2)/2 }
function formatNumericCell(cell) { if (typeof cell.value === 'number') { cell.value = halfStep(cell.value); if (Math.abs(cell.value - Math.round(cell.value)) < 1e-9) cell.numFmt = '#,##0'; else cell.numFmt = '#,##0.0' } }

async function fetchAggregateProductionReport(weekIso) {
    if (!weekIso) return null
    const targetMondayIso = ReportUtility.getMondayISO(weekIso)
    if(!targetMondayIso) return null
    const targetMondayDate = new Date(targetMondayIso+'T00:00:00Z')
    const prevSunday = new Date(targetMondayDate); prevSunday.setUTCDate(prevSunday.getUTCDate()-1)
    const windowEnd = new Date(targetMondayDate); windowEnd.setUTCDate(windowEnd.getUTCDate()+8)
    const qStart = prevSunday.toISOString(); const qEnd = windowEnd.toISOString()
    let {data: byWeek} = await supabase.from('reports').select('id,data,week,report_date_range_start,completed,submitted_at').eq('report_name','aggregate_production').gte('week', qStart).lt('week', qEnd)
    if(!Array.isArray(byWeek)) byWeek=[]
    let {data: byRange} = await supabase.from('reports').select('id,data,week,report_date_range_start,completed,submitted_at').eq('report_name','aggregate_production').gte('report_date_range_start', qStart).lt('report_date_range_start', qEnd)
    if(!Array.isArray(byRange)) byRange=[]
    const merged = new Map(); [...byWeek,...byRange].forEach(r=>{ if(r && !merged.has(r.id)) merged.set(r.id,r) })
    function anchorMatches(r){ const weekField = r.week || r.report_date_range_start || r?.data?.report_date; const mondayIso = toMondayIso(weekField); return sameIsoDay(mondayIso,targetMondayIso) }
    const filtered=[...merged.values()].filter(anchorMatches)
    filtered.sort((a,b)=>{ if(a.completed!==b.completed) return a.completed? -1:1; return (b.submitted_at||'').localeCompare(a.submitted_at||'') })
    return filtered.find(r=>r.completed)||filtered[0]||null
}

function truncateToTenth(n) { if (typeof n !== 'number' || !isFinite(n)) return n; const sign = n < 0 ? -1 : 1; const abs = Math.abs(n); return sign * Math.floor(abs * 10) / 10 }
function sortPlants(plants) { return [...plants].sort((a,b)=>{ const ac=String(a.plant_code||'').trim(); const bc=String(b.plant_code||'').trim(); const an=/^[0-9]+$/.test(ac)?parseInt(ac,10):NaN; const bn=/^[0-9]+$/.test(bc)?parseInt(bc,10):NaN; if(!isNaN(an)&&!isNaN(bn)) return an-bn; if(!isNaN(an)&&isNaN(bn)) return -1; if(isNaN(an)&&!isNaN(bn)) return 1; return ac.localeCompare(bc,undefined,{numeric:true,sensitivity:'base'}) }) }

export async function exportGeneralManagerReport({form, plants, weekIso, filename = 'general_manager_report.xlsx'}) {
    if (typeof window === 'undefined') return
    const accentHex = getCssVarHex('--accent', '#003896')
    const dataBgHex = getCssVarHex('--bg-secondary', '#f4f6f4')
    const accentARGB = hexToARGB(accentHex)
    const dataARGB = hexToARGB(dataBgHex)
    const excelModule = await import('exceljs')
    const ExcelLib = excelModule.default || excelModule
    const effReports = await fetchEfficiencyReports(plants, weekIso)
    const wb = new ExcelLib.Workbook()
    wb.created = new Date()
    wb.properties.subject = 'Weekly General Manager Report'
    const ws = wb.addWorksheet('GM Summary')
    ws.views = [{state: 'normal', showGridLines: false}]
    ws.mergeCells('A1:B1'); ws.mergeCells('D1:E5')
    try { const logoResp = await fetch(SmyrnaLogo); const logoBlob = await logoResp.blob(); const base64 = await new Promise((res,rej)=>{ const reader=new FileReader(); reader.onloadend=()=>res(String(reader.result).split(',')[1]); reader.onerror=rej; reader.readAsDataURL(logoBlob) }); const imageId = wb.addImage({base64,extension:'png'}); ws.addImage(imageId,'D1:E5') } catch(e) {}
    for (let i=1;i<=5;i++) ws.getRow(i).height=22
    ws.getColumn(4).width=18; ws.getColumn(5).width=18
    const weekRange = weekIso ? ReportService.getWeekRangeFromIso(ReportUtility.getMondayISO(weekIso)) : ''
    function header(cell,value){ cell.value=value; cell.font={bold:true,color:{argb:'FFFFFFFF'}}; cell.alignment={vertical:'middle',horizontal:'left'}; cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:accentARGB}} }
    function right(cell){ cell.alignment={horizontal:'right',vertical:'middle'} }
    function fillDataCell(cell){ cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:dataARGB}} }
    function ensure(value,isNumeric){ if(isNumeric){ return (value===null||value===undefined||value==='')?0:value } return (value===null||value===undefined||value==='')?'Unknown':value }
    const sortedPlants = sortPlants(plants)
    let r=1
    header(ws.getCell(r,1),'General Manager Weekly Report'); ws.getCell(r,1).font={bold:true,size:16,color:{argb:'FFFFFFFF'}}; r++
    if(weekRange){ header(ws.getCell(r,1),weekRange); ws.getCell(r,1).font={italic:true,bold:true,color:{argb:'FFFFFFFF'}}; r++ }
    ws.getCell(r,1).value = `Generated ${new Date().toLocaleString()}`; ws.getCell(r,1).font={size:10,color:{argb:accentARGB}}; r+=2
    header(ws.getCell(r,1),'Per-Plant Summary'); r+=2
    const plantHeader=['Plant Code','Plant Name','# Operators','Runnable','Down','Starting','Leaving','Training','Total Yardage','Total Hours','Notes']
    plantHeader.forEach((h,idx)=>header(ws.getCell(r,idx+1),h)); r++
    sortedPlants.forEach(p=>{ const rowVals=[ ensure(p.plant_code,false), ensure(p.plant_name,false), ensure(form[`active_operators_${p.plant_code}`],true), ensure(form[`runnable_trucks_${p.plant_code}`],true), ensure(form[`down_trucks_${p.plant_code}`],true), ensure(form[`operators_starting_${p.plant_code}`],true), ensure(form[`operators_leaving_${p.plant_code}`],true), ensure(form[`new_operators_training_${p.plant_code}`],true), ensure(form[`total_yardage_${p.plant_code}`],true), ensure(form[`total_hours_${p.plant_code}`],true), ensure(form[`notes_${p.plant_code}`],false) ]; rowVals.forEach((v,i)=>{ const c=ws.getCell(r,i+1); c.value=v; if(i>=2&&i<=9&&typeof v==='number') right(c); fillDataCell(c) }); r++ })
    for(let rowIdx=1;rowIdx<r;rowIdx++){ const row=ws.getRow(rowIdx); [9,10].forEach(ci=>{ const cell=row.getCell(ci); if(typeof cell.value==='number'){ if(ci===9) cell.numFmt='#,##0'; if(ci===10) cell.numFmt='#,##0.00' }}) }
    r+=1; header(ws.getCell(r,1),'Plant Efficiency Overview'); r+=2
    const effHeader=['Plant Code','Plant Name','Report Date','Total Loads','Total Hours','Avg Loads','Avg Hours','Avg L/H','Punch In → 1st (min)','Washout → Punch (min)']; effHeader.forEach((h,idx)=>header(ws.getCell(r,idx+1),h)); r++
    const sortedEffReports = sortPlants(effReports)
    sortedEffReports.forEach(er=>{ const insights=ReportService.getPlantProductionInsights(er.rows||[]); const vals=[ ensure(er.plant_code,false), ensure(er.plant_name,false), ensure(er.report_date,false), ensure(insights.totalLoads,true), ensure(insights.totalHours,true), ensure(insights.avgLoads,true), ensure(insights.avgHours,true), ensure(insights.avgLoadsPerHour,true), ensure(insights.avgElapsedStart,true), ensure(insights.avgElapsedEnd,true) ]; vals.forEach((v,i)=>{ const c=ws.getCell(r,i+1); if(typeof v==='number'){ if(i===3){ c.value=v; c.numFmt='#,##0' } else if(i>=4 && i<=9){ c.value=truncateToTenth(v); c.numFmt='#,##0.0' } else { c.value=v } } else { c.value=v } fillDataCell(c) }); r++ })
    if(effReports.length){ r+=1; header(ws.getCell(r,1),'Aggregate Production'); r+=2; const aggregateReport=await fetchAggregateProductionReport(weekIso); const aggFields=[ ['sand','Sand'],['fill_dirt','Fill Dirt'],['black_dirt','Black Dirt'],['select_fill','Select Fill'],['crushed_concrete','Crushed Concrete'],['three_by_five_crushed','3 x 5 Crushed'],['stabilized_sand','Stabilized Sand'],['stabilized_crushed_concrete','Stabilized Crushed Concrete'],['beach_quality_sand','Beach Quality Sand'],['limestone_one_inch','Limestone - 1"'],['white_screened_sand','White Screened Sand'],['pea_gravel_three_eighths','3/8" Pea Gravel'],['crushed_asphalt','Crushed Asphalt'],['screened_sand','Screened Sand'],['washout','Washout'],['paverstone_base','Paverstone Base'],['rip_rap','Rip Rap'] ]; header(ws.getCell(r,1),'Material'); header(ws.getCell(r,2),'Value'); r++; const dataSource=aggregateReport?.data||{}; aggFields.forEach(([key,label])=>{ const cellLabel=ws.getCell(r,1); const cellVal=ws.getCell(r,2); cellLabel.value=label; let raw=dataSource[key]; raw=raw===undefined||raw===null||raw===''?0:raw; cellVal.value=ensure(Number(raw),true); fillDataCell(cellLabel); fillDataCell(cellVal); right(cellVal); formatNumericCell(cellVal); r++ }); const materialTotals={}; effReports.forEach(er=>{ const d=er.data||{}; const mats=d.materials||d.material_breakdown; if(mats&&typeof mats==='object'){ Object.entries(mats).forEach(([k,val])=>{ const num=Number(val); if(!isNaN(num)) materialTotals[k]=(materialTotals[k]||0)+num }) } (er.rows||[]).forEach(row=>{ const m=row.material||row.mix; if(m){ const loads=Number(row.loads)||0; materialTotals[m]=(materialTotals[m]||0)+loads } }) }); const materialKeys=Object.keys(materialTotals).filter(k=>materialTotals[k]!==0); if(materialKeys.length){ r+=1; header(ws.getCell(r,1),'Efficiency Material Breakdown'); r+=1; header(ws.getCell(r,1),'Material'); header(ws.getCell(r,2),'Value'); r++; materialKeys.sort().forEach(k=>{ const nameCell=ws.getCell(r,1); const valCell=ws.getCell(r,2); nameCell.value=k; valCell.value=halfStep(materialTotals[k]); right(valCell); fillDataCell(nameCell); fillDataCell(valCell); formatNumericCell(valCell); r++ }) } }
    ws.columns.forEach((col,idx)=>{ let max=0; col.eachCell({includeEmpty:false},c=>{ const len=String(c.value||'').length; if(len>max) max=len }); col.width=Math.min(Math.max(max+2,10), idx===10||idx===11?50:28) })
    ws.getColumn(4).width=18; ws.getColumn(5).width=18
    const notesIdx = plantHeader.indexOf('Notes')+1; if(notesIdx>0) ws.getColumn(notesIdx).alignment={vertical:'top',wrapText:true}
    ws.eachRow(row=>row.eachCell(cell=>{ cell.border=undefined }))
    ws.eachRow(row=>row.eachCell(cell=>{ const a=cell.alignment||{}; cell.alignment={...a,horizontal:'left'} }))
    const buf = await wb.xlsx.writeBuffer(); const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(url); a.remove() },0)
}
