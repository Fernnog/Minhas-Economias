// ===================================================
// REPORTS MODULE — Centro de Análise Financeira
// Depende de: fin_transactions e fin_budgets no localStorage
// Depende de: PAYMENT_CONFIG em payment-config.js
// ===================================================

const ReportsModule = (function () {

    let _pmState = { year: null, month: null, method: 'debito' };
    let _imprevState = { year: null, month: null }; 

    // --- HELPERS INTERNOS ---

    function _fmt(value) {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function _getTxns() {
        return JSON.parse(localStorage.getItem('fin_transactions')) ||[];
    }

    function _getBudgets() {
        return JSON.parse(localStorage.getItem('fin_budgets')) ||[];
    }

    function _getMonthlyIncome(txns, year, month) {
        let total = 0;
        txns.forEach(t => {
            if (t.type !== 'receita') return;
            const d = new Date(t.date + 'T00:00:00');
            const tYear = d.getFullYear(), tMonth = d.getMonth();
            const isThisMonth = tYear === year && tMonth === month;
            const isRecurring = t.isRecurring && (tYear < year || (tYear === year && tMonth < month));
            if (isRecurring && t.recurrenceEndDate) {
                if (new Date(year, month, 1) >= new Date(t.recurrenceEndDate)) return;
            }
            if (isThisMonth || isRecurring) total += t.amount;
        });
        return total;
    }

    function _getMonthlyExpenses(txns, year, month) {
        const expenses = {};
        txns.forEach(t => {
            if (t.type !== 'despesa') return;
            const d = new Date(t.date + 'T00:00:00');
            const tYear = d.getFullYear();
            const tMonth = d.getMonth();

            if (tYear === year && tMonth === month) {
                expenses[t.category] = (expenses[t.category] || 0) + t.amount;
                return;
            }
            if (t.isRecurring && (tYear < year || (tYear === year && tMonth < month))) {
                if (t.recurrenceEndDate) {
                    const fim = new Date(t.recurrenceEndDate);
                    if (new Date(year, month, 1) >= fim) return;
                }
                expenses[t.category] = (expenses[t.category] || 0) + t.amount;
            }
        });
        return expenses;
    }

    // ===================================================
    // RELATÓRIO 1: DESVIO ORÇAMENTÁRIO
    // ===================================================
    function openBudgetDeviation() {
        const content = document.getElementById('report1-content');
        if (!content) return;

        content.innerHTML = `
            <div class="skeleton-line" style="width: 80%;"></div>
            <div class="skeleton-line" style="width: 60%;"></div>
            <div class="skeleton-line" style="width: 70%;"></div>
        `;
        document.getElementById('report1-dialog').showModal();

        requestAnimationFrame(() => {
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth();
            const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

            const budgets = _getBudgets();
            const txns = _getTxns();
            const expenses = _getMonthlyExpenses(txns, year, month);

            const activeBudgets = budgets.filter(b =>
                b.type === 'mensal' || b.targetMonth === monthStr
            );

            if (activeBudgets.length === 0) {
                content.innerHTML = `<p class="report-empty">Nenhum orçamento configurado para este mês.<br>
                    <small>Configure seus limites na aba de Orçamentos para ativar este relatório.</small></p>`;
                return;
            }

            const rows = activeBudgets.map(b => {
                const spent = expenses[b.category] || 0;
                const diff = b.amount - spent; 
                return { category: b.category, spent, limit: b.amount, diff };
            }).sort((a, b) => a.diff - b.diff);

            content.innerHTML = `
                <div class="report-table">
                    ${rows.map(r => {
                        const isOver = r.diff < 0;
                        const isNoData = r.spent === 0 && r.diff === r.limit;
                        const pillClass = isNoData ? 'pill-neutral' : (isOver ? 'pill-danger' : 'pill-success');
                        const pillSign = isOver ? '−' : '+';
                        const pillText = isNoData ? 'Sem gastos' : `${pillSign} ${_fmt(Math.abs(r.diff))}`;
                        return `
                            <div class="report-row">
                                <span class="report-row-name">${r.category}</span>
                                <span class="report-row-values">
                                    <span>${_fmt(r.spent)}</span>
                                    <span class="separator">/</span>
                                    <span>${_fmt(r.limit)}</span>
                                </span>
                                <span class="report-pill ${pillClass}">${pillText}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <p style="font-size:0.78rem; color:var(--text-light); margin-top:1.2rem; text-align:center;">
                    Ordenado do maior estouro ao maior saldo.
                </p>
            `;
        });
    }

    // ===================================================
    // RELATÓRIO 2: RADAR DE COMPROMETIMENTO FUTURO
    // ===================================================
    function openFutureCommitment() {
        const content = document.getElementById('report2-content');
        if (!content) return;

        content.innerHTML = `
            <div class="skeleton-line" style="width: 100%; height: 2.5rem;"></div>
            <div class="skeleton-line" style="width: 90%; height: 2.5rem;"></div>
            <div class="skeleton-line" style="width: 95%; height: 2.5rem;"></div>
        `;
        document.getElementById('report2-dialog').showModal();

        requestAnimationFrame(() => {
            const today = new Date();
            const txns = _getTxns();

            const months = Array.from({ length: 6 }, (_, i) => {
                const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
            });

            const data = months.map(({ year, month }) => {
                let fixed = 0;
                let variable = 0;

                txns.forEach(t => {
                    if (t.type !== 'despesa') return;
                    const d = new Date(t.date + 'T00:00:00');
                    const tYear = d.getFullYear();
                    const tMonth = d.getMonth();

                    if (t.isRecurring) {
                        if (tYear < year || (tYear === year && tMonth <= month)) {
                            if (t.recurrenceEndDate) {
                                const fim = new Date(t.recurrenceEndDate);
                                if (new Date(year, month, 1) >= fim) return;
                            }
                            fixed += t.amount;
                        }
                    } else {
                        if (tYear === year && tMonth === month) {
                            variable += t.amount;
                        }
                    }
                });

                return { year, month, fixed, variable, total: fixed + variable };
            });

            const maxTotal = Math.max(...data.map(d => d.total), 1);

            content.innerHTML = `
                <div class="commitment-chart">
                    ${data.map((d, i) => {
                        const fixedPct = (d.fixed / maxTotal) * 100;
                        const varPct = (d.variable / maxTotal) * 100;
                        const monthName = new Date(d.year, d.month, 1)
                            .toLocaleDateString('pt-BR', { month: 'short' })
                            .replace('.', '');
                        const label = monthName.charAt(0).toUpperCase() + monthName.slice(1);
                        const isCurrent = i === 0;
                        return `
                            <div class="commitment-month-row ${isCurrent ? 'commitment-current-month' : ''}">
                                <span class="commitment-month-label">${label}</span>
                                <div class="commitment-bar-track">
                                    <div class="commitment-segment-fixed"
                                         style="width: ${fixedPct.toFixed(1)}%"></div>
                                    <div class="commitment-segment-variable"
                                         style="width: ${varPct.toFixed(1)}%"></div>
                                </div>
                                <span class="commitment-total-label">${_fmt(d.total)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="chart-legend">
                    <span class="legend-item">
                        <span class="legend-dot" style="background:#3d3830;"></span>
                        Despesas Fixas (recorrentes)
                    </span>
                    <span class="legend-item">
                        <span class="legend-dot" style="background:var(--danger);"></span>
                        Parcelas / Variáveis
                    </span>
                    <span class="legend-item" style="color:var(--primary); font-weight:700;">
                        ★ Mês atual
                    </span>
                </div>
            `;
        });
    }

    // ===================================================
    // RELATÓRIO 3: MAPA DE ENGESSAMENTO DA RENDA
    // ===================================================
    function openIncomeRigidity() {
        const content = document.getElementById('report3-content');
        if (!content) return;

        content.innerHTML = `
            <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem;">
                <div class="skeleton-line" style="width: 120px; height: 120px; border-radius: 50%;"></div>
                <div style="flex: 1;">
                    <div class="skeleton-line" style="width: 90%;"></div>
                    <div class="skeleton-line" style="width: 70%;"></div>
                    <div class="skeleton-line" style="width: 80%;"></div>
                </div>
            </div>
            <div class="skeleton-line" style="width: 100%; height: 3rem;"></div>
        `;
        document.getElementById('report3-dialog').showModal();

        requestAnimationFrame(() => {
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth();
            const txns = _getTxns();

            let totalIncome = 0;
            let fixedExpenses = 0;
            let variableExpenses = 0;

            txns.forEach(t => {
                const d = new Date(t.date + 'T00:00:00');
                const tYear = d.getFullYear(), tMonth = d.getMonth();
                const isThisMonth = tYear === year && tMonth === month;
                const isRecurringProjected = t.isRecurring && (tYear < year || (tYear === year && tMonth < month));

                let recurrenceActive = false;
                if (isRecurringProjected) {
                    if (t.recurrenceEndDate) {
                        recurrenceActive = new Date(year, month, 1) < new Date(t.recurrenceEndDate);
                    } else {
                        recurrenceActive = true;
                    }
                }

                if (!(isThisMonth || recurrenceActive)) return;

                if (t.type === 'receita') {
                    totalIncome += t.amount;
                } else if (t.type === 'despesa') {
                    if (t.isRecurring || recurrenceActive) {
                        fixedExpenses += t.amount;
                    } else {
                        variableExpenses += t.amount;
                    }
                }
            });

            const totalExpenses = fixedExpenses + variableExpenses;
            const grandTotal = Math.max(totalIncome, totalExpenses, 1);
            const fixedPct = Math.round((fixedExpenses / grandTotal) * 100);
            const varPct = Math.round((variableExpenses / grandTotal) * 100);
            const saved = Math.max(totalIncome - totalExpenses, 0);
            const rigidityPct = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;

            const conicGradient =[
                `#3d3830 0% ${fixedPct}%`,
                `var(--warning) ${fixedPct}% ${fixedPct + varPct}%`,
                `var(--success) ${fixedPct + varPct}% 100%`
            ].join(', ');

            const bannerStatus = rigidityPct > 80 ? 'status-danger' : rigidityPct > 60 ? 'status-warning' : 'status-ok';
            const rigidityMessage = rigidityPct > 80 ? `⚠ ${rigidityPct}% da sua renda comprometida.` : `${rigidityPct}% da renda comprometida.`;

            content.innerHTML = `
                <div class="rigidity-section">
                    <div class="doughnut-wrap">
                        <div class="doughnut-ring" style="background: conic-gradient(${conicGradient});"></div>
                    </div>
                    <div class="doughnut-stats">
                        <div class="doughnut-stat-item"><span class="doughnut-stat-dot" style="background:#3d3830;"></span><small>Fixas</small><strong>${_fmt(fixedExpenses)}</strong></div>
                        <div class="doughnut-stat-item"><span class="doughnut-stat-dot" style="background:var(--warning);"></span><small>Variáveis</small><strong>${_fmt(variableExpenses)}</strong></div>
                        <div class="doughnut-stat-item"><span class="doughnut-stat-dot" style="background:var(--success);"></span><small>Poupado</small><strong>${_fmt(saved)}</strong></div>
                    </div>
                </div>
                <div class="rigidity-index-banner ${bannerStatus}">
                    <span class="rigidity-index-label">Índice de Engessamento</span>
                    <span class="rigidity-index-value">${rigidityMessage}</span>
                </div>
            `;
        });
    }

    // ===================================================
    // RELATÓRIO 4: GASTOS POR MEIO DE PAGAMENTO
    // ===================================================

    function _getExpensesByPayment(txns, year, month, method) {
        const expenses = {};
        txns.forEach(t => {
            if (t.type !== 'despesa') return;
            if ((t.paymentMethod || '') !== method) return;

            const d = new Date(t.date + 'T00:00:00');
            const tYear = d.getFullYear(), tMonth = d.getMonth();

            if (tYear === year && tMonth === month) {
                expenses[t.category] = (expenses[t.category] || 0) + t.amount;
                return;
            }
            if (t.isRecurring && (tYear < year || (tYear === year && tMonth < month))) {
                if (t.recurrenceEndDate && new Date(year, month, 1) >= new Date(t.recurrenceEndDate)) return;
                expenses[t.category] = (expenses[t.category] || 0) + t.amount;
            }
        });
        return expenses;
    }

    function _renderReport4(year, month, method) {
        const content = document.getElementById('report4-content');
        if (!content) return;

        const config = window.PAYMENT_CONFIG;
        const txns = _getTxns();
        const expenses = _getExpensesByPayment(txns, year, month, method);
        const cats = Object.keys(expenses).sort((a, b) => expenses[b] - expenses[a]);
        const total = cats.reduce((s, c) => s + expenses[c], 0);
        const maxVal = cats.length > 0 ? expenses[cats[0]] : 1;
        const currentMeta = config[method];
        const monthVal = `${year}-${String(month + 1).padStart(2, '0')}`;

        const filterBtns = Object.entries(config)
            .filter(([m]) => m !== '')
            .map(([m, d]) => `
                <button class="payment-filter-btn ${method === m ? 'active-' + m : ''}"
                        onclick="ReportsModule._pmFilter(${year}, ${month}, '${m}')">
                    ${d.label}
                </button>`).join('');

        const rows = cats.length > 0
            ? cats.map(cat => {
                const pct = (expenses[cat] / maxVal * 100).toFixed(1);
                return `
                    <div class="report-row" style="flex-direction:column; gap:0.3rem; align-items:stretch;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span class="report-row-name">${cat}</span>
                            <span style="font-weight:700; color:${currentMeta.color};">${_fmt(expenses[cat])}</span>
                        </div>
                        <div style="height:6px; background:var(--border); border-radius:4px; overflow:hidden;">
                            <div style="height:100%; width:${pct}%; background:${currentMeta.color}; 
                                        border-radius:4px; transition:width 0.4s ease;"></div>
                        </div>
                    </div>`;
            }).join('')
            : `<p class="report-empty">Nenhum lançamento via ${currentMeta.label} neste mês.</p>`;

        content.innerHTML = `
            <div class="report4-month-selector">
                <label>Mês:</label>
                <input type="month" value="${monthVal}" onchange="ReportsModule._pmMonth(this.value)">
            </div>
            <div class="payment-filter-bar">${filterBtns}</div>
            <div class="report-table">${rows}</div>
            ${total > 0 ? `<div class="report4-total-banner">Total via ${currentMeta.label}: <span style="color:${currentMeta.color};">${_fmt(total)}</span></div>` : ''}
        `;
    }

    function openPaymentMethodReport() {
        const content = document.getElementById('report4-content');
        if (!content) return;
        content.innerHTML = `
            <div class="skeleton-line" style="width:50%; height:2rem;"></div>
            <div class="skeleton-line" style="width:80%;"></div>
            <div class="skeleton-line" style="width:65%;"></div>
        `;
        document.getElementById('report4-dialog').showModal();
        requestAnimationFrame(() => {
            const today = new Date();
            _pmState = { year: today.getFullYear(), month: today.getMonth(), method: 'debito' };
            _renderReport4(_pmState.year, _pmState.month, _pmState.method);
        });
    }

    function _pmFilter(year, month, method) {
        _pmState.method = method;
        _renderReport4(year, month, method);
    }

    function _pmMonth(value) {
        const [y, m] = value.split('-');
        _pmState.year = parseInt(y);
        _pmState.month = parseInt(m) - 1;
        _renderReport4(_pmState.year, _pmState.month, _pmState.method);
    }

    // ===================================================
    // RELATÓRIO 5: TERMÔMETRO DE IMPREVISTOS COM ALERTAS
    // ===================================================

    const IMPREV_MAX_PCT = 25;   
    const IMPREV_WARN_PCT = 5;   
    const IMPREV_DANGER_PCT = 10; 

    function _imprevStatus(pct) {
        if (pct < IMPREV_WARN_PCT)   return 'ok';
        if (pct < IMPREV_DANGER_PCT) return 'warning';
        return 'danger';
    }

    function _imprevAlertContent(status, pct, totalImprev, totalIncome) {
        const map = {
            ok: {
                icon: '✔',
                title: 'Situação Controlada',
                msg: `Os imprevistos representam <strong>${pct.toFixed(1)}%</strong> da receita — dentro de uma faixa saudável. Continue monitorando.`
            },
            warning: {
                icon: '⚠',
                title: 'Zona de Atenção',
                msg: `Os imprevistos já consomem <strong>${pct.toFixed(1)}%</strong> da receita. Avalie se há gastos que poderiam ser antecipados ou evitados.`
            },
            danger: {
                icon: '🚨',
                title: 'Sobrecarga Detectada',
                msg: `Os imprevistos ultrapassaram <strong>${pct.toFixed(1)}%</strong> da receita — acima do limiar crítico. Risco real de desequilíbrio.`
            }
        };
        return map[status];
    }

    // --- Monitoramento Inteligente de Alertas ---
    function checkImprevistosThresholds() {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

        const txns = _getTxns();
        const totalIncome = _getMonthlyIncome(txns, year, month);

        if (totalIncome <= 0) return;

        const groups = (typeof CategoryGroups !== 'undefined') ? CategoryGroups.getGroups() :[];
        const imprevGroup = groups.find(g => g.id === 'imprevistos');
        const imprevSubs = imprevGroup ? imprevGroup.subcategories :[];

        let totalImprev = 0;
        txns.forEach(t => {
            if (t.type !== 'despesa') return;
            const cat = t.category || '';
            const isImprev = imprevSubs.includes(cat) || cat.toLowerCase() === 'imprevistos' || (imprevGroup && imprevSubs.length === 0 && cat.toLowerCase() === 'imprevistos');
            if (!isImprev) return;

            const d = new Date(t.date + 'T00:00:00');
            const tYear = d.getFullYear(), tMonth = d.getMonth();
            if (tYear === year && tMonth === month) {
                totalImprev += t.amount;
            } else if (t.isRecurring && (tYear < year || (tYear === year && tMonth < month))) {
                if (t.recurrenceEndDate && new Date(year, month, 1) >= new Date(t.recurrenceEndDate)) return;
                totalImprev += t.amount;
            }
        });

        const pct = (totalImprev / totalIncome) * 100;

        let alertsData = JSON.parse(localStorage.getItem('fin_imprev_alerts')) || {};
        if (!alertsData[monthKey]) alertsData[monthKey] = [];
        const triggered = alertsData[monthKey];

        const thresholds =[5, 10, 25, 50];
        let newlyTriggered = false;

        thresholds.forEach(th => {
            if (pct >= th && !triggered.includes(th)) {
                triggered.push(th);
                newlyTriggered = true;
                if (typeof showToast === 'function') {
                    showToast(`🚨 Alerta: Seus imprevistos já alcançaram ${th}% da sua renda!`);
                }
            }
        });

        if (newlyTriggered) {
            localStorage.setItem('fin_imprev_alerts', JSON.stringify(alertsData));
            if (typeof FirebaseModule !== 'undefined') {
                FirebaseModule.syncData('preferences', { id: 'imprev_alerts', history: alertsData });
            }
        }
    }

    function _imprevMonth(value) {
        if (!value) return;
        const [y, m] = value.split('-');
        _imprevState.year = parseInt(y);
        _imprevState.month = parseInt(m) - 1;
        _renderReport5(_imprevState.year, _imprevState.month);
    }

    function _renderReport5(year, month) {
        const content = document.getElementById('report5-content');
        if (!content) return;

        const txns = _getTxns();
        const groups = (typeof CategoryGroups !== 'undefined') ? CategoryGroups.getGroups() :[];
        const imprevGroup = groups.find(g => g.id === 'imprevistos');
        const imprevSubs = imprevGroup ? imprevGroup.subcategories :[];

        const totalIncome = _getMonthlyIncome(txns, year, month);

        const subTotals = {};
        txns.forEach(t => {
            if (t.type !== 'despesa') return;
            const cat = t.category || '';
            const isImprev = imprevSubs.includes(cat) ||
                             cat.toLowerCase() === 'imprevistos' ||
                             (imprevGroup && imprevSubs.length === 0 && cat.toLowerCase() === 'imprevistos');

            if (!isImprev) return;

            const d = new Date(t.date + 'T00:00:00');
            const tYear = d.getFullYear(), tMonth = d.getMonth();
            if (tYear === year && tMonth === month) {
                subTotals[cat] = (subTotals[cat] || 0) + t.amount;
                return;
            }
            if (t.isRecurring && (tYear < year || (tYear === year && tMonth < month))) {
                if (t.recurrenceEndDate && new Date(year, month, 1) >= new Date(t.recurrenceEndDate)) return;
                subTotals[cat] = (subTotals[cat] || 0) + t.amount;
            }
        });

        const totalImprev = Object.values(subTotals).reduce((s, v) => s + v, 0);
        const pct = totalIncome > 0 ? (totalImprev / totalIncome) * 100 : 0;
        const status = _imprevStatus(pct);
        const alert = _imprevAlertContent(status, pct, totalImprev, totalIncome);

        const markerPos = Math.min((pct / IMPREV_MAX_PCT) * 100, 97).toFixed(1);
        const warnPos  = (IMPREV_WARN_PCT   / IMPREV_MAX_PCT * 100).toFixed(1);
        const dangerPos = (IMPREV_DANGER_PCT / IMPREV_MAX_PCT * 100).toFixed(1);

        const sortedSubs = Object.entries(subTotals).sort(([,a], [,b]) => b - a);
        const maxSubVal = sortedSubs.length > 0 ? sortedSubs[0][1] : 1;

        const subRows = sortedSubs.length > 0
            ? sortedSubs.map(([name, val]) => {
                const barPct = (val / maxSubVal * 100).toFixed(1);
                return `
                    <div class="imprev-sub-row">
                        <div class="imprev-sub-header">
                            <span class="imprev-sub-name">${name}</span>
                            <span class="imprev-sub-value">${_fmt(val)}</span>
                        </div>
                        <div class="imprev-sub-bar-track">
                            <div class="imprev-sub-bar-fill" style="width:${barPct}%"></div>
                        </div>
                    </div>`;
            }).join('')
            : `<p class="report-empty" style="padding:1rem 0;">Nenhuma despesa de imprevistos registrada neste mês.</p>`;

        const monthName = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <p class="imprev-month-label" style="margin: 0; font-size: 1.1rem;">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</p>
                <button class="icon-btn-small btn-dark-gold chart-month-picker-btn" title="Selecionar outro mês" style="position: relative;">
                    <svg class="calendar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <input type="month" class="hidden-date-picker" value="${year}-${String(month + 1).padStart(2, '0')}" onchange="ReportsModule._imprevMonth(this.value)">
                </button>
            </div>

            <div class="imprev-big-display status-${status}">
                <span class="imprev-big-pct">${pct.toFixed(1)}<small>%</small></span>
                <span class="imprev-big-sub">da receita comprometida com imprevistos</span>
            </div>

            <div class="imprev-gauge-wrap">
                <div class="imprev-gauge-track">
                    <div class="imprev-zone imprev-zone-ok"    style="width:${warnPos}%"></div>
                    <div class="imprev-zone imprev-zone-warn"  style="width:${(dangerPos - warnPos).toFixed(1)}%"></div>
                    <div class="imprev-zone imprev-zone-over"  style="flex:1"></div>
                    <div class="imprev-marker" style="left:${markerPos}%">
                        <div class="imprev-marker-needle"></div>
                        <div class="imprev-marker-bubble status-bubble-${status}">${pct.toFixed(1)}%</div>
                    </div>
                </div>
                <div class="imprev-gauge-scale">
                    <span>0%</span>
                    <span style="position:absolute; left:${warnPos}%; transform:translateX(-50%);">${IMPREV_WARN_PCT}%</span>
                    <span style="position:absolute; left:${dangerPos}%; transform:translateX(-50%);">${IMPREV_DANGER_PCT}%</span>
                    <span>${IMPREV_MAX_PCT}%+</span>
                </div>
            </div>

            <div class="imprev-alert-banner imprev-alert-${status}">
                <span class="imprev-alert-icon">${alert.icon}</span>
                <div class="imprev-alert-body">
                    <strong>${alert.title}</strong>
                    <p>${alert.msg}</p>
                </div>
            </div>

            <div class="imprev-totals-row">
                <div class="imprev-total-item">
                    <small>Total Imprevistos</small>
                    <strong style="color:var(--danger)">${_fmt(totalImprev)}</strong>
                </div>
                <div class="imprev-total-divider"></div>
                <div class="imprev-total-item">
                    <small>Receita do Mês</small>
                    <strong style="color:var(--success)">${_fmt(totalIncome)}</strong>
                </div>
            </div>

            ${sortedSubs.length > 0 ? `
            <div class="imprev-subs-section">
                <h4 class="imprev-subs-title">Detalhamento por Subcategoria</h4>
                <div class="imprev-subs-list">${subRows}</div>
            </div>` : ''}

            ${totalIncome === 0 ? `
            <p style="font-size:0.8rem; color:var(--text-light); text-align:center; margin-top:1rem;">
                ⚠ Nenhuma receita registrada neste mês — o percentual não pôde ser calculado.
            </p>` : ''}
        `;
    }

    function openImprevistosAlert() {
        const content = document.getElementById('report5-content');
        if (!content) return;

        content.innerHTML = `
            <div class="skeleton-line" style="width:60%; height:3rem; margin:0 auto 1rem;"></div>
            <div class="skeleton-line" style="width:100%; height:2.5rem; margin-bottom:1rem;"></div>
            <div class="skeleton-line" style="width:100%; height:4rem; margin-bottom:1rem;"></div>
            <div class="skeleton-line" style="width:80%;"></div>
            <div class="skeleton-line" style="width:65%;"></div>
        `;
        document.getElementById('report5-dialog').showModal();

        requestAnimationFrame(() => {
            const today = new Date();
            _imprevState = { year: today.getFullYear(), month: today.getMonth() };
            _renderReport5(_imprevState.year, _imprevState.month);
        });
    }

    // API Pública
    return { 
        openBudgetDeviation, 
        openFutureCommitment, 
        openIncomeRigidity, 
        openPaymentMethodReport,
        openImprevistosAlert,
        _pmFilter,
        _pmMonth,
        _imprevMonth,
        checkImprevistosThresholds
    };

})();
