import React, {useEffect, useMemo, useState} from 'react'
import './styles/ReportsSubmitView.css'
import './styles/ReportsReviewView.css'
import {UserService} from '../../services/UserService'
import {ReportService} from '../../services/ReportService'
import {PlantManagerReviewPlugin} from './types/WeeklyPlantManagerReport'
import {DistrictManagerReviewPlugin} from './types/WeeklyDistrictManagerReport'
import {EfficiencyReviewPlugin} from './types/WeeklyEfficiencyReport'
import {SafetyManagerReviewPlugin} from './types/WeeklySafetyManagerReport'
import {GeneralManagerReviewPlugin} from './types/WeeklyGeneralManagerReport'

const plugins = {
    plant_manager: PlantManagerReviewPlugin,
    district_manager: DistrictManagerReviewPlugin,
    plant_production: EfficiencyReviewPlugin,
    safety_manager: SafetyManagerReviewPlugin,
    general_manager: GeneralManagerReviewPlugin
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
    const [submittedAt, setSubmittedAt] = useState('')
    const [summaryTab, setSummaryTab] = useState('summary')
    const [operatorOptions, setOperatorOptions] = useState([])
    const [assignedPlant, setAssignedPlant] = useState('')
    const [hasManagerEditPermission, setHasManagerEditPermission] = useState(false)
    const [showManagerEditButton, setShowManagerEditButton] = useState(false)
    const [plants, setPlants] = useState([])

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
        async function fetchMaintenanceItems() {
            const weekIso = report.weekIso || initialData?.week
            if (!weekIso) {
                setMaintenanceItems([])
                return
            }
            const items = await ReportService.fetchMaintenanceItems(weekIso)
            setMaintenanceItems(items)
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

    const plantCode = useMemo(() => {
        if (form.plant) return form.plant
        if (Array.isArray(form.rows) && form.rows.length > 0) return form.rows[0].plant_code || ''
        return ''
    }, [form.plant, form.rows])

    useEffect(() => {
        async function fetchOperatorOptions() {
            if (report.name !== 'plant_production') {
                setOperatorOptions([])
                return
            }
            if (!plantCode) {
                setOperatorOptions([])
                return
            }
            const options = await ReportService.fetchOperatorOptions(plantCode)
            setOperatorOptions(options)
        }

        fetchOperatorOptions()
    }, [report.name, plantCode])

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
            const list = await ReportService.fetchPlantsSorted()
            setPlants(list)
        }

        fetchPlants()
    }, [])

    let reportTitle = report.title || 'Report Review'

    let {yph, yphGrade, yphLabel, lost, lostGrade, lostLabel} = ReportService.getYardageMetrics(form)
    ReportService.getYphColor(yphGrade)
    ReportService.getYphColor(lostGrade)
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

    function formatVerboseDate(dateInput) {
        if (!dateInput) return ''
        const d = new Date(dateInput)
        return d.toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'})
    }

    function getWeekVerbose(weekIso) {
        if (!weekIso) return ''
        const monday = new Date(weekIso)
        monday.setDate(monday.getDate() + 1)
        monday.setHours(0, 0, 0, 0)
        const saturday = new Date(monday)
        saturday.setDate(monday.getDate() + 5)
        const left = monday.toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'})
        const right = saturday.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
        return `${left} – ${right}`
    }

    const weekVerbose = getWeekVerbose(report.weekIso || initialData?.week)
    const reportDateVerbose = form.report_date ? formatVerboseDate(form.report_date) : ''

    return (
        <div className="reports-review-view">
            <div className="reports-review-container">
                <div className="reports-review-header">
                    <button className="report-form-back" onClick={onBack} type="button">
                        <i className="fas fa-arrow-left"></i> Back
                    </button>
                    <div className="reports-review-actions">
                        {hasManagerEditPermission && showManagerEditButton && (
                            <button
                                type="button"
                                className="manager-edit-button"
                                onClick={() => {
                                    if (onManagerEdit) onManagerEdit(report, initialData)
                                }}
                            >
                                Manager Edit
                            </button>
                        )}
                    </div>
                </div>
                <div className="reports-review-status">
                    <div className="status-text" style={{color: statusColor}}>
                        {statusText}
                    </div>
                    {(report.name === 'plant_manager' || report.name === 'district_manager' || report.name === 'plant_production') && (
                        <div className="owner-info">
                            <div className="owner-name">
                                {ownerName}
                            </div>
                            <div className="assigned-plant">
                                Assigned Plant: {assignedPlant}
                            </div>
                        </div>
                    )}
                    {submittedAt && (
                        <div className="submitted-at">
                            {isSubmitted ? 'Submitted at' : 'Last saved'}: {submittedAt}
                        </div>
                    )}
                </div>
                <div className="report-form-header-row">
                    <div className="report-form-title">
                        {reportTitle}
                    </div>
                    <div className="report-context">
                        {weekVerbose ? (
                            <div className="context-chip">
                                <i className="far fa-calendar-alt"></i>
                                <span>{weekVerbose}</span>
                            </div>
                        ) : null}
                        {reportDateVerbose ? (
                            <div className="context-chip">
                                <i className="far fa-calendar-check"></i>
                                <span>{reportDateVerbose}</span>
                            </div>
                        ) : null}
                        {(report.name === 'plant_production' && plantCode) ? (
                            <div className="context-chip">
                                <i className="fas fa-industry"></i>
                                <span>Plant {plantCode}</span>
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className="report-form-body-wide">
                    <>
                        {report.name === 'plant_production' || report.name === 'general_manager' ? null : (
                            <div className="report-form-fields-grid">
                                {report.fields.map(field => (
                                    (report.name === 'safety_manager' && field.name === 'issues') ? null : (
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
                                    )
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
                                plants={plants}
                                weekIso={report.weekIso || initialData?.week}
                            />
                        )}
                    </>
                </div>
            </div>
        </div>
    )
}

export default ReportsReviewView
