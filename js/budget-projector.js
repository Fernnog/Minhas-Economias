// ===================================================
// BUDGET PROJECTOR MODULE — Pacing e Alertas
// ===================================================
const BudgetProjectorModule = (function() {
    const STORAGE_KEY = 'fin_projector_config';
    let _config = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { cycleDay: 1, categories: [] };
    const MILESTONES = [25, 50, 75, 100];

    // --- Lógica de Data Transversal ---
    function _getCycleDates(today, cycleDay) {
        let start, end;
        if (today.getDate() >= cycleDay) {
            start = new Date(today.getFullYear(), today.getMonth(), cycleDay);
            end = new Date(today.getFullYear(), today.getMonth() + 1, cycleDay - 1, 23, 59, 59);
        } else {
            start = new Date(today.getFullYear(), today.getMonth() - 1, cycleDay);
            end = new Date(today.getFullYear(), today.getMonth(), cycleDay - 1, 23, 59, 59);
        }
        return { start, end };
    }

    // --- Filtro Otimizado de Transações ---
    function _getExpensesInDateRange(start, end, category) {
        const txns = JSON.parse(localStorage.getItem('fin_transactions')) || [];
        let total = 0;

        txns.forEach(t => {
            if (t.type !== 'despesa' || t.category !== category) return;
            const d = new Date(t.date + 'T00:00:00');
            
            if (t.isRecurring) {
                // Simplificação: para recorrências, projetamos a data dentro do mês de 'start' e 'end'
                const projDate = new Date(start.getFullYear(), start.getMonth(), d.getDate());
                if (projDate >= start && projDate <= end) {
                    if (!t.recurrenceEndDate || projDate < new Date(t.recurrenceEndDate)) {
                        total += t.amount;
                    }
                }
                const projDateNext = new Date(end.getFullYear(), end.getMonth(), d.getDate());
                if (projDateNext > projDate && projDateNext >= start && projDateNext <= end) {
                    if (!t.recurrenceEndDate || projDateNext < new Date(t.recurrenceEndDate)) {
                        total += t.amount;
                    }
                }
            } else {
                if (d >= start && d <= end) total += t.amount;
            }
        });
        return total;
    }

    // --- API Pública ---
    function openConfig() {
        document.getElementById('projector-cycle-day').value = _config.cycleDay;
        const budgets = JSON.parse(localStorage.getItem('fin_budgets')) || [];
        const container = document.getElementById('projector-cat-list');
        
        container.innerHTML = budgets.map(b => `
            <label class="projector-cat-item">
                <input type="checkbox" value="${b.category}" ${_config.categories.includes(b.category) ? 'checked' : ''}>
                <span style="font-weight: 600;">${b.category}</span>
                <span style="margin-left: auto; font-size: 0.8rem; color: var(--text-light);">Lim: R$ ${b.amount.toFixed(2)}</span>
            </label>
        `).join('');
        
        document.getElementById('projector-dialog').showModal();
    }

    function saveConfig() {
        const day = parseInt(document.getElementById('projector-cycle-day').value) || 1;
        const checkboxes = document.querySelectorAll('#projector-cat-list input[type="checkbox"]:checked');
        const cats = Array.from(checkboxes).map(cb => cb.value);
        
        _config = { cycleDay: day, categories: cats };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_config));
        
        if (typeof FirebaseModule !== 'undefined') {
            FirebaseModule.syncData('preferences', { id: 'projector', data: _config });
        }
        
        document.getElementById('projector-dialog').close();
        ToastModule.show('Projetor atualizado com sucesso!', 'success');
        checkAndNotify(); // Teste imediato
    }

    function checkAndNotify() {
        if (!_config.categories || _config.categories.length === 0) return;
        
        const today = new Date();
        const { start, end } = _getCycleDates(today, _config.cycleDay);
        
        const totalDuration = end.getTime() - start.getTime();
        const elapsedDuration = today.getTime() - start.getTime();
        const timePct = (elapsedDuration / totalDuration) * 100;
        
        // Identifica o maior marco de tempo alcançado
        let activeMilestone = 0;
        [75, 50, 25].forEach(m => { if (timePct >= m && activeMilestone === 0) activeMilestone = m; });
        if (activeMilestone === 0) return; // Não atingiu 25% ainda

        const budgets = JSON.parse(localStorage.getItem('fin_budgets')) || [];
        const cycleKey = start.toISOString().split('T')[0];

        _config.categories.forEach(cat => {
            const budget = budgets.find(b => b.category === cat);
            if (!budget) return;

            const spent = _getExpensesInDateRange(start, end, cat);
            const spentPct = (spent / budget.amount) * 100;

            if (spentPct >= activeMilestone) {
                const alertKey = `proj_${cycleKey}_${activeMilestone}pct_${cat}`;
                if (!localStorage.getItem(alertKey)) {
                    // Prevenir bloqueio da thread UI
                    requestAnimationFrame(() => {
                        ToastModule.showMilestone({
                            icon: '⏱️',
                            label: `Alerta Projetor: ${cat}`,
                            msg: `${activeMilestone}% do tempo passou, mas você já gastou ${spentPct.toFixed(0)}% da meta!`,
                            type: 'warning'
                        });
                    });
                    localStorage.setItem(alertKey, '1');
                }
            }
        });
    }

    return { openConfig, saveConfig, checkAndNotify };
})();
