// ===================================================
// REPORTS MODULE — Centro de Análise Financeira
// Depende de: fin_transactions e fin_budgets no localStorage
// Depende de: PAYMENT_CONFIG em payment-config.js
// ===================================================

const ReportsModule = (function () {

    let _pmState = { year: null, month: null, method: 'debito' };

    // Estado do Relatório 5
    let _imprevState = { year: null, month: null };

    // Marcos percentuais a monitorar
    const _IMPREV_MILESTONES = [5, 10, 25, 50];

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
     * Calcula a receita total de um mês/ano, incluindo recorrências projetadas.
     */
    function _getMonthlyIncome(txns, year, month) {
        let total = 0;
        txns.forEach(t => {
            if (t.type !== 'receita') return;
            if (t.category === 'Sem Categoria') return; // Filtro de exatidão de saldo
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

    /**
     * Calcula despesas agrupadas por categoria para um mês/ano específico.
     */
    function _getMonthlyExpenses(txns, year, month) {
        const expenses = {};
        txns.forEach(t => {
            if (t.type !== 'despesa') return;
            if (t.category === 'Sem Categoria') return; // Filtro de exatidão de saldo
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

        // ✅ CORREÇÃO: PAYMENT_CONFIG é o objeto direto, sem .methods
        const config = window.PAYMENT_CONFIG;
        const txns = _getTxns();
        const expenses = _getExpensesByPayment(txns, year, month, method);
        const cats = Object.keys(expenses).sort((a, b) => expenses[b] - expenses[a]);
        const total = cats.reduce((s, c) => s + expenses[c], 0);
        const maxVal = cats.length > 0 ? expenses[cats[0]] : 1;
        const currentMeta = config[method];
        const monthVal = `${year}-${String(month + 1).padStart(2, '0')}`;

        // ✅ CORREÇÃO: classe ativa montada como 'active-' + m (não d.activeClass)
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
    // RELATÓRIO 5: TERMÔMETRO DE IMPREVISTOS
    // ===================================================

    const IMPREV_MAX_PCT = 25;   // escala máxima da barra = 25% da renda
    const IMPREV_WARN_PCT = 5;   // limite inferior de atenção
    const IMPREV_DANGER_PCT = 10; // limite de sobrecarga

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
                msg: `Os imprevistos representam <strong>${pct.toFixed(1)}%</strong> da receita — dentro de uma faixa saudável. Continue monitorando para manter o equilíbrio.`
            },
            warning: {
                icon: '⚠',
                title: 'Zona de Atenção',
                msg: `Os imprevistos já consomem <strong>${pct.toFixed(1)}%</strong> da receita. Avalie se há gastos que poderiam ser antecipados ou evitados nos próximos meses.`
            },
            danger: {
                icon: '🚨',
                title: 'Sobrecarga Detectada',
                msg: `Os imprevistos ultrapassaram <strong>${pct.toFixed(1)}%</strong> da receita — acima do limiar crítico de ${IMPREV_DANGER_PCT}%. Risco real de desequilíbrio no orçamento doméstico.`
            }
        };
        return map[status];
    }

   function _showMilestoneToast(milestone) {
        const cfg = {
            5:  {
                icon: '📊',
                label: 'Marco atingido',
                msg: `Imprevistos chegaram a 5% da sua receita mensal.`,
                type: 'info'
            },
            10: {
                icon: '⚠️',
                label: 'Zona de atenção',
                msg: `Imprevistos atingiram 10% da receita — monitore de perto.`,
                type: 'warning'
            },
            25: {
                icon: '🚨',
                label: 'Alerta sério',
                msg: `Imprevistos ultrapassaram 25% da receita! Avalie os gastos.`,
                type: 'danger'
            },
            50: {
                icon: '🔴',
                label: 'Nível crítico',
                msg: `Imprevistos chegaram a 50% da sua receita! Risco de desequilíbrio.`,
                type: 'critical'
            }
        };
        const c = cfg[milestone];
        if (!c) return;

        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-milestone toast-milestone-${c.type}`;
        toast.innerHTML = `
            <span class="toast-milestone-icon">${c.icon}</span>
            <div class="toast-milestone-body">
                <strong>${c.label}</strong>
                <span>${c.msg}</span>
            </div>
        `;
        container.appendChild(toast);
        void toast.offsetWidth;             // Força reflow para a transição CSS funcionar
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 6000);                           // Toast de marco fica 6s (mais tempo para leitura)
    }

    async function _checkAndFireMilestoneToasts(pct, year, month) {
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

        // Filtra apenas os marcos que o percentual atual atingiu ou superou
        const triggered = _IMPREV_MILESTONES.filter(m => pct >= m);
        if (triggered.length === 0) return;

        const user = (typeof auth !== 'undefined') ? auth.currentUser : null;

        for (const milestone of triggered) {
            const docId = `${monthKey}-${milestone}pct`;   // Ex: "2025-05-25pct"

            if (user) {
                // === MODO FIREBASE (usuário autenticado) ===
                try {
                    const ref = db
                        .collection('users')
                        .doc(user.uid)
                        .collection('imprev_milestones')
                        .doc(docId);

                    const snap = await ref.get();
                    if (snap.exists) continue;              // Marco já disparado — pular

                    _showMilestoneToast(milestone);         // Exibir alerta
                    await ref.set({
                        milestone,
                        reachedPct: parseFloat(pct.toFixed(2)),
                        monthKey,
                        firedAt: new Date().toISOString()
                    });
                } catch (err) {
                    console.error('[Imprevistos] Erro ao verificar marco no Firebase:', err);
                }
            } else {
                // === FALLBACK: localStorage (usuário não autenticado) ===
                const lsKey = `imprev_milestone_${docId}`;
                if (localStorage.getItem(lsKey)) continue; // Já disparado — pular

                _showMilestoneToast(milestone);
                localStorage.setItem(lsKey, '1');
            }
        }
    }

    function _renderReport5(year, month) {
        const content = document.getElementById('report5-content');
        if (!content) return;

        requestAnimationFrame(() => {
            const txns = _getTxns();

            // 1. Determinar subcategorias do grupo Imprevistos
            const groups = (typeof CategoryGroups !== 'undefined') ? CategoryGroups.getGroups() : [];
            const imprevGroup = groups.find(g => g.id === 'imprevistos');
            const imprevSubs = imprevGroup ? imprevGroup.subcategories : [];

            // 2. Calcular receita do mês selecionado
            const totalIncome = _getMonthlyIncome(txns, year, month);

            // 3. Calcular despesas de imprevistos por subcategoria
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
            const alert  = _imprevAlertContent(status, pct, totalImprev, totalIncome);

            // 4. Posições na barra de gauge
            const markerPos  = Math.min((pct / IMPREV_MAX_PCT) * 100, 97).toFixed(1);
            const warnPos    = (IMPREV_WARN_PCT   / IMPREV_MAX_PCT * 100).toFixed(1);
            const dangerPos  = (IMPREV_DANGER_PCT / IMPREV_MAX_PCT * 100).toFixed(1);

            // 5. Subcategorias ordenadas
            const sortedSubs = Object.entries(subTotals).sort(([, a], [, b]) => b - a);
            const maxSubVal  = sortedSubs.length > 0 ? sortedSubs[0][1] : 1;

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

            // 6. Label do mês selecionado (não mais fixo em "hoje")
            const monthName = new Date(year, month, 1)
                .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

            content.innerHTML = `
                <p class="imprev-month-label">${monthLabel}</p>

                <div class="imprev-big-display status-${status}">
                    <span class="imprev-big-pct">${pct.toFixed(1)}<small>%</small></span>
                    <span class="imprev-big-sub">da receita comprometida com imprevistos</span>
                </div>

                <div class="imprev-gauge-wrap">
                    <div class="imprev-gauge-track">
                        <div class="imprev-zone imprev-zone-ok"   style="width:${warnPos}%"></div>
                        <div class="imprev-zone imprev-zone-warn" style="width:${(dangerPos - warnPos).toFixed(1)}%"></div>
                        <div class="imprev-zone imprev-zone-over" style="flex:1"></div>
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

            // 7. Verificar e disparar toasts de marcos (async, não bloqueia a UI)
            _checkAndFireMilestoneToasts(pct, year, month);
        });
    }

    function openImprevistosAlert() {
        const content = document.getElementById('report5-content');
        if (!content) return;

        // Exibir skeleton e abrir o modal
        content.innerHTML = `
            <div class="skeleton-line" style="width:60%; height:3rem; margin:0 auto 1rem;"></div>
            <div class="skeleton-line" style="width:100%; height:2.5rem; margin-bottom:1rem;"></div>
            <div class="skeleton-line" style="width:100%; height:4rem; margin-bottom:1rem;"></div>
            <div class="skeleton-line" style="width:80%;"></div>
            <div class="skeleton-line" style="width:65%;"></div>
        `;
        document.getElementById('report5-dialog').showModal();

        // Inicializar estado com o mês atual
        const today = new Date();
        _imprevState = { year: today.getFullYear(), month: today.getMonth() };

        // Sincronizar o valor do input de mês no cabeçalho do diálogo
        const monthInput = document.getElementById('report5-month-input');
        if (monthInput) {
            monthInput.value = `${_imprevState.year}-${String(_imprevState.month + 1).padStart(2, '0')}`;
        }

        _renderReport5(_imprevState.year, _imprevState.month);
    }

  function _imprevMonth(value) {
        const [y, m] = value.split('-');
        _imprevState.year  = parseInt(y);
        _imprevState.month = parseInt(m) - 1;
        _renderReport5(_imprevState.year, _imprevState.month);
    }

    // ===================================================
    // EXPORTAÇÃO: TERMÔMETRO DE IMPREVISTOS PARA PDF (VETORIAL)
    // ===================================================
    async function exportImprevistosToPDF() {
        const btn = document.getElementById('btn-export-imprevistos');
        if (!btn || btn.classList.contains('btn-is-loading')) return;

        btn.classList.add('btn-is-loading');

        // Libera a interface para o navegador pintar o spinner de carregamento
        await new Promise(r => setTimeout(r, 60));

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            let y = 20;

            // Extração Dinâmica de Cores
            const rootStyles = getComputedStyle(document.documentElement);
            const _rgb = (varName, fallback) => _hexToRgb(rootStyles.getPropertyValue(varName).trim() || fallback);
            const cPrimary = _rgb('--primary', '#C9A84C');
            const cText = _rgb('--text', '#1C1A17');
            const cTextLight = _rgb('--text-light', '#6B6150');
            const cDanger = _rgb('--danger', '#E05252');
            const cWarning = _rgb('--warning', '#D4A450');
            const cSuccess = _rgb('--success', '#4CAF7C');

            // --- 1. COLETA DA FONTE ÚNICA DA VERDADE (SSOT) ---
            const txns = _getTxns();
            const year = _imprevState.year;
            const month = _imprevState.month;

            const groups = (typeof CategoryGroups !== 'undefined') ? CategoryGroups.getGroups() : [];
            const imprevGroup = groups.find(g => g.id === 'imprevistos');
            const imprevSubs = imprevGroup ? imprevGroup.subcategories : [];

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
                } else if (t.isRecurring && (tYear < year || (tYear === year && tMonth < month))) {
                    if (t.recurrenceEndDate && new Date(year, month, 1) >= new Date(t.recurrenceEndDate)) return;
                    subTotals[cat] = (subTotals[cat] || 0) + t.amount;
                }
            });

            const totalImprev = Object.values(subTotals).reduce((s, v) => s + v, 0);
            const pct = totalIncome > 0 ? (totalImprev / totalIncome) * 100 : 0;
            const statusStr = _imprevStatus(pct); // 'ok', 'warning' ou 'danger'

            const monthName = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            const mLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

            // --- 2. CABEÇALHO ---
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(...cPrimary);
            doc.text('Relatório: Termômetro de Imprevistos', pageWidth / 2, y, { align: 'center' });

            y += 6;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...cTextLight);
            doc.text(mLabel, pageWidth / 2, y, { align: 'center' });

            y += 8;
            doc.setDrawColor(...cPrimary);
            doc.setLineWidth(0.5);
            doc.line(15, y, pageWidth - 15, y);
            y += 15;

            // --- 3. INDICADOR PRINCIPAL (PERCENTUAL) ---
            doc.setFontSize(36);
            let pctColor = cSuccess;
            if (statusStr === 'warning') pctColor = cWarning;
            if (statusStr === 'danger') pctColor = cDanger;
            
            doc.setTextColor(...pctColor);
            doc.setFont('helvetica', 'bold');
            doc.text(`${pct.toFixed(1)}%`, pageWidth / 2, y, { align: 'center' });

            y += 6;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...cTextLight);
            doc.text('da receita comprometida com imprevistos', pageWidth / 2, y, { align: 'center' });
            
            y += 15;

            // --- 4. TOTAIS FINANCEIROS ---
            doc.setDrawColor(220, 220, 220);
            doc.setFillColor(250, 250, 250);
            doc.roundedRect(15, y, pageWidth - 30, 20, 3, 3, 'FD');
            
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...cTextLight);
            doc.text('RECEITA DO MÊS', pageWidth / 4 + 7, y + 7, { align: 'center' });
            doc.text('TOTAL IMPREVISTOS', (pageWidth / 4) * 3 - 7, y + 7, { align: 'center' });

            doc.setFontSize(12);
            doc.setTextColor(...cSuccess);
            doc.text(_fmt(totalIncome).replace(/\u00A0/g, ' '), pageWidth / 4 + 7, y + 15, { align: 'center' });
            
            doc.setTextColor(...cDanger);
            doc.text(_fmt(totalImprev).replace(/\u00A0/g, ' '), (pageWidth / 4) * 3 - 7, y + 15, { align: 'center' });

            y += 30;

            // --- 5. DETALHAMENTO DE SUBCATEGORIAS ---
            const sortedSubs = Object.entries(subTotals).sort(([, a], [, b]) => b - a);

            if (sortedSubs.length > 0) {
                doc.setFontSize(11);
                doc.setTextColor(...cText);
                doc.setFont('helvetica', 'bold');
                doc.text('Detalhamento por Subcategoria', 15, y);
                y += 2;
                doc.setDrawColor(220, 220, 220);
                doc.setLineWidth(0.2);
                doc.line(15, y, pageWidth - 15, y);
                y += 8;

                sortedSubs.forEach(([name, val]) => {
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...cText);
                    
                    const lines = doc.splitTextToSize(name, pageWidth - 60);
                    doc.text(lines, 15, y);
                    
                    doc.setFont('helvetica', 'bold');
                    // Usando um tom alaranjado/avermelhado levemente diferente para imprevistos (opcional, ou usar cDanger)
                    doc.setTextColor(249, 115, 22); // Corrigido para RGB do Tailwind Orange-500
                    doc.text(_fmt(val).replace(/\u00A0/g, ' '), pageWidth - 15, y, { align: 'right' });
                    
                    y += (lines.length * 5) + 2;
                    doc.setDrawColor(245, 245, 245);
                    doc.line(15, y - 2, pageWidth - 15, y - 2);
                });
            } else {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...cTextLight);
                doc.text('Nenhuma despesa de imprevistos registrada neste mês.', pageWidth / 2, y, { align: 'center' });
            }

            // --- 6. NUMERAÇÃO DE PÁGINAS E SALVAMENTO ---
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(7);
                doc.setTextColor(...cTextLight);
                doc.setFont('helvetica', 'normal');
                doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            }

            const cleanName = mLabel.replace(/[^a-z0-9]/gi, '_');
            doc.save(`Imprevistos_${cleanName}.pdf`);

        } catch (e) {
            console.error('[jsPDF Export Erro no Termômetro]:', e);
            if (typeof showToast === 'function') showToast('Erro ao gerar PDF de Imprevistos.', 'danger');
        } finally {
            btn.classList.remove('btn-is-loading');
        }
    }

    // ===================================================
    // EXPORTAÇÃO: DADOS PARA INTELIGÊNCIA ARTIFICIAL (TXT/MD)
    // ===================================================
    function exportAITxtReport() {
        const monthInput = document.getElementById('ai-export-month-input').value;
        if (!monthInput) {
            if(typeof showToast === 'function') showToast('Selecione um mês primeiro.');
            return;
        }
        
        const [y, m] = monthInput.split('-');
        const year = parseInt(y);
        const month = parseInt(m) - 1;
        const txns = _getTxns();
        
        let totalIncome = 0;
        let totalExpense = 0;
        let fixedExpense = 0;
        let variableExpense = 0;
        let totalImprev = 0;
        
        const catTotals = {};
        const detailedTxns = [];

        // Identificação estrutural das subcategorias de imprevistos
        const groups = (typeof CategoryGroups !== 'undefined') ? CategoryGroups.getGroups() : [];
        const imprevGroup = groups.find(g => g.id === 'imprevistos');
        const imprevSubs = imprevGroup ? imprevGroup.subcategories : [];

        // Função auxiliar robusta para verificar se a transação está ativa no mês/ano alvo
        const isTxnActive = (t, targetYear, targetMonth) => {
            const d = new Date(t.date + 'T00:00:00');
            const tYear = d.getFullYear();
            const tMonth = d.getMonth();
            
            if (tYear === targetYear && tMonth === targetMonth) return { active: true, recurring: false, date: t.date };
            
            if (t.isRecurring && (tYear < targetYear || (tYear === targetYear && tMonth < targetMonth))) {
                const mesStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
                const fim = t.recurrenceEndDate ? new Date(t.recurrenceEndDate) : null;
                const isSkipped = t.skippedDates && t.skippedDates.some(sd => sd.startsWith(mesStr));
                
                if (!isSkipped && (!fim || new Date(targetYear, targetMonth, 1) < fim)) {
                    return { active: true, recurring: true, date: `${mesStr}-${String(d.getDate()).padStart(2, '0')}` };
                }
            }
            return { active: false, recurring: false, date: null };
        };

        const isImprevisto = (t) => {
            const cat = t.category || '';
            return imprevSubs.includes(cat) || cat.toLowerCase() === 'imprevistos' || (imprevGroup && imprevSubs.length === 0 && cat.toLowerCase() === 'imprevistos');
        };

        // 1. Processamento do Mês Atual
        txns.forEach(t => {
            const status = isTxnActive(t, year, month);
            if (status.active) {
                if (t.type === 'receita') totalIncome += t.amount;
                if (t.type === 'despesa') {
                    totalExpense += t.amount;
                    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
                    
                    if (t.isRecurring || status.recurring) fixedExpense += t.amount;
                    else variableExpense += t.amount;

                    if (isImprevisto(t)) totalImprev += t.amount;
                }
                detailedTxns.push({
                    date: status.date,
                    type: t.type,
                    desc: t.desc || 'Sem descrição',
                    category: t.category,
                    amount: t.amount,
                    method: t.paymentMethod || 'Sem método'
                });
            }
        });

        // 2. Projeção Completa (Próximos 6 meses)
        const futureMonths = [];
        for (let i = 1; i <= 6; i++) {
            let targetMonth = month + i;
            let targetYear = year;
            if (targetMonth > 11) {
                targetMonth -= 12;
                targetYear += 1;
            }
            
            let fIncome = 0;
            let fFixed = 0;
            let fVar = 0;
            let fImprev = 0;
            
            txns.forEach(t => {
                const status = isTxnActive(t, targetYear, targetMonth);
                if (status.active) {
                    if (t.type === 'receita') fIncome += t.amount;
                    if (t.type === 'despesa') {
                        if (t.isRecurring || status.recurring) fFixed += t.amount;
                        else fVar += t.amount;
                        if (isImprevisto(t)) fImprev += t.amount;
                    }
                }
            });
            futureMonths.push({ month: targetMonth, year: targetYear, income: fIncome, fixed: fFixed, variable: fVar, imprev: fImprev });
        }

        detailedTxns.sort((a, b) => new Date(b.date) - new Date(a.date));

        // 3. Construção do Markdown Enriquecido
        let md = `# Relatório Financeiro Analítico: ${String(month + 1).padStart(2, '0')}/${year}\n\n`;
        md += `Aja como meu consultor financeiro sênior. Abaixo estão os dados do mês atual e o mapa preditivo de 6 meses para sua análise profunda.\n\n`;
        
        md += `## 1. DIAGNÓSTICO DO MÊS ATUAL\n`;
        md += `- **Receitas Totais:** R$ ${totalIncome.toFixed(2)}\n`;
        md += `- **Despesas Totais:** R$ ${totalExpense.toFixed(2)} (Fixas: R$ ${fixedExpense.toFixed(2)} | Variáveis: R$ ${variableExpense.toFixed(2)})\n`;
        md += `- **Saldo Líquido:** R$ ${(totalIncome - totalExpense).toFixed(2)}\n`;
        
        const rigidityPct = totalIncome > 0 ? ((totalExpense / totalIncome) * 100).toFixed(1) : 0;
        const imprevPct = totalIncome > 0 ? ((totalImprev / totalIncome) * 100).toFixed(1) : 0;
        
        md += `- **Índice de Engessamento (Despesas/Receita):** ${rigidityPct}%\n`;
        md += `- **Total de Imprevistos:** R$ ${totalImprev.toFixed(2)} (Comprometendo ${imprevPct}% da receita)\n\n`;

        md += `## 2. RADAR DE COMPROMETIMENTO E RISCO (PRÓXIMOS 6 MESES)\n`;
        md += `Esta tabela projeta receitas recorrentes/projetadas, custos fixos, parcelamentos (variáveis) e parcelamentos de imprevistos.\n\n`;
        md += `| Mês/Ano | Receita Prevista | Custos Fixos | Custos Variáveis | Imprevistos (Resíduo) | Saldo Previsto | % Engessamento |\n`;
        md += `|:---:|:---:|:---:|:---:|:---:|:---:|:---:|\n`;
        
        futureMonths.forEach(fm => {
            const mLabel = String(fm.month + 1).padStart(2, '0');
            const fmExpense = fm.fixed + fm.variable;
            const fmSaldo = fm.income - fmExpense;
            const fmEngessamento = fm.income > 0 ? ((fmExpense / fm.income) * 100).toFixed(1) : 0;
            
            md += `| ${mLabel}/${fm.year} | R$ ${fm.income.toFixed(2)} | R$ ${fm.fixed.toFixed(2)} | R$ ${fm.variable.toFixed(2)} | R$ ${fm.imprev.toFixed(2)} | R$ ${fmSaldo.toFixed(2)} | ${fmEngessamento}% |\n`;
        });
        md += `\n`;
        
        md += `## 3. GASTOS POR CATEGORIA (MÊS ATUAL)\n`;
        Object.entries(catTotals)
            .sort((a, b) => b[1] - a[1])
            .forEach(([cat, val]) => {
                md += `- ${cat}: R$ ${val.toFixed(2)}\n`;
            });
        
        md += `\n## 4. LANÇAMENTOS DETALHADOS (MÊS ATUAL)\n`;
        md += `| Data | Tipo | Descrição | Categoria | Valor | Pagamento |\n`;
        md += `|---|---|---|---|---|---|\n`;
        detailedTxns.forEach(t => {
            md += `| ${t.date} | ${t.type} | ${t.desc} | ${t.category} | R$ ${t.amount.toFixed(2)} | ${t.method} |\n`;
        });

        // 4. Download do arquivo
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Dados_IA_Evoluido_${year}_${String(month + 1).padStart(2, '0')}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        document.getElementById('export-ai-dialog').close();
    }

    // ===================================================
    // EXTRATO POR CATEGORIA (Novo Hub V2)
    // ===================================================
    
    // Helper de Negócios: Fonte Única da Verdade para extração de categoria
    function _getFilteredCategoryData(category, year, month) {
        const txns = _getTxns();
        const filtered = [];
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

        txns.forEach(t => {
            if (t.category !== category) return;
            
            const d = new Date(t.date + 'T00:00:00');
            const tYear = d.getFullYear();
            const tMonth = d.getMonth();
            let isActive = false;
            let isProjected = false;

            if (tYear === year && tMonth === month) {
                isActive = true;
            } else if (t.isRecurring && (tYear < year || (tYear === year && tMonth < month))) {
                const isSkipped = t.skippedDates && t.skippedDates.some(sd => sd.startsWith(monthStr));
                const fim = t.recurrenceEndDate ? new Date(t.recurrenceEndDate) : null;
                if (!isSkipped && (!fim || new Date(year, month, 1) < fim)) {
                    isActive = true;
                    isProjected = true;
                }
            }

            if (isActive) {
                const projectedDate = isProjected ? `${monthStr}-${t.date.slice(8, 10)}` : t.date;
                filtered.push({ ...t, date: projectedDate, isProjected });
            }
        });

        filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
        const total = filtered.reduce((acc, t) => acc + (t.type === 'despesa' ? -t.amount : t.amount), 0);

        return { filtered, total };
    }

    let _catExtractState = { year: null, month: null, category: '' };
    let _isExporting = false;

    function _populateCatExtractSelect() {
        const select = document.getElementById('report-catextract-select');
        if (!select) return;
        select.innerHTML = '<option value="">-- Escolha a Categoria para Filtrar --</option>';

        if (typeof CategoryGroups !== 'undefined') {
            const groups = CategoryGroups.getGroups();
            const txns = _getTxns();
            // Pega as categorias que realmente existem nos txns para evitar options vazias demais
            const activeCats = [...new Set(txns.map(t => t.category))].filter(Boolean);
            const assignedSet = new Set();
            
            groups.forEach(g => {
                const subs = g.subcategories.filter(s => activeCats.includes(s));
                if (subs.length === 0) return;
                const optgroup = document.createElement('optgroup');
                optgroup.label = g.name;
                subs.sort().forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat; opt.textContent = cat;
                    optgroup.appendChild(opt);
                    assignedSet.add(cat);
                });
                select.appendChild(optgroup);
            });

            const ungrouped = activeCats.filter(c => !assignedSet.has(c) && c !== 'Sem Categoria');
            if (ungrouped.length > 0) {
                const grpOthers = document.createElement('optgroup');
                grpOthers.label = 'Outros / Sem Vínculo';
                ungrouped.sort().forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat; opt.textContent = cat;
                    grpOthers.appendChild(opt);
                });
                select.appendChild(grpOthers);
            }
        }
    }

    function openCategoryExtract() {
        const dialog = document.getElementById('report-catextract-dialog');
        const monthInput = document.getElementById('report-catextract-month');
        if (!dialog || !monthInput) return;

        const today = new Date();
        _catExtractState.year = today.getFullYear();
        _catExtractState.month = today.getMonth();
        _catExtractState.category = '';
        
        _populateCatExtractSelect();
        
        const select = document.getElementById('report-catextract-select');
        if(select) select.value = '';

        monthInput.value = `${_catExtractState.year}-${String(_catExtractState.month + 1).padStart(2, '0')}`;
        
        _renderCategoryExtract();
        dialog.showModal();
    }

    function _catExtractMonth(value) {
        if(!value) return;
        const [y, m] = value.split('-');
        _catExtractState.year = parseInt(y);
        _catExtractState.month = parseInt(m) - 1;
        _renderCategoryExtract();
    }

    function _catExtractCategory(value) {
        _catExtractState.category = value;
        _renderCategoryExtract();
    }

    function _renderCategoryExtract() {
        const content = document.getElementById('report-catextract-content');
        const titleMonth = document.getElementById('cat-extract-ui-month');
        const titleCat = document.getElementById('cat-extract-ui-cat');
        
        if (!content || !titleMonth || !titleCat) return;

        const dateObj = new Date(_catExtractState.year, _catExtractState.month, 1);
        const mLabel = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        titleMonth.textContent = mLabel.charAt(0).toUpperCase() + mLabel.slice(1);
        titleCat.textContent = _catExtractState.category || 'Nenhuma categoria selecionada';

        if (!_catExtractState.category) {
            content.innerHTML = '<p class="report-empty">Selecione uma categoria acima para listar e exportar os lançamentos.</p>';
            return;
        }

        // NOVO: Usa a fonte única da verdade
        const { filtered, total } = _getFilteredCategoryData(_catExtractState.category, _catExtractState.year, _catExtractState.month);

        if (filtered.length === 0) {
            content.innerHTML = `<p class="report-empty" style="color:var(--text-light);">Nenhum registro encontrado para <strong>${_catExtractState.category}</strong> em ${titleMonth.textContent}.</p>`;
            return;
        }

        const colorClass = total < 0 ? 'var(--danger)' : 'var(--success)';

        content.innerHTML = `
            <div class="cat-tx-summary">
                <span>${filtered.length} lançamento(s)</span>
                <span class="cat-tx-total" style="color: ${colorClass}">${_fmt(Math.abs(total))}</span>
            </div>
            <ul class="cat-tx-list">
                ${filtered.map(t => {
                    const dt = new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR');
                    const color = t.type === 'despesa' ? 'var(--danger)' : 'var(--success)';
                    return `
                        <li class="cat-tx-item ${t.isProjected ? 'projected' : ''}">
                            <div class="cat-tx-info">
                                <span class="cat-tx-desc">${t.desc || '—'}</span>
                                ${t.isProjected ? '<span class="cat-tx-badge">Recorrente/Projetado</span>' : ''}
                            </div>
                            <div class="cat-tx-meta">
                                <span class="cat-tx-date">${dt}</span>
                                <span class="cat-tx-amount" style="color:${color}">${_fmt(t.amount)}</span>
                            </div>
                        </li>`;
                }).join('')}
            </ul>`;
    }

    // Helper para converter cor HEX das variáveis CSS para RGB pro jsPDF
    function _hexToRgb(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const num = parseInt(hex, 16);
        return [num >> 16, (num >> 8) & 255, num & 255];
    }

    async function exportCategoryExtractToPDF() {
        if (_isExporting) return;

        if (!_catExtractState.category) {
            if (typeof showToast === 'function') showToast('Selecione uma categoria antes de exportar.', 'warning');
            return;
        }
        _isExporting = true;

        const overlay = document.createElement('div');
        overlay.className = 'pdf-loading-overlay';
        overlay.innerHTML = `
            <svg class="spin-icon" viewBox="0 0 24 24" width="50" height="50" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
            </svg>
            <p style="margin-top:1rem; font-weight:700; font-size:1.1rem; color:var(--text);">Gerando Relatório Vetorial...</p>
        `;
        document.body.appendChild(overlay);

        // Dá tempo para a UI renderizar o overlay
        await new Promise(r => setTimeout(r, 50));

        try {
            const { year, month, category } = _catExtractState;
            const { filtered, total } = _getFilteredCategoryData(category, year, month);

            // Captura a classe jsPDF instanciada via CDN UMD
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            let y = 20;

            // Extração Dinâmica de Cores do CSS
            const rootStyles = getComputedStyle(document.documentElement);
            const cPrimary = _hexToRgb(rootStyles.getPropertyValue('--primary').trim() || '#C9A84C');
            const cText = _hexToRgb(rootStyles.getPropertyValue('--text').trim() || '#1C1A17');
            const cTextLight = _hexToRgb(rootStyles.getPropertyValue('--text-light').trim() || '#6B6150');
            const cDanger = _hexToRgb(rootStyles.getPropertyValue('--danger').trim() || '#E05252');
            const cSuccess = _hexToRgb(rootStyles.getPropertyValue('--success').trim() || '#4CAF7C');

            // --- CABEÇALHO DO RELATÓRIO ---
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(...cPrimary);
            doc.text('Extrato Detalhado por Categoria', pageWidth / 2, y, { align: 'center' });

            y += 8;
            doc.setFontSize(12);
            doc.setTextColor(...cText);
            doc.text(category, pageWidth / 2, y, { align: 'center' });

            y += 6;
            const mLabel = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...cTextLight);
            doc.text(mLabel, pageWidth / 2, y, { align: 'center' });

            y += 8;
            doc.setDrawColor(...cPrimary);
            doc.setLineWidth(0.5);
            doc.line(15, y, pageWidth - 15, y);

            // --- RESUMO GERAL ---
            y += 10;
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...cText);
            doc.text(`${filtered.length} lançamento(s)`, 15, y);

            const totalColor = total < 0 ? cDanger : cSuccess;
            doc.setTextColor(...totalColor);
            
            // Sanitiza o formato de dinheiro removendo \u00A0
            const totalStr = _fmt(Math.abs(total)).replace(/\u00A0/g, ' ');
            const totalPrefix = total < 0 ? '- ' : '+ ';
            doc.text(`${totalPrefix}${totalStr}`, pageWidth - 15, y, { align: 'right' });

            // Helper interno para desenhar o cabeçalho da tabela
            const drawTableHeader = (posY) => {
                let currentY = posY + 10;
                doc.setFontSize(8);
                doc.setTextColor(...cTextLight);
                doc.setFont('helvetica', 'bold');
                doc.text('DATA', 15, currentY);
                doc.text('DESCRIÇÃO', 45, currentY);
                doc.text('VALOR', pageWidth - 15, currentY, { align: 'right' });

                currentY += 4;
                doc.setDrawColor(220, 220, 220);
                doc.setLineWidth(0.2);
                doc.line(15, currentY, pageWidth - 15, currentY);
                return currentY + 8;
            };

            y = drawTableHeader(y);

            // --- ITERAÇÃO DE LINHAS (MOTOR DE PAGINAÇÃO E MULTILINHA) ---
            doc.setFontSize(9);
            const maxDescWidth = 105; // mm de largura para a descrição
            const lineHeight = 5;

            filtered.forEach(t => {
                const dt = new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR');
                
                // Sanitização agressiva: Remove emojis e unicode exótico para evitar quebra de fonte no jsPDF
                let rawDesc = t.desc || '—';
                rawDesc = rawDesc.replace(/[^\x20-\x7E\xA0-\xFF]/g, ''); 
                if (t.isProjected) rawDesc += ' (Recorrente/Projetado)';
                
                // Trata multilinha automaticamente
                const descLines = doc.splitTextToSize(rawDesc, maxDescWidth);
                const blockHeight = descLines.length * lineHeight;

                // Verificação de Quebra de Página
                if (y + blockHeight > pageHeight - 20) {
                    doc.addPage();
                    y = 20;
                    y = drawTableHeader(y);
                    doc.setFontSize(9); // restaura config de fonte
                }

                // Renderiza Data
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...cTextLight);
                doc.text(dt, 15, y);

                // Renderiza Descrição (pode ocupar N linhas)
                doc.setTextColor(...cText);
                doc.text(descLines, 45, y);

                // Renderiza Valor com sinal A11y
                const rawAmount = _fmt(t.amount).replace(/\u00A0/g, ' ');
                const amtPrefix = t.type === 'despesa' ? '- ' : '+ ';
                const amtColor = t.type === 'despesa' ? cDanger : cSuccess;
                
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...amtColor);
                doc.text(`${amtPrefix}${rawAmount}`, pageWidth - 15, y, { align: 'right' });

                y += blockHeight + 2; // Espaçamento entre linhas dinâmico
                
                // Linha divisória sutil
                doc.setDrawColor(240, 240, 240);
                doc.setLineWidth(0.1);
                doc.line(15, y - 1, pageWidth - 15, y - 1);
            });

            if (filtered.length === 0) {
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...cTextLight);
                doc.text('Nenhum registro encontrado para este período.', pageWidth / 2, y + 10, { align: 'center' });
            }

            // --- INSERÇÃO DE NUMERAÇÃO DE PÁGINAS ---
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(7);
                doc.setTextColor(...cTextLight);
                doc.setFont('helvetica', 'normal');
                doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            }

            // --- SALVAR PDF ---
            const cleanCatName = category.replace(/[^a-z0-9]/gi, '_');
            const fileName = `Extrato_${cleanCatName}_${year}_${String(month + 1).padStart(2, '0')}.pdf`;
            doc.save(fileName);

        } catch (e) {
            console.error('[jsPDF Export Erro]:', e);
            if (typeof showToast === 'function') showToast('Erro ao gerar PDF vetorial.', 'danger');
        } finally {
            overlay.style.opacity = '0';
            setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                _isExporting = false;
            }, 300);
        }
    }

    // ===================================================
    // EXPORTAÇÃO PARA PDF (Dashboard original)
    // ===================================================
    async function exportPanelToPDF() {
        const btn = document.getElementById('btn-export-pdf');
        if (!btn || btn.classList.contains('btn-is-loading')) return;

        btn.classList.add('btn-is-loading');
        
        // Libera a thread principal para a GPU pintar o spinner
        await new Promise(r => setTimeout(r, 60));

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            let y = 20;

            // Utilitários de Extração
            const rootStyles = getComputedStyle(document.documentElement);
            const _rgb = (varName, fallback) => _hexToRgb(rootStyles.getPropertyValue(varName).trim() || fallback);
            const cPrimary = _rgb('--primary', '#C9A84C');
            const cText = _rgb('--text', '#1C1A17');
            const cTextLight = _rgb('--text-light', '#6B6150');
            const cDanger = _rgb('--danger', '#E05252');
            const cSuccess = _rgb('--success', '#4CAF7C');

            // Contexto e SSOT
            const ctx = (typeof window.getChartContext === 'function') ? window.getChartContext() : { year: new Date().getFullYear(), month: new Date().getMonth() };
            const gastos = typeof window.getMonthExpenses === 'function' ? window.getMonthExpenses(ctx.month, ctx.year, true) : {};
            const receitas = typeof window.getMonthIncome === 'function' ? window.getMonthIncome(ctx.month, ctx.year) : {};
            const useGroups = typeof CategoryGroups !== 'undefined';
            
            const mLabel = new Date(ctx.year, ctx.month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();

            // 1. Cabeçalho
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(...cPrimary);
            doc.text('Relatório Consolidado por Categoria', pageWidth / 2, y, { align: 'center' });

            y += 6;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...cTextLight);
            doc.text(mLabel, pageWidth / 2, y, { align: 'center' });

            y += 8;
            doc.setDrawColor(...cPrimary);
            doc.setLineWidth(0.5);
            doc.line(15, y, pageWidth - 15, y);
            y += 12;

            // 2. Resumo de Totais
            const totalExp = Object.values(gastos).reduce((s, v) => s + v, 0);
            const totalInc = Object.values(receitas).reduce((s, v) => s + v, 0);
            const saldo = totalInc - totalExp;

            doc.setFontSize(8);
            doc.setTextColor(...cTextLight);
            doc.setFont('helvetica', 'bold');
            doc.text('RECEITAS', 15, y);
            doc.text('DESPESAS', pageWidth / 2, y, { align: 'center' });
            doc.text('SALDO', pageWidth - 15, y, { align: 'right' });

            y += 6;
            doc.setFontSize(11);
            doc.setTextColor(...cSuccess);
            doc.text(_fmt(totalInc).replace(/\u00A0/g, ' '), 15, y);
            
            doc.setTextColor(...cDanger);
            doc.text(_fmt(totalExp).replace(/\u00A0/g, ' '), pageWidth / 2, y, { align: 'center' });
            
            doc.setTextColor(...(saldo >= 0 ? cSuccess : cDanger));
            doc.text(_fmt(saldo).replace(/\u00A0/g, ' '), pageWidth - 15, y, { align: 'right' });

            y += 12;

            const checkPageBreak = (offset = 20) => {
                if (y > pageHeight - offset) {
                    doc.addPage();
                    y = 20;
                    return true;
                }
                return false;
            };

            // 3. Renderização Modular de Listas (Evitando Scraping)
            const renderItemList = (title, items, isIncome = false) => {
                if (items.length === 0) return;
                checkPageBreak();

                doc.setFontSize(11);
                doc.setTextColor(...cText);
                doc.setFont('helvetica', 'bold');
                doc.text(title, 15, y);
                y += 2;
                doc.setDrawColor(220, 220, 220);
                doc.setLineWidth(0.2);
                doc.line(15, y, pageWidth - 15, y);
                y += 6;

                items.forEach(item => {
                    checkPageBreak(15);
                    const valStr = _fmt(item.value).replace(/\u00A0/g, ' ');
                    
                    doc.setFontSize(9);
                    doc.setFont('helvetica', item.isParent ? 'bold' : 'normal');
                    doc.setTextColor(...(item.isChild ? cTextLight : cText));
                    
                    // Trata multilinhas para nomes longos com X dinâmico
                    const xPos = item.isChild ? 22 : 15;
                    const lines = doc.splitTextToSize(item.name, pageWidth - xPos - 40);
                    doc.text(lines, xPos, y);
                    
                    doc.setFont('helvetica', item.isParent ? 'bold' : 'normal');
                    doc.setTextColor(...(isIncome ? cSuccess : cText));
                    doc.text(valStr, pageWidth - 15, y, { align: 'right' });
                    
                    y += (lines.length * 5) + 1;
                    
                    if (!item.isParent) {
                        doc.setDrawColor(245, 245, 245);
                        doc.line(15, y - 2, pageWidth - 15, y - 2);
                    }
                });
                y += 8;
            };

            // Organização de Dados
            const catsInc = Object.entries(receitas).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
            let catsExp = [];

            if (useGroups && Object.keys(gastos).length > 0) {
                const grouped = CategoryGroups.groupExpenses(gastos);
                grouped.forEach(g => {
                    catsExp.push({ name: g.parent.name, value: g.total, isParent: true });
                    g.children.forEach(c => catsExp.push({ name: c.name, value: c.value, isChild: true }));
                });
            } else {
                catsExp = Object.entries(gastos).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
            }

            renderItemList('Receitas por Categoria', catsInc, true);
            renderItemList('Despesas por Categoria', catsExp, false);

            if (catsInc.length === 0 && catsExp.length === 0) {
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...cTextLight);
                doc.text('Nenhum registro para este período.', pageWidth / 2, y + 10, { align: 'center' });
            }

            // 4. Numeração e Download
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(7);
                doc.setTextColor(...cTextLight);
                doc.setFont('helvetica', 'normal');
                doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            }

            const cleanName = mLabel.replace(/[^a-z0-9]/gi, '_');
            doc.save(`Resumo_Categorias_${cleanName}.pdf`);

        } catch (e) {
            console.error('[jsPDF Export Error]:', e);
            if (typeof showToast === 'function') showToast('Erro ao exportar PDF.', 'danger');
        } finally {
            btn.classList.remove('btn-is-loading');
        }
    }

    // API Pública
    return { 
        openBudgetDeviation, 
        openFutureCommitment, 
        openIncomeRigidity, 
        openPaymentMethodReport,
        openImprevistosAlert,
        openCategoryExtract,
        exportPanelToPDF,
        exportImprevistosToPDF,
        exportAITxtReport,
        exportCategoryExtractToPDF,
        _pmFilter,
        _pmMonth,
        _imprevMonth,
        _catExtractMonth,
        _catExtractCategory
    };

})();
