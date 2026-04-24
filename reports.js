const ReportsModule = (function () {

    function _fmt(value) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
    function _getTxns() { return JSON.parse(localStorage.getItem('fin_transactions')) || []; }
    function _getBudgets() { return JSON.parse(localStorage.getItem('fin_budgets')) || []; }

    function _showSkeleton(contentId) {
        const content = document.getElementById(contentId);
        if (content) content.innerHTML = `
            <div class="skeleton-line" style="width: 90%;"></div>
            <div class="skeleton-line" style="width: 70%;"></div>
            <div class="skeleton-line" style="width: 85%;"></div>
        `;
    }

    // RELATÓRIO 1: DESVIO ORÇAMENTÁRIO
    function openBudgetDeviation() {
        _showSkeleton('report1-content');
        document.getElementById('report1-dialog').showModal();

        requestAnimationFrame(() => {
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth();
            const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
            const expenses = getMonthExpenses(month, year);
            const activeBudgets = _getBudgets().filter(b => b.type === 'mensal' || b.targetMonth === monthStr);
            const content = document.getElementById('report1-content');

            if (activeBudgets.length === 0) {
                content.innerHTML = `<p>Nenhum orçamento configurado.</p>`;
                return;
            }

            const rows = activeBudgets.map(b => {
                const spent = expenses[b.category] || 0;
                return { category: b.category, spent, limit: b.amount, diff: b.amount - spent };
            }).sort((a, b) => a.diff - b.diff);

            content.innerHTML = `<div class="report-table">${rows.map(r => `
                <div class="report-row">
                    <span>${r.category}</span>
                    <span>${_fmt(r.spent)} / ${_fmt(r.limit)}</span>
                    <span class="report-pill ${r.diff < 0 ? 'pill-danger' : 'pill-success'}">${r.diff < 0 ? '-' : '+'}${_fmt(Math.abs(r.diff))}</span>
                </div>`).join('')}</div>`;
        });
    }

    // RELATÓRIO 2: COMPROMETIMENTO FUTURO
    function openFutureCommitment() {
        _showSkeleton('report2-content');
        document.getElementById('report2-dialog').showModal();

        requestAnimationFrame(() => {
            const today = new Date();
            const months = Array.from({ length: 6 }, (_, i) => {
                const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
            });

            const data = months.map(({ year, month }) => {
                const expenses = getMonthExpenses(month, year);
                const total = Object.values(expenses).reduce((a, b) => a + b, 0);
                return { year, month, total };
            });

            const maxTotal = Math.max(...data.map(d => d.total), 1);
            const content = document.getElementById('report2-content');
            content.innerHTML = `<div class="commitment-chart">${data.map(d => {
                const pct = (d.total / maxTotal) * 100;
                const label = new Date(d.year, d.month, 1).toLocaleDateString('pt-BR', { month: 'short' });
                return `<div class="commitment-month-row">
                    <span>${label}</span>
                    <div class="commitment-bar-track"><div class="commitment-segment-fixed" style="width: ${pct}%"></div></div>
                    <span>${_fmt(d.total)}</span>
                </div>`;
            }).join('')}</div>`;
        });
    }

    // RELATÓRIO 3: MAPA DE ENGESSAMENTO
    function openIncomeRigidity() {
        _showSkeleton('report3-content');
        document.getElementById('report3-dialog').showModal();

        requestAnimationFrame(() => {
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth();
            const txns = _getTxns();
            let income = 0;
            txns.forEach(t => { if(t.type === 'receita') income += t.amount; });

            const expenses = getMonthExpenses(month, year);
            const totalExp = Object.values(expenses).reduce((a, b) => a + b, 0);
            const rigidity = income > 0 ? Math.round((totalExp / income) * 100) : 0;
            const content = document.getElementById('report3-content');

            content.innerHTML = `
                <div class="rigidity-index-banner ${rigidity > 70 ? 'status-danger' : 'status-ok'}">
                    <span>Índice: ${rigidity}%</span>
                    <p>${_fmt(totalExp)} gastos contra ${_fmt(income)} de receita.</p>
                </div>`;
        });
    }

    return { openBudgetDeviation, openFutureCommitment, openIncomeRigidity };
})();
