import React, {useEffect, useState} from 'react'
import './styles/ReportsSubmitView.css'
import './styles/ReportsReviewView.css'
import {supabase} from '../../../services/DatabaseService'
import {UserService} from '../../../services/UserService'
import {ReportService} from '../../../services/ReportService'
import {PlantManagerReviewPlugin} from './plugins/WeeklyPlantManagerReportPlugin'
import {DistrictManagerReviewPlugin} from './plugins/WeeklyDistrictManagerReportPlugin'
import {PlantProductionReviewPlugin} from './plugins/WeeklyPlantProductionReportPlugin'

const plugins = {
    plant_manager: PlantManagerReviewPlugin,
    district_manager: DistrictManagerReviewPlugin,
    plant_production: PlantProductionReviewPlugin
}

function formatDateTime(dt) {
    if (!dt) return ''
    const date = new Date(dt)
    return date.toLocaleString()
}
function ReportsReviewView({report, initialData, onBack, user, completedByUser, onManagerEdit}) {
    const [form, setForm] = useState(initialData?.data || initialData || {})
    const [maintenanceItems, setMaintenanceItems] = useState([])
    const [ownerName, setOwnerName] = useState('')
    const [weekRange, setWeekRange] = useState('')
    const [submittedAt, setSubmittedAt] = useState('')
    const [summaryTab, setSummaryTab] = useState('summary')
    const [operatorOptions, setOperatorOptions] = useState([])
    const [assignedPlant, setAssignedPlant] = useState('')
    const [hasManagerEditPermission, setHasManagerEditPermission] = useState(false)
    const [showManagerEditButton, setShowManagerEditButton] = useState(false)
    const [, setPlants] = useState([])

    useEffect(() => {
        async function fetchOwnerName() {
            const ownerId = completedByUser?.id || initialData?.user_id || report?.userId || user?.id
            if (!ownerId) {
                setOwnerName('')
                return
            }
            const name = completedByUser && (completedByUser.first_name || completedByUser.last_name)
                ? `${completedByUser.first_name || ''} ${completedByUser.last_name || ''}`.trim()
                : await UserService.getUserDisplayName(ownerId) || ownerId.slice(0, 8)
            setOwnerName(name)
        }

        fetchOwnerName()
    }, [report, user, initialData, completedByUser])

    useEffect(() => {
        let weekIso = report.weekIso || initialData?.week
        if (weekIso) {
            setWeekRange(ReportService.getWeekRangeFromIso(weekIso))
        } else if (report.report_date_range_start && report.report_date_range_end) {
            setWeekRange(ReportService.getWeekRangeFromIso(report.report_date_range_start.toISOString().slice(0, 10)))
        }
    }, [report, initialData])

    useEffect(() => {
        async function fetchMaintenanceItems() {
            let weekIso = report.weekIso || initialData?.week
            if (!weekIso) return
            const monday = new Date(weekIso)
            monday.setDate(monday.getDate() + 1)
            monday.setHours(0, 0, 0, 0)
            const saturday = new Date(monday)
            saturday.setDate(monday.getDate() + 5)
            const {data, error} = await supabase
                .from('list_items')
                .select('*')
                .eq('completed', true)
                .gte('completed_at', monday.toISOString())
                .lte('completed_at', saturday.toISOString())
            setMaintenanceItems(!error && Array.isArray(data) ? data : [])
        }

        fetchMaintenanceItems()
    }, [report.weekIso, initialData?.week])

    useEffect(() => {
        setSubmittedAt(initialData?.submitted_at ? formatDateTime(initialData.submitted_at) : '')
    }, [initialData])

    useEffect(() => {
        if (initialData?.data) {
            setForm(initialData.data)
        } else if (initialData) {
            setForm(initialData)
        }
    }, [initialData])

    useEffect(() => {
        async function fetchOperatorOptions() {
            if (report.name !== 'plant_production') {
                setOperatorOptions([])
                return
            }
            let plantCode = form.plant
            if (!plantCode && Array.isArray(form.rows) && form.rows.length > 0) {
                plantCode = form.rows[0].plant_code
            }
            if (!plantCode) {
                setOperatorOptions([])
                return
            }
            const {data: operatorsData, error: opError} = await supabase
                .from('operators')
                .select('employee_id, name')
                .eq('plant_code', plantCode)
            setOperatorOptions(!opError && Array.isArray(operatorsData)
                ? operatorsData.map(u => ({
                    value: u.employee_id,
                    label: u.name
                }))
                : []
            )
        }

        fetchOperatorOptions()
    }, [report.name, form.plant, form.rows])

    useEffect(() => {
        async function fetchAssignedPlant() {
            if ((report.name === 'plant_manager' || report.name === 'district_manager' || report.name === 'plant_production') && completedByUser && completedByUser.id) {
                const plant = await UserService.getUserPlant(completedByUser.id)
                setAssignedPlant(plant || '')
            }
        }

        fetchAssignedPlant()
    }, [report.name, completedByUser])

    useEffect(() => {
        async function checkPermissionAndRoleWeight() {
            if (user && user.id) {
                const perm = await UserService.hasPermission(user.id, 'reports.edit.others')
                setHasManagerEditPermission(!!perm)
                let ownerId = completedByUser?.id || initialData?.user_id || report?.userId
                if (ownerId && ownerId !== user.id) {
                    const userRole = await UserService.getHighestRole(user.id)
                    const ownerRole = await UserService.getHighestRole(ownerId)
                    if (userRole && ownerRole && userRole.weight > ownerRole.weight) {
                        setShowManagerEditButton(true)
                    } else {
                        setShowManagerEditButton(false)
                    }
                } else {
                    setShowManagerEditButton(false)
                }
            } else {
                setHasManagerEditPermission(false)
                setShowManagerEditButton(false)
            }
        }

        checkPermissionAndRoleWeight()
    }, [user, completedByUser, initialData, report])

    useEffect(() => {
        async function fetchPlants() {
            const {data, error} = await supabase
                .from('plants')
                .select('plant_code,plant_name')
                .order('plant_code', {ascending: true})
            setPlants(!error && Array.isArray(data)
                ? data.filter(p => p.plant_code && p.plant_name)
                    .sort((a, b) => {
                        const aNum = parseInt(a.plant_code, 10)
                        const bNum = parseInt(b.plant_code, 10)
                        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
                        return String(a.plant_code).localeCompare(String(b.plant_code))
                    })
                : []
            )
        }

        fetchPlants()
    }, [])

    let weekRangeHeader = weekRange
    let reportTitle = report.title || 'Report Review'

    let {yph, yphGrade, yphLabel, lost, lostGrade, lostLabel} = ReportService.getYardageMetrics(form)
    ReportService.getYphColor(yphGrade);
    ReportService.getYphColor(lostGrade);
    const PluginComponent = plugins[report.name]
    const isSubmitted = !!initialData?.completed

    let statusText = isSubmitted ? 'Submitted' : 'Saved (Draft)'
    let statusColor = isSubmitted ? 'var(--success)' : 'var(--warning)'

    const tabOptions = [
        {key: 'review', label: 'Review'},
        {key: 'overview', label: 'Overview'}
    ]
    const [, setActiveTab] = useState(tabOptions[0].key)

    useEffect(() => {
        setActiveTab(tabOptions[0].key)
    }, [report.name])

    return (
        <div style={{width: '100%', minHeight: '100vh', background: 'var(--background)'}}>
            <div style={{maxWidth: 900, margin: '56px auto 0 auto', padding: '0 0 32px 0'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24}}>
                    <button className="report-form-back" onClick={onBack} type="button">
                        <i className="fas fa-arrow-left"></i> Back
                    </button>
                    <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                        {hasManagerEditPermission && showManagerEditButton && (
                            <button
                                type="button"
                                style={{
                                    background: 'var(--accent)',
                                    color: 'var(--text-light)',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '10px 22px',
                                    fontWeight: 600,
                                    fontSize: 15,
                                    cursor: 'pointer'
                                }}
                                onClick={() => {
                                    if (onManagerEdit) onManagerEdit(report, initialData)
                                }}
                            >
                                Manager Edit
                            </button>
                        )}
                        {Array.isArray(form.rows) && form.rows.length > 0 && report.name === 'plant_production' && (
                            <button
                                type="button"
                                style={{
                                    background: isSubmitted ? 'var(--accent)' : 'var(--divider)',
                                    color: isSubmitted ? 'var(--text-light)' : 'var(--text-secondary)',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '10px 22px',
                                    fontWeight: 600,
                                    fontSize: 15,
                                    cursor: isSubmitted ? 'pointer' : 'not-allowed',
                                    opacity: isSubmitted ? 1 : 0.6
                                }}
                                onClick={() => {
                                    if (isSubmitted) ReportService.exportRowsToCSV(form.rows, operatorOptions, form.report_date)
                                }}
                                disabled={!isSubmitted}
                            >
                                Export to Spreadsheet
                            </button>
                        )}
                        {report.name !== 'plant_production' && (
                            <button
                                type="button"
                                style={{
                                    background: isSubmitted ? 'var(--accent)' : 'var(--divider)',
                                    color: isSubmitted ? 'var(--text-light)' : 'var(--text-secondary)',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '10px 22px',
                                    fontWeight: 600,
                                    fontSize: 15,
                                    cursor: isSubmitted ? 'pointer' : 'not-allowed',
                                    opacity: isSubmitted ? 1 : 0.6
                                }}
                                onClick={() => {
                                    if (isSubmitted) ReportService.exportReportFieldsToCSV(report, form)
                                }}
                                disabled={!isSubmitted}
                            >
                                Export to Spreadsheet
                            </button>
                        )}
                    </div>
                </div>
                <div style={{display: 'flex', alignItems: 'center', marginBottom: 12}}>
                    <div style={{
                        fontWeight: 700,
                        fontSize: 17,
                        color: statusColor,
                        marginRight: 18
                    }}>
                        {statusText}
                    </div>
                    {(report.name === 'plant_manager' || report.name === 'district_manager' || report.name === 'plant_production') && (
                        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
                            <div style={{fontWeight: 700, fontSize: 18, color: 'var(--accent)'}}>
                                {ownerName}
                            </div>
                            <div style={{fontWeight: 600, fontSize: 16, color: 'var(--text-secondary)'}}>
                                Assigned Plant: {assignedPlant}
                            </div>
                        </div>
                    )}
                    {submittedAt && (
                        <div style={{color: 'var(--text-secondary)', fontWeight: 500}}>
                            {isSubmitted ? 'Submitted at' : 'Last saved'}: {submittedAt}
                        </div>
                    )}
                </div>
                <div className="report-form-header-row" style={{marginTop: 0}}>
                    <div className="report-form-title">
                        {reportTitle}
                    </div>
                    {weekRangeHeader && (
                        <div style={{fontWeight: 700, fontSize: 17, color: 'var(--accent)'}}>
                            {report.name === 'plant_production'
                                ? (() => {
                                    const plantCode = form.plant || (Array.isArray(form.rows) && form.rows.length > 0 ? form.rows[0].plant_code : '')
                                    return weekRangeHeader + (form.report_date ? ` - ${form.report_date}` : '') + (plantCode ? ` - ${plantCode}'s Report` : '')
                                })()
                                : weekRangeHeader
                            }
                        </div>
                    )}
                </div>
                <div className="report-form-body-wide">
                    {report.name === 'general_manager' ? null : (
                        <>
                            {report.name === 'plant_production' ? null : (
                                <div className="report-form-fields-grid">
                                    {report.fields.map(field => (
                                        <div key={field.name} className="report-form-field-wide">
                                            <label>
                                                {field.name === 'yardage' ? 'Total Yardage' : field.label}
                                                {field.required && <span className="report-modal-required">*</span>}
                                            </label>
                                            {field.type === 'textarea' || (typeof form[field.name] === 'string' && form[field.name].length > 80) ? (
                                                <textarea
                                                    value={form[field.name] || ''}
                                                    readOnly
                                                    disabled
                                                    style={{
                                                        minHeight: 60,
                                                        maxHeight: 300,
                                                        resize: 'vertical',
                                                        width: '100%',
                                                        fontSize: 15,
                                                        background: 'var(--background)',
                                                        border: '1px solid var(--divider)',
                                                        borderRadius: 6,
                                                        color: 'var(--text-primary)',
                                                        padding: '7px 10px',
                                                        overflowY: 'auto'
                                                    }}
                                                />
                                            ) : field.type === 'select' ? (
                                                <select value={form[field.name] || ''} readOnly disabled>
                                                    <option value="">Select...</option>
                                                    {field.options?.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input type={field.type} value={form[field.name] || ''} readOnly
                                                       disabled/>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {PluginComponent && (
                                <PluginComponent
                                    form={form}
                                    yph={yph}
                                    yphGrade={yphGrade}
                                    yphLabel={yphLabel}
                                    lost={lost}
                                    lostGrade={lostGrade}
                                    lostLabel={lostLabel}
                                    summaryTab={summaryTab}
                                    setSummaryTab={setSummaryTab}
                                    maintenanceItems={maintenanceItems}
                                    operatorOptions={operatorOptions}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ReportsReviewView
