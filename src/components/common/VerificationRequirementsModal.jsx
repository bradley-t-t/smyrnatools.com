import React, {useMemo} from 'react'
import {ValidationUtility} from '../../utils/ValidationUtility'
import './styles/VerificationRequirementsModal.css'

export default function VerificationRequirementsModal({
                                                          open,
                                                          onClose,
                                                          onSaveAndVerify,
                                                          missingFields = [],
                                                          vin,
                                                          make,
                                                          model,
                                                          year,
                                                          lastServiceDate,
                                                          lastChipDate,
                                                          setVin,
                                                          setMake,
                                                          setModel,
                                                          setYear,
                                                          setLastServiceDate,
                                                          setLastChipDate,
                                                          isServiceOverdue
                                                      }) {
    if (!open) return null
    const vinInfo = useMemo(() => ValidationUtility.explainVIN(vin || ''), [vin])
    const needsVin = missingFields.includes('VIN')
    const needsMake = missingFields.includes('Make')
    const needsModel = missingFields.includes('Model')
    const needsYear = missingFields.includes('Year')
    const vinOk = needsVin ? vinInfo.valid : true
    const makeOk = needsMake ? !!String(make).trim() : true
    const modelOk = needsModel ? !!String(model).trim() : true
    const yearOk = needsYear ? !!String(year).trim() : true
    const canSubmit = vinOk && makeOk && modelOk && yearOk
    const serviceOverdue = lastServiceDate && typeof isServiceOverdue === 'function' ? isServiceOverdue(lastServiceDate) : false
    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Missing required information">
            <div className="modal-content verification-modal">
                <div className="verification-modal-header">
                    <h3>{missingFields.length ? 'Missing Required Information' : 'Review Before Verifying'}</h3>
                    <p>{missingFields.length ? 'Provide the details below to continue verification.' : 'Confirm details before verifying.'}</p>
                </div>
                {!!missingFields.length && (
                    <ul className="missing-list" aria-label="Missing fields list">
                        {missingFields.map(f => <li key={f}>{f}</li>)}
                    </ul>
                )}
                <div className="verification-fields">
                    {needsVin && (
                        <div className="form-group vin-group">
                            <label htmlFor="verify-vin">VIN</label>
                            <input id="verify-vin" className="form-control" type="text" placeholder="17 characters (no I, O, Q)" value={vin}
                                   onChange={e => setVin(e.target.value.toUpperCase().replace(/[IOQ]/g,''))}/>
                            <div className="vin-hint">17 characters. Letters I, O, and Q are not used.</div>
                            {vin && !vinOk && (
                                <div className="vin-errors" aria-live="polite">
                                    <div className="warning-text">Invalid VIN</div>
                                    <ul>
                                        {vinInfo.reasons.map(r => <li key={r}>{r}</li>)}
                                    </ul>
                                </div>
                            )}
                            {!vin && needsVin && <div className="warning-text">Enter VIN</div>}
                        </div>
                    )}
                    {needsMake && (
                        <div className="form-group">
                            <label htmlFor="verify-make">Make</label>
                            <input id="verify-make" className="form-control" type="text" placeholder="Make" value={make}
                                   onChange={e => setMake(e.target.value)}/>
                            {needsMake && !makeOk && <div className="warning-text">Enter Make</div>}
                        </div>
                    )}
                    {needsModel && (
                        <div className="form-group">
                            <label htmlFor="verify-model">Model</label>
                            <input id="verify-model" className="form-control" type="text" placeholder="Model"
                                   value={model} onChange={e => setModel(e.target.value)}/>
                            {needsModel && !modelOk && <div className="warning-text">Enter Model</div>}
                        </div>
                    )}
                    {needsYear && (
                        <div className="form-group">
                            <label htmlFor="verify-year">Year</label>
                            <input id="verify-year" className="form-control" type="text" placeholder="Year" value={year}
                                   onChange={e => setYear(e.target.value)}/>
                            {needsYear && !yearOk && <div className="warning-text">Enter Year</div>}
                        </div>
                    )}
                    {(!lastServiceDate || serviceOverdue) && (
                        <div className="form-group">
                            <label htmlFor="verify-last-service">Last Service Date</label>
                            <input id="verify-last-service" className="form-control" type="date"
                                   value={lastServiceDate ? (lastServiceDate instanceof Date ? lastServiceDate.toISOString().split('T')[0] : String(lastServiceDate).split('T')[0]) : ''}
                                   onChange={e => setLastServiceDate(e.target.value ? new Date(e.target.value) : null)}/>
                            {lastServiceDate && serviceOverdue && (
                                <div className="modal-note warning">
                                    <span>Past due service. You can still continue but service is recommended.</span>
                                </div>
                            )}
                        </div>
                    )}
                    {typeof lastChipDate !== 'undefined' && !lastChipDate && (
                        <div className="form-group">
                            <label htmlFor="verify-last-chip">Last Chip Date</label>
                            <input id="verify-last-chip" className="form-control" type="date"
                                   value={lastChipDate ? (lastChipDate instanceof Date ? lastChipDate.toISOString().split('T')[0] : String(lastChipDate).split('T')[0]) : ''}
                                   onChange={e => setLastChipDate(e.target.value ? new Date(e.target.value) : null)}/>
                        </div>
                    )}
                </div>
                <div className="modal-actions">
                    <button type="button" className="primary-button" disabled={!canSubmit}
                            onClick={onSaveAndVerify}>Save & Verify
                    </button>
                    <button type="button" className="cancel-button" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    )
}
