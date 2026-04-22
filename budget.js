const BudgetModule = (function() {
    let rawBudgets = JSON.parse(localStorage.getItem('fin_budgets'));
    let budgetLimits = Array.isArray(rawBudgets) ? rawBudgets : [];

    // Migração: Converte dados antigos (Objeto) para a nova estrutura (Array)
    if (rawBudgets && !Array.isArray(rawBudgets)) {
        budgetLimits = Object.entries(rawBudgets).map(([cat, amt]) => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            category: cat, amount: amt, type: 'mensal', targetMonth: null
        }));
        localStorage.setItem('fin_budgets', JSON.stringify(budgetLimits));
    }

    function init() {
        const form = document.getElementById('budget-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            save();
        });
        
        const picker = document.getElementById('budget-month-picker');
        if (picker) {
            picker.addEventListener('change', () => render());
        }
        
        updateCategoryOptions();
    }

    function updateCategoryOptions() {
        const select = document.getElementById('budget-category');
        select.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }

    function save() {
        const idField = document.getElementById('budget-id');
        const cat = document.getElementById('budget-category').value;
        const amtInput = document.getElementById('budget-amount').value;
        const amt = parseFloat(amtInput);
        const type = document.getElementById('budget-recurrence').value;
        const picker = document.getElementById('budget-month-picker');
        
        // 1. Prevenção do erro NaN
        if (isNaN(amt) || amt <= 0) {
            alert("Por favor, insira um valor numérico válido para o orçamento.");
            return;
        }

        let currentMonth = new Date().getMonth() + 1;
        let currentYear = new Date().getFullYear();
        if (picker && picker.value) {
            [currentYear, currentMonth] = picker.value.split('-');
        }
        const targetMonth = type === 'unico' ? `${currentYear}-${String(currentMonth).padStart(2, '0')}` : null;

        let savedBudget;

        if (idField.value) {
            const idx = budgetLimits.findIndex(b => b.id === idField.value);
            if(idx > -1) {
                budgetLimits[idx] = { ...budgetLimits[idx], category: cat, amount: amt, type, targetMonth };
                savedBudget = budgetLimits[idx];
            }
            idField.value = '';
            document.getElementById('btn-save-budget').innerText = 'Definir Orçamento';
        } else {
            // 2. Prevenção de duplicação: Verifica se já existe um orçamento para esta mesma categoria e contexto
            const existingIdx = budgetLimits.findIndex(b => b.category === cat && b.type === type && b.targetMonth === targetMonth);
            
            if (existingIdx > -1) {
                // Se já existe, atualiza o valor do existente em vez de criar um novo
                budgetLimits[existingIdx] = { ...budgetLimits[existingIdx], amount: amt };
                savedBudget = budgetLimits[existingIdx];
            } else {
                // Se não existe, cria normalmente
                savedBudget = { id: Date.now().toString(), category: cat, amount: amt, type, targetMonth };
                budgetLimits.push(savedBudget);
            }
        }
        
        localStorage.setItem('fin_budgets', JSON.stringify(budgetLimits));
        
        // 3. Sincronização Firebase segura (usando o objeto exato salvo/atualizado)
        if (typeof FirebaseModule !== 'undefined' && savedBudget) {
            FirebaseModule.syncData('budgets', savedBudget);
        }

        document.getElementById('budget-form').reset();
        render();
    }

    function edit(id) {
        const b = budgetLimits.find(x => x.id === id);
        if(!b) return;
        document.getElementById('budget-id').value = b.id;
        document.getElementById('budget-category').value = b.category;
        document.getElementById('budget-amount').value = b.amount;
        document.getElementById('budget-recurrence').value = b.type;
        document.getElementById('btn-save-budget').innerText = 'Atualizar Orçamento';
        document.querySelector('.collapsible-card').setAttribute('open', 'true');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function remove(id) {
        if(confirm('Deseja excluir este orçamento?')) {
            budgetLimits = budgetLimits.filter(x => x.id !== id);
            localStorage.setItem('fin_budgets', JSON.stringify(budgetLimits));
            
            // Sincronização Firebase (Remoção)
            if (typeof FirebaseModule !== 'undefined') {
                FirebaseModule.deleteData('budgets', id);
            }
            
            render();
        }
    }

    function render() {
        const container = document.getElementById('budget-container');
        const picker = document.getElementById('budget-month-picker');
        
        let currentMonth = new Date().getMonth();
        let currentYear = new Date().getFullYear();

        if (picker && picker.value) {
            const [y, m] = picker.value.split('-');
            currentMonth = parseInt(m) - 1;
            currentYear = parseInt(y);
        } else if (picker) {
             picker.value = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        }

        const monthCard = document.getElementById('budget-current-month');
        if (monthCard) {
            const dateObj = new Date(currentYear, currentMonth, 1);
            const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
            monthCard.innerText = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${currentYear}`;
        }

        // 4. Inteligência de varredura (incluindo despesas projetadas/recorrentes do mês todo)
        const monthlyExpenses = {};

        transactions.forEach(t => {
            if (t.type !== 'despesa') return;

            const d = new Date(t.date + 'T00:00:00');
            const tMonth = d.getMonth();
            const tYear = d.getFullYear();

            // Lançamentos do próprio mês
            if (tMonth === currentMonth && tYear === currentYear) {
                monthlyExpenses[t.category] = (monthlyExpenses[t.category] || 0) + t.amount;
            } 
            // Lançamentos projetados (recorrentes vindos de meses anteriores)
            else if (t.isRecurring && (tYear < currentYear || (tYear === currentYear && tMonth < currentMonth))) {
                const dataTermino = t.recurrenceEndDate ? new Date(t.recurrenceEndDate) : null;
                const dataVisualizada = new Date(currentYear, currentMonth, 1);
                
                if (!dataTermino || dataVisualizada < dataTermino) {
                    monthlyExpenses[t.category] = (monthlyExpenses[t.category] || 0) + t.amount;
                }
            }
        });

        const activeMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const activeBudgets = budgetLimits.filter(b => b.type === 'mensal' || b.targetMonth === activeMonthStr);

        container.innerHTML = activeBudgets.map(budget => {
            const spent = monthlyExpenses[budget.category] || 0;
            const percent = Math.min((spent / budget.amount) * 100, 100);
            const status = percent > 90 ? 'status-danger' : (percent > 70 ? 'status-warning' : 'status-ok');
            
            return `
                <div class="budget-row">
                    <div class="budget-meta-header">
                        <div class="budget-meta-info">
                            <strong>${budget.category} <small>${budget.type === 'mensal' ? '(Recorrente)' : '(Apenas este mês)'}</small></strong>
                            <span style="font-size:0.9rem; font-weight:500;">R$ ${spent.toFixed(2)} / R$ ${budget.amount.toFixed(2)}</span>
                        </div>
                        <div class="actions">
                            <button onclick="BudgetModule.edit('${budget.id}')" title="Editar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                            <button onclick="BudgetModule.remove('${budget.id}')" title="Excluir"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                        </div>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill ${status}" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        }).join('') || '<p class="text-light" style="text-align:center;">Nenhum orçamento definido para este mês.</p>';
    }

    function loadFromStorage() {
        const rawBudgets = JSON.parse(localStorage.getItem('fin_budgets'));
        budgetLimits = Array.isArray(rawBudgets) ? rawBudgets : [];
        render();
    }

    return { init, render, edit, remove, updateCategoryOptions, loadFromStorage };
})();

document.addEventListener('DOMContentLoaded', () => BudgetModule.init());
