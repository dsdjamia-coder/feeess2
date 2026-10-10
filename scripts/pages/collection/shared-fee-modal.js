import { db, auth } from '../../../config/firebase-config.js';
import { BASE_PATH, escapeHtml } from '../../shared/app-common.js';
import { showToast } from '../../shared/toaster.js';
import { collection, doc, writeBatch, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * Shared Fee Entry & Edit Modal Manager
 * Serves both "Master Fee Ledger" and "Fee Status" tabs for unified in-place fee entry and editing.
 * Performs direct Firestore updates, instant cell DOM refresh, and local array syncing.
 */

// Active modal invocation options
let activeModalOptions = null;
let isSubmitting = false;

// Compute next receipt number across all available payments
export const getGlobalNextReceiptNumber = () => {
    let maxRcpt = 0;
    const candidates = [];

    if (Array.isArray(window.allPayments)) {
        candidates.push(...window.allPayments);
    }
    if (Array.isArray(window.MasterLedger?.ledgerPayments)) {
        candidates.push(...window.MasterLedger.ledgerPayments);
    }

    candidates.forEach(p => {
        if (!p) return;
        const num = parseInt(p.receiptNo, 10);
        if (!isNaN(num) && num > maxRcpt) {
            maxRcpt = num;
        }
    });

    return maxRcpt + 1;
};

/**
 * Open Shared Fee Entry/Edit Modal
 * @param {Object} options
 * @param {string} options.mode - 'add' or 'edit'
 * @param {Object} [options.student] - Student object { id, name, class, adm, guardian, phone }
 * @param {Object} [options.unit] - Ledger unit object (may include family group)
 * @param {string} [options.month] - Target month label e.g. "Jun", "June"
 * @param {string} [options.itemKey] - Item key e.g. "jun", "june", "cf", "admission"
 * @param {string} [options.itemName] - Item display name
 * @param {number} [options.defaultAmount] - Default fee amount
 * @param {Object} [options.payment] - Existing payment object (if edit mode)
 * @param {string} [options.paymentId] - Payment ID (if edit mode)
 * @param {HTMLElement} [options.targetCellElement] - Clicked table cell for instant DOM update
 * @param {string} [options.source] - 'fee-status', 'master-ledger', or 'edit'
 * @param {string} [options.academicYear] - Academic year (e.g. "2025-2026")
 * @param {Function} [options.onUpdated] - Callback after successful save
 */
export const openFeeEntryEditModal = (options = {}) => {
    const modal = document.getElementById('master-ledger-pay-modal');
    if (!modal) {
        console.error('Fee Entry modal element (#master-ledger-pay-modal) not found in DOM.');
        return;
    }

    activeModalOptions = { ...options };

    const isEdit = options.mode === 'edit' || Boolean(options.payment || options.paymentId);
    const existingPayment = options.payment || null;

    // Resolve Student / Unit details
    const student = options.student || (existingPayment ? {
        id: existingPayment.studentId,
        name: existingPayment.studentName,
        class: existingPayment.studentClass || existingPayment.classLabel,
        adm: existingPayment.studentAdm,
        guardian: existingPayment.guardianName
    } : null);

    const unit = options.unit || null;
    const isGroup = Boolean(unit?.isGroup);

    // Labels & Keys
    const effectiveItemKey = (existingPayment?.itemKey || options.itemKey || options.month || 'fee').toLowerCase();
    const effectiveItemName = existingPayment?.itemName || options.itemName || (options.month ? `${options.month} Tuition Fee` : 'Tuition Fee');
    const effectiveMonth = options.month || existingPayment?.itemKey || 'Tuition Fee';
    const effectiveYear = options.academicYear || existingPayment?.academicYear || window.currentWorkingAcademicYear || window.MasterLedger?.academicYear || '2025-2026';

    // Populate Hidden Inputs
    const unitIdEl = document.getElementById('ledger-pay-unit-id');
    if (unitIdEl) unitIdEl.value = unit ? unit.id : (student ? student.id : '');

    const monthEl = document.getElementById('ledger-pay-month');
    if (monthEl) monthEl.value = effectiveMonth;

    const itemKeyEl = document.getElementById('ledger-pay-item-key');
    if (itemKeyEl) itemKeyEl.value = effectiveItemKey;

    const itemNameEl = document.getElementById('ledger-pay-item-name');
    if (itemNameEl) itemNameEl.value = effectiveItemName;

    const studentIdEl = document.getElementById('ledger-pay-student-id');
    if (studentIdEl) studentIdEl.value = student?.id || (unit?.students?.[0]?.id) || '';

    const studentNameEl = document.getElementById('ledger-pay-student-name');
    if (studentNameEl) studentNameEl.value = student?.name || (unit?.students?.map(s => s.name).join(', ')) || '';

    const studentClassEl = document.getElementById('ledger-pay-student-class');
    if (studentClassEl) studentClassEl.value = student?.class || (unit?.classes?.join(', ')) || '';

    const studentAdmEl = document.getElementById('ledger-pay-student-adm');
    if (studentAdmEl) studentAdmEl.value = student?.adm || (unit?.students?.[0]?.adm) || '';

    const yearEl = document.getElementById('ledger-pay-academic-year');
    if (yearEl) yearEl.value = effectiveYear;

    const sourceEl = document.getElementById('ledger-pay-source');
    if (sourceEl) sourceEl.value = options.source || (isEdit ? 'edit' : 'ledger');

    const paymentIdEl = document.getElementById('ledger-pay-payment-id');
    if (paymentIdEl) paymentIdEl.value = existingPayment?.id || options.paymentId || '';

    const txnIdEl = document.getElementById('ledger-pay-txn-id');
    if (txnIdEl) txnIdEl.value = existingPayment?.transactionId || '';

    // Title & Header Badges
    const titleEl = modal.querySelector('h3');
    if (titleEl) {
        titleEl.textContent = isEdit ? 'Edit Fee Payment' : 'Record Fee Payment';
    }

    const subTitleEl = modal.querySelector('h3 + p');
    if (subTitleEl) {
        if (isEdit) {
            subTitleEl.textContent = 'Modify Verified Transaction Record';
        } else if (options.source === 'fee-status') {
            subTitleEl.textContent = 'Instant Fee Status Entry';
        } else {
            subTitleEl.textContent = 'Master Ledger Direct Collection';
        }
    }

    const submitBtn = document.getElementById('ledger-pay-confirm-btn');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = isEdit
            ? '<i class="fas fa-save mr-1"></i> Update Payment'
            : '<i class="fas fa-check mr-1"></i> Record Payment';
    }

    const monthBadge = document.getElementById('ledger-pay-month-badge');
    if (monthBadge) {
        monthBadge.textContent = effectiveItemName;
    }

    // Display Names & Meta
    const namesEl = document.getElementById('ledger-pay-names');
    if (namesEl) {
        if (unit) {
            namesEl.textContent = unit.students.map((s, i) => `${unit.isGroup ? `${i + 1}. ` : ''}${s.name} (${s.class || s.studentClass || '-'})`).join(', ');
        } else if (student) {
            namesEl.textContent = `${student.name} (Adm: ${student.adm || '-'})`;
        } else {
            namesEl.textContent = 'Student';
        }
    }

    const guardianEl = document.getElementById('ledger-pay-guardian');
    if (guardianEl) {
        guardianEl.textContent = unit?.guardian || student?.guardian || '--';
    }

    const classTag = document.getElementById('ledger-pay-class-tag');
    if (classTag) {
        classTag.textContent = unit ? `Class: ${unit.classes?.join(', ')}` : `Class: ${student?.class || '-'}`;
    }

    // Group Scope Wrap
    const scopeWrap = document.getElementById('ledger-pay-group-scope-wrap');
    if (scopeWrap) {
        scopeWrap.classList.toggle('hidden', !isGroup);
    }

    // Amount, Receipt, Date, Mode
    const defaultFeeAmount = isEdit
        ? (existingPayment?.amount || 0)
        : (options.defaultAmount || unit?.fee || 200);

    const nextReceipt = isEdit
        ? (existingPayment?.receiptNo || '')
        : getGlobalNextReceiptNumber();

    const paymentDateVal = isEdit
        ? (existingPayment?.paymentDate || new Date().toISOString().split('T')[0])
        : new Date().toISOString().split('T')[0];

    const paymentModeVal = isEdit
        ? (existingPayment?.paymentMode || 'Cash')
        : 'Cash';

    const amtInput = document.getElementById('ledger-pay-amount');
    if (amtInput) amtInput.value = defaultFeeAmount;

    const rcptInput = document.getElementById('ledger-pay-receipt');
    if (rcptInput) rcptInput.value = nextReceipt;

    const dateInput = document.getElementById('ledger-pay-date');
    if (dateInput) dateInput.value = paymentDateVal;

    const modeInput = document.getElementById('ledger-pay-mode');
    if (modeInput) modeInput.value = paymentModeVal;

    // Show Modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Focus amount input
    setTimeout(() => {
        if (amtInput) {
            amtInput.focus();
            amtInput.select();
        }
    }, 50);
};

// Close Shared Modal
export const closeFeeEntryEditModal = () => {
    const modal = document.getElementById('master-ledger-pay-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    activeModalOptions = null;
    isSubmitting = false;
};

// Perform instant in-place DOM update of the clicked table cell
const applyInstantCellUpdate = (targetCell, paymentData) => {
    if (!targetCell || !paymentData) return;

    const receiptDisplay = paymentData.receiptNo ? `R:${escapeHtml(paymentData.receiptNo)}` : 'Paid';
    const dateDisplay = paymentData.paymentDate
        ? new Date(paymentData.paymentDate).toLocaleDateString('en-GB')
        : new Date().toLocaleDateString('en-GB');

    // Fee Status Table Cell
    if (targetCell.dataset.feeAction !== undefined || targetCell.hasAttribute('data-fee-action')) {
        targetCell.className = "p-1.5 text-center bg-emerald-50/70 border-r border-slate-200 cursor-pointer hover:bg-emerald-100/90 transition group";
        targetCell.dataset.feeAction = "view-receipt";
        targetCell.dataset.paymentId = paymentData.id || '';
        targetCell.setAttribute('title', `Paid: ${receiptDisplay} on ${dateDisplay}`);
        targetCell.innerHTML = `
            <div class="flex flex-col items-center justify-center gap-0.5">
                <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200">
                    <i class="fas fa-check text-[8px]"></i> Paid
                </span>
                <span class="text-[10px] font-mono font-bold text-emerald-950">${receiptDisplay}</span>
                <span class="text-[9px] text-emerald-600 font-medium">${dateDisplay}</span>
            </div>
        `;
    }
    // Master Fee Ledger Month Cell
    else if (targetCell.dataset.ledgerAction !== undefined || targetCell.hasAttribute('data-ledger-action')) {
        targetCell.className = "px-1.5 py-2 text-center border-r border-slate-200 bg-emerald-50/60 fee-cell-interactive cursor-pointer hover:bg-emerald-100 transition";
        targetCell.dataset.ledgerAction = "view-receipt";
        targetCell.dataset.paymentId = paymentData.id || '';
        targetCell.setAttribute('title', `Paid: ${receiptDisplay} on ${dateDisplay}`);
        targetCell.innerHTML = `
            <div class="flex flex-col items-center justify-center gap-0.5">
                <div class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200">
                    <i class="fas fa-check text-[8px]"></i> Paid
                </div>
                <div class="text-[9px] font-mono font-bold text-emerald-850 truncate max-w-[85px] mt-0.5" title="${escapeHtml(paymentData.receiptNo || 'Paid')}">${receiptDisplay}</div>
                <div class="text-[9px] text-emerald-600 font-medium">${dateDisplay}</div>
            </div>
        `;
    }

    // Flash glow effect
    targetCell.classList.add('ring-2', 'ring-emerald-400');
    setTimeout(() => {
        targetCell.classList.remove('ring-2', 'ring-emerald-400');
    }, 1200);
};

// Process Submit (Add or Edit)
export const submitFeeEntryPayment = async () => {
    if (isSubmitting) return;

    const unitId = document.getElementById('ledger-pay-unit-id')?.value || '';
    const month = document.getElementById('ledger-pay-month')?.value || 'Tuition Fee';
    const itemKey = (document.getElementById('ledger-pay-item-key')?.value || month || 'fee').toLowerCase();
    const itemName = document.getElementById('ledger-pay-item-name')?.value || `${month} Tuition Fee`;
    const source = document.getElementById('ledger-pay-source')?.value || 'ledger';
    const existingPaymentId = document.getElementById('ledger-pay-payment-id')?.value || '';
    const existingTxnId = document.getElementById('ledger-pay-txn-id')?.value || '';
    const academicYear = document.getElementById('ledger-pay-academic-year')?.value || window.currentWorkingAcademicYear || '2025-2026';
    const cleanYear = String(academicYear).replace(/[^\w-]/g, '_');

    const studentId = document.getElementById('ledger-pay-student-id')?.value || unitId;
    const studentName = document.getElementById('ledger-pay-student-name')?.value || 'Student';
    const studentClass = document.getElementById('ledger-pay-student-class')?.value || '-';
    const studentAdm = document.getElementById('ledger-pay-student-adm')?.value || '';

    const amountInput = document.getElementById('ledger-pay-amount');
    const amount = Number(amountInput?.value || 0);

    const receiptRaw = document.getElementById('ledger-pay-receipt')?.value?.trim() || '';
    const receiptNo = receiptRaw ? parseInt(receiptRaw, 10) : '';

    const paymentDate = document.getElementById('ledger-pay-date')?.value || new Date().toISOString().split('T')[0];
    const mode = document.getElementById('ledger-pay-mode')?.value || 'Cash';
    const submitBtn = document.getElementById('ledger-pay-confirm-btn');

    if (!amount || amount <= 0) {
        showToast('Please enter a valid payment amount.', 'error');
        if (amountInput) amountInput.focus();
        return;
    }

    // Check mandatory receipt setting
    const isReceiptMandatory = Boolean(window.defaultReceiptMandatory);
    if (isReceiptMandatory && (!receiptRaw || isNaN(receiptNo))) {
        showToast('Receipt number is required by institution configuration.', 'error');
        return;
    }

    try {
        isSubmitting = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Saving...';
        }

        const batch = writeBatch(db);
        const currentUser = auth.currentUser;
        const collectorEmail = currentUser?.email ||
            window.AppSession?.getStaffAccess?.()?.userKey ||
            window.AppSession?.getStaffAccess?.()?.loginId ||
            'admin@institution.edu';

        const isEdit = source === 'edit' || Boolean(existingPaymentId);
        let savedPaymentRecord = null;

        if (isEdit && existingPaymentId) {
            // EDIT EXISTING PAYMENT
            const payRef = doc(db, `${BASE_PATH}/payments`, existingPaymentId);
            const updatePayload = {
                amount: amount,
                receiptNo: receiptNo || '',
                paymentDate: paymentDate,
                paymentMode: mode,
                updatedAt: new Date().toISOString()
            };
            batch.update(payRef, updatePayload);
            batch.update(doc(db, `${BASE_PATH}/years/${academicYear}/payments`, existingPaymentId), updatePayload);
            batch.update(doc(db, `${BASE_PATH}/academicYears/${cleanYear}/payments`, existingPaymentId), updatePayload);

            savedPaymentRecord = {
                id: existingPaymentId,
                transactionId: existingTxnId,
                studentId: studentId,
                studentName: studentName,
                studentClass: studentClass,
                classLabel: studentClass,
                studentAdm: studentAdm,
                itemKey: itemKey,
                itemName: itemName,
                academicYear: academicYear,
                ...updatePayload
            };
        } else {
            // NEW PAYMENT ENTRY
            const groupScopeVal = document.querySelector('input[name="ledger-group-pay-type"]:checked')?.value || 'group';
            const unit = activeModalOptions?.unit || null;
            const isGroup = Boolean(unit?.isGroup && groupScopeVal === 'group');

            const payRef = doc(collection(db, `${BASE_PATH}/payments`));
            const newTxnId = Date.now().toString() + Math.random().toString(36).substr(2, 5);

            let paymentPayload = {
                studentId: studentId,
                studentName: studentName,
                studentClass: studentClass,
                classLabel: studentClass,
                studentAdm: studentAdm,
                guardianName: unit?.guardian || document.getElementById('ledger-pay-guardian')?.textContent || '',
                amount: amount,
                receiptNo: receiptNo || '',
                itemKey: itemKey,
                itemName: itemName,
                itemType: 'month',
                paymentMode: mode,
                paymentDate: paymentDate,
                timestamp: Date.now(),
                transactionId: newTxnId,
                collectedBy: collectorEmail,
                academicYear: academicYear,
                status: 'FULL'
            };

            if (isGroup && unit) {
                paymentPayload.billingGroupId = unit.groupId;
                paymentPayload.studentName = unit.students.map(s => s.name).join(', ');
                paymentPayload.studentClass = unit.classes.join(', ');
                paymentPayload.itemName = `${month} Tuition Fee (Family Group)`;
            }

            batch.set(payRef, paymentPayload);
            batch.set(doc(db, `${BASE_PATH}/years/${academicYear}/payments`, payRef.id), paymentPayload);
            batch.set(doc(db, `${BASE_PATH}/academicYears/${cleanYear}/payments`, payRef.id), paymentPayload);

            savedPaymentRecord = {
                id: payRef.id,
                ...paymentPayload
            };
        }

        // Commit to Firestore directly
        await batch.commit();

        // 1. Instant Cell DOM Update (immediate visual feedback for user)
        if (activeModalOptions?.targetCellElement) {
            applyInstantCellUpdate(activeModalOptions.targetCellElement, savedPaymentRecord);
        }

        // 2. Synchronize in-memory payments lists
        if (Array.isArray(window.allPayments)) {
            const idx = window.allPayments.findIndex(p => p.id === savedPaymentRecord.id);
            if (idx >= 0) {
                window.allPayments[idx] = { ...window.allPayments[idx], ...savedPaymentRecord };
            } else {
                window.allPayments.push(savedPaymentRecord);
            }
        }

        if (window.MasterLedger?.ledgerPayments && Array.isArray(window.MasterLedger.ledgerPayments)) {
            const idx = window.MasterLedger.ledgerPayments.findIndex(p => p.id === savedPaymentRecord.id);
            if (idx >= 0) {
                window.MasterLedger.ledgerPayments[idx] = { ...window.MasterLedger.ledgerPayments[idx], ...savedPaymentRecord };
            } else {
                window.MasterLedger.ledgerPayments.push(savedPaymentRecord);
            }
        }

        // 3. User feedback
        const successMsg = isEdit
            ? 'Payment updated successfully!'
            : `Fee recorded successfully!${receiptNo ? ` Receipt: #${receiptNo}` : ''}`;
        showToast(successMsg, 'success');

        // 4. Callback
        if (typeof activeModalOptions?.onUpdated === 'function') {
            activeModalOptions.onUpdated(savedPaymentRecord);
        }

        // 5. Background sync for active tabs without full page reload
        setTimeout(() => {
            if (typeof window.syncMasterLedgerState === 'function') {
                window.syncMasterLedgerState();
            }
            if (typeof window.renderFeeTable === 'function') {
                window.renderFeeTable();
            }
            if (typeof window.MasterLedger?.renderTable === 'function') {
                window.MasterLedger.renderTable();
            }
            if (typeof window.prepareHistoryData === 'function') {
                window.prepareHistoryData();
            }
        }, 100);

        closeFeeEntryEditModal();
    } catch (err) {
        console.error('Error saving fee payment:', err);
        showToast(`Failed to save payment: ${err.message || 'Firestore error'}`, 'error');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = isEdit
                ? '<i class="fas fa-save mr-1"></i> Update Payment'
                : '<i class="fas fa-check mr-1"></i> Record Payment';
        }
    } finally {
        isSubmitting = false;
    }
};

/**
 * Initialize Shared Modal Event Listeners
 */
export const initSharedFeeModal = () => {
    const modal = document.getElementById('master-ledger-pay-modal');
    if (!modal) return;

    // Close buttons
    document.getElementById('ledger-pay-close-x')?.addEventListener('click', closeFeeEntryEditModal);
    document.getElementById('ledger-pay-cancel-btn')?.addEventListener('click', closeFeeEntryEditModal);

    // Overlay click to close
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'master-ledger-pay-modal') {
            closeFeeEntryEditModal();
        }
    });

    // Confirm button click
    const confirmBtn = document.getElementById('ledger-pay-confirm-btn');
    if (confirmBtn) {
        confirmBtn.onclick = submitFeeEntryPayment;
    }

    // Submit on Enter key in amount/receipt input
    ['ledger-pay-amount', 'ledger-pay-receipt'].forEach(id => {
        document.getElementById(id)?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitFeeEntryPayment();
            }
        });
    });
};

// Global Exposure for legacy script interop
window.openFeeEntryEditModal = openFeeEntryEditModal;
window.closeFeeEntryEditModal = closeFeeEntryEditModal;
window.submitFeeEntryPayment = submitFeeEntryPayment;
window.initSharedFeeModal = initSharedFeeModal;

// Compatibility adapters
window.openStudentQuickPayModal = (args) => {
    openFeeEntryEditModal({
        source: 'fee-status',
        mode: 'add',
        student: {
            id: args.studentId,
            name: args.studentName,
            class: args.studentClass,
            adm: args.studentAdm,
            guardian: args.guardian
        },
        month: args.month,
        itemKey: args.itemKey,
        itemName: args.itemName || args.month,
        defaultAmount: args.defaultAmount,
        targetCellElement: args.targetCellElement
    });
};

window.openEditPaymentInQuickModal = (payment, targetCellElement) => {
    openFeeEntryEditModal({
        mode: 'edit',
        payment: payment,
        targetCellElement: targetCellElement
    });
};
