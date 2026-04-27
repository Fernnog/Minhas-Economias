// ===================================================
// REPORTS MODULE — Centro de Análise Financeira
// Depende de: fin_transactions e fin_budgets no localStorage
// Depende de: window.PAYMENT_CONFIG em payment-config.js
// ===================================================

const ReportsModule = (function () {

    let _pmState = { year: null, month: null, method: 'debito' };

    // --- HELPERS INTERNOS ---

    function _fmt(value) {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function _getTxns() {
        return JSON.parse(localStorage.getItem('fin_transactions')) || [];
    }

    function _getBudgets() {
        return JSON.parse(localStorage.getItem('fin_budgets')) || [];
    }

    /**
     * Calcula despesas agrupadas por categoria para um mês/ano específico.
     */
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

            const conicGradient = [
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

        const config = window.PAYMENT_CONFIG.methods;
        const txns = _getTxns();
        const expenses = _getExpensesByPayment(txns, year, month, method);
        const cats = Object.keys(expenses).sort((a, b) => expenses[b] - expenses[a]);
        const total = cats.reduce((s, c) => s + expenses[c], 0);
        const maxVal = cats.length > 0 ? expenses[cats[0]] : 1;
        const currentMeta = config[method];
        const monthVal = `${year}-${String(month + 1).padStart(2, '0')}`;

        // Filtros (ignora o estado "Sem método" para o relatório)
        const filterBtns = Object.entries(config)
            .filter(([m]) => m !== '')
            .map(([m, d]) => `
                <button class="payment-filter-btn ${method === m ? d.activeClass : ''}"
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
        content.innerHTML = `<div class="skeleton-line" style="width:50%; height:2rem;"></div><div class="skeleton-line" style="width:80%;"></div>`;
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

    // API Pública
    return { 
        openBudgetDeviation, 
        openFutureCommitment, 
        openIncomeRigidity, 
        openPaymentMethodReport,
        _pmFilter,
        _pmMonth
    };

})();
