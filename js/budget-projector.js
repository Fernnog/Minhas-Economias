// ===================================================
// BUDGET PROJECTOR MODULE — Pacing e Alertas
// ===================================================
const BudgetProjectorModule = (function() {
    const STORAGE_KEY = 'fin_projector_config';
    let _config = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { cycleDay: 1, categories: [] };

    // --- Lógica de Data Transversal (Gatilho do Mês) ---
    function _getCycleDates(referenceDate, cycleDay) {
        let start, end, targetMonth, targetYear;
        
        if (referenceDate.getDate() >= cycleDay) {
            // DEPOIS DO CORTE: O ciclo muda a lente para o PRÓXIMO mês civil.
            start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), cycleDay);
            end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, cycleDay - 1, 23, 59, 59);
            
            let nextMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
            targetMonth = nextMonth.getMonth();
            targetYear = nextMonth.getFullYear();
        } else {
            // ANTES DO CORTE: O ciclo mantém a lente no MÊS ATUAL.
            start = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, cycleDay);
            end = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), cycleDay - 1, 23, 59, 59);
            
            targetMonth = referenceDate.getMonth();
            targetYear = referenceDate.getFullYear();
        }
        return { start, end, targetMonth, targetYear };
    }

    // --- Nova API Pública ---
    function getProjectorData(category, referenceDate) {
        if (!_config.categories.includes(category)) return { isTracked: false };

        // 1. Descobre para qual mês civil a lente deve apontar
        const { start, end, targetMonth, targetYear } = _getCycleDates(referenceDate, _config.cycleDay);
        
        // 2. Calcula apenas o percentual de TEMPO da fatura
        const totalDuration = end.getTime() - start.getTime();
        const elapsedDuration = referenceDate.getTime() - start.getTime();
        let timePct = (elapsedDuration / totalDuration) * 100;
        timePct = Math.max(0, Math.min(timePct, 100)); // Trava entre 0 e 100

        // Retorna APENAS os dados de tempo e direção. NÃO calcula dinheiro aqui.
        return {
            isTracked: true,
            timePct,
            cycleLabel: `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth()+1).padStart(2, '0')} a ${String(end.getDate()).padStart(2, '0')}/${String(end.getMonth()+1).padStart(2, '0')}`,
            targetMonth,
            targetYear
        };
    }

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
        let day = parseInt(document.getElementById('projector-cycle-day').value) || 1;
        day = Math.max(1, Math.min(day, 28)); 
        const checkboxes = document.querySelectorAll('#projector-cat-list input[type="checkbox"]:checked');
        const cats = Array.from(checkboxes).map(cb => cb.value);
        
        _config = { cycleDay: day, categories: cats };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_config));
        
        if (typeof FirebaseModule !== 'undefined') {
            FirebaseModule.syncData('preferences', { id: 'projector', data: _config });
        }
        
        document.getElementById('projector-dialog').close();
        ToastModule.show('Projetor atualizado com sucesso!', 'success');
        if (typeof updateAllViews === 'function') updateAllViews(); // Força atualização visual
    }

    // Mantido vazio para não quebrar chamadas antigas se existirem
    function checkAndNotify() {} 

    return { openConfig, saveConfig, checkAndNotify, getProjectorData };
})();
