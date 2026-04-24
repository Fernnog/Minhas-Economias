// ===================================================
// REPORTS MODULE — Centro de Análise Financeira
// Depende de: fin_transactions e fin_budgets no localStorage
// ===================================================

const ReportsModule = (function () {

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
     * Calcula despesas agrupadas por categoria para um mês/ano específico,
     * respeitando transações recorrentes projetadas.
     */
    function _getMonthlyExpenses(txns, year, month) {
        const expenses = {};
        txns.forEach(t => {
            if (t.type !== 'despesa') return;
            const d = new Date(t.date + 'T00:00:00');
            const tYear = d.getFullYear();
            const tMonth = d.getMonth();

            // Lançamento direto no mês alvo
            if (tYear === year && tMonth === month) {
                expenses[t.category] = (expenses[t.category] || 0) + t.amount;
                return;
            }
            // Recorrente: projeta nos meses seguintes ao de cadastro
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

        const content = document.getElementById('report1-content');
        if (!content) return;

        if (activeBudgets.length === 0) {
            content.innerHTML = `<p class="report-empty">Nenhum orçamento configurado para este mês.<br>
                <small>Configure seus limites na aba de Orçamentos para ativar este relatório.</small></p>`;
            document.getElementById('report1-dialog').showModal();
            return;
        }

        // Ordena do pior desvio (maior estouro) para o melhor (maior economia)
        const rows = activeBudgets.map(b => {
            const spent = expenses[b.category] || 0;
            const diff = b.amount - spent; // positivo = economia, negativo = estouro
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

        document.getElementById('report1-dialog').showModal();
    }

    // ===================================================
    // RELATÓRIO 2: RADAR DE COMPROMETIMENTO FUTURO
    // ===================================================
    function openFutureCommitment() {
        const today = new Date();
        const txns = _getTxns();

        // Gera array com os próximos 6 meses a partir do mês corrente
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
                    // Recorrente: aparece neste mês se começou antes ou neste mês
                    if (tYear < year || (tYear === year && tMonth <= month)) {
                        if (t.recurrenceEndDate) {
                            const fim = new Date(t.recurrenceEndDate);
                            if (new Date(year, month, 1) >= fim) return;
                        }
                        fixed += t.amount;
                    }
                } else {
                    // Não-recorrente com data exata naquele mês (parcelas futuras, etc.)
                    if (tYear === year && tMonth === month) {
                        variable += t.amount;
                    }
                }
            });

            return { year, month, fixed, variable, total: fixed + variable };
        });

        const maxTotal = Math.max(...data.map(d => d.total), 1);
        const content = document.getElementById('report2-content');
        if (!content) return;

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

        document.getElementById('report2-dialog').showModal();
    }

    // ===================================================
    // RELATÓRIO 3: MAPA DE ENGESSAMENTO DA RENDA
    // ===================================================
    function openIncomeRigidity() {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const txns = _getTxns();

        let totalIncome = 0;
        let fixedExpenses = 0;
        let variableExpenses = 0;

        txns.forEach(t => {
            const d = new Date(t.date + 'T00:00:00');
            const tYear = d.getFullYear();
            const tMonth = d.getMonth();
            const isThisMonth = tYear === year && tMonth === month;
            const isRecurringProjected = t.isRecurring &&
                (tYear < year || (tYear === year && tMonth < month));

            // Verifica se recorrência ainda está ativa
            let recurrenceActive = false;
            if (isRecurringProjected) {
                if (t.recurrenceEndDate) {
                    const fim = new Date(t.recurrenceEndDate);
                    recurrenceActive = new Date(year, month, 1) < fim;
                } else {
                    recurrenceActive = true;
                }
            }

            const countsThisMonth = isThisMonth || recurrenceActive;
            if (!countsThisMonth) return;

            if (t.type === 'receita') {
                totalIncome += t.amount;
            } else if (t.type === 'despesa') {
                // Recorrentes = fixos; não-recorrentes = variáveis
                if (t.isRecurring && recurrenceActive) {
                    fixedExpenses += t.amount;
                } else if (isThisMonth && !t.isRecurring) {
                    variableExpenses += t.amount;
                } else if (isThisMonth && t.isRecurring) {
                    fixedExpenses += t.amount;
                }
            }
        });

        const totalExpenses = fixedExpenses + variableExpenses;
        const saved = Math.max(totalIncome - totalExpenses, 0);
        const grandTotal = Math.max(totalIncome, totalExpenses, 1);

        const fixedPct = Math.round((fixedExpenses / grandTotal) * 100);
        const varPct = Math.round((variableExpenses / grandTotal) * 100);
        const savedPct = Math.max(0, 100 - fixedPct - varPct);
        const rigidityPct = totalIncome > 0
            ? Math.round((totalExpenses / totalIncome) * 100)
            : 0;

        // Gera o conic-gradient para o gráfico de rosca via CSS
        const conicGradient = [
            `#3d3830 0% ${fixedPct}%`,
            `var(--warning) ${fixedPct}% ${fixedPct + varPct}%`,
            `var(--success) ${fixedPct + varPct}% 100%`
        ].join(', ');

        const bannerStatus = rigidityPct > 80 ? 'status-danger'
            : rigidityPct > 60 ? 'status-warning' : 'status-ok';

        const rigidityMessage = rigidityPct > 80
            ? `⚠ ${rigidityPct}% da sua renda já está comprometida — margem muito estreita.`
            : rigidityPct > 60
            ? `${rigidityPct}% da sua renda está comprometida — atenção antes de assumir novos fixos.`
            : `${rigidityPct}% da sua renda está comprometida — situação saudável.`;

        const content = document.getElementById('report3-content');
        if (!content) return;

        content.innerHTML = `
            <div class="rigidity-section">
                <div class="doughnut-wrap">
                    <div class="doughnut-ring" style="
                        background: conic-gradient(${conicGradient});
                    "></div>
                </div>
                <div class="doughnut-stats">
                    <div class="doughnut-stat-item">
                        <span class="doughnut-stat-dot" style="background:#3d3830;"></span>
                        <div class="doughnut-stat-info">
                            <small>Despesas Fixas</small>
                            <strong>${_fmt(fixedExpenses)}</strong>
                        </div>
                    </div>
                    <div class="doughnut-stat-item">
                        <span class="doughnut-stat-dot" style="background:var(--warning);"></span>
                        <div class="doughnut-stat-info">
                            <small>Despesas Variáveis</small>
                            <strong>${_fmt(variableExpenses)}</strong>
                        </div>
                    </div>
                    <div class="doughnut-stat-item">
                        <span class="doughnut-stat-dot" style="background:var(--success);"></span>
                        <div class="doughnut-stat-info">
                            <small>Livre / Poupado</small>
                            <strong>${_fmt(saved)}</strong>
                        </div>
                    </div>
                    ${totalIncome > 0 ? `
                    <div class="doughnut-stat-item">
                        <span class="doughnut-stat-dot" style="background:var(--primary);"></span>
                        <div class="doughnut-stat-info">
                            <small>Receita Total</small>
                            <strong>${_fmt(totalIncome)}</strong>
                        </div>
                    </div>` : ''}
                </div>
            </div>
            <div class="rigidity-index-banner ${bannerStatus}">
                <span class="rigidity-index-label">Índice de Engessamento</span>
                <span class="rigidity-index-value">${rigidityMessage}</span>
            </div>
            ${totalIncome === 0 ? `
            <p style="font-size:0.8rem; color:var(--text-light); margin-top:1rem; text-align:center;">
                Registre suas receitas para ativar o Índice de Engessamento.
            </p>` : ''}
        `;

        document.getElementById('report3-dialog').showModal();
    }

    // API Pública
    return { openBudgetDeviation, openFutureCommitment, openIncomeRigidity };

})();
