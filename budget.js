const BudgetModule = (function() {
    let rawBudgets = JSON.parse(localStorage.getItem('fin_budgets'));
    let budgetLimits = Array.isArray(rawBudgets) ? rawBudgets : [];

    // Migração de dados antigos
    if (rawBudgets && !Array.isArray(rawBudgets)) {
        budgetLimits = Object.entries(rawBudgets).map(([cat, amt]) => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            category: cat, amount: amt, type: 'mensal', targetMonth: null
        }));
        localStorage.setItem('fin_budgets', JSON.stringify(budgetLimits));
    }

    function _handleSubmit(e) {
        e.preventDefault();
        save();
    }

    function init() {
        const form = document.getElementById('budget-form');
        if (form) {
            form.removeEventListener('submit', _handleSubmit);
            form.addEventListener('submit', _handleSubmit);
        }
        const picker = document.getElementById('budget-month-picker');
        if (picker) picker.addEventListener('change', () => render());
        updateCategoryOptions();
    }

    function updateCategoryOptions() {
        const select = document.getElementById('budget-category');
        if (!select) return;
        select.innerHTML = categories
            .filter(cat => cat !== 'Sem Categoria') 
            .map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }

    function save() {
        const idField = document.getElementById('budget-id');
        const isUpdate = !!idField.value;
        const cat = document.getElementById('budget-category').value;
        const amt = parseFloat(document.getElementById('budget-amount').value);
        const type = document.getElementById('budget-recurrence').value;
        const picker = document.getElementById('budget-month-picker');

        if (isNaN(amt) || amt <= 0) {
            alert('Informe um valor válido.');
            return;
        }

        let [currentYear, currentMonth] = (picker?.value || "").split('-').map(Number);
        if (!currentYear) {
            currentYear = new Date().getFullYear();
            currentMonth = new Date().getMonth() + 1;
        }
        
        const targetMonth = type === 'unico' ? `${currentYear}-${String(currentMonth).padStart(2, '0')}` : null;
        let itemToSync;

        if (idField.value) {
            const idx = budgetLimits.findIndex(b => b.id === idField.value);
            if (idx > -1) {
                budgetLimits[idx] = { ...budgetLimits[idx], category: cat, amount: amt, type, targetMonth };
                itemToSync = budgetLimits[idx];
            }
            idField.value = '';
        } else {
            const newBudget = { id: Date.now().toString(), category: cat, amount: amt, type, targetMonth };
            budgetLimits.push(newBudget);
            itemToSync = newBudget;
        }

        localStorage.setItem('fin_budgets', JSON.stringify(budgetLimits));
        if (typeof FirebaseModule !== 'undefined' && itemToSync) FirebaseModule.syncData('budgets', itemToSync);

        document.getElementById('budget-form').reset();
        render();
        showToast(isUpdate ? 'Orçamento atualizado!' : 'Novo orçamento definido!');
    }

    function edit(id) {
        const b = budgetLimits.find(x => x.id === id);
        if (!b) return;
        document.getElementById('budget-id').value = b.id;
        document.getElementById('budget-category').value = b.category;
        document.getElementById('budget-amount').value = b.amount;
        document.getElementById('budget-recurrence').value = b.type;
        const collapsible = document.querySelector('.collapsible-card');
        if (collapsible) collapsible.setAttribute('open', 'true');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function remove(id) {
        if (confirm('Excluir orçamento?')) {
            budgetLimits = budgetLimits.filter(x => x.id !== id);
            localStorage.setItem('fin_budgets', JSON.stringify(budgetLimits));
            if (typeof FirebaseModule !== 'undefined') FirebaseModule.deleteData('budgets', id);
            render();
            showToast('Orçamento excluído!');
        }
    }

    function render() {
        const container = document.getElementById('budget-container');
        const picker = document.getElementById('budget-month-picker');

        let [currentYear, currentMonthVal] = (picker?.value || "").split('-').map(Number);
        if (!currentYear) {
            currentYear = new Date().getFullYear();
            currentMonthVal = new Date().getMonth() + 1;
            if (picker) picker.value = `${currentYear}-${String(currentMonthVal).padStart(2, '0')}`;
        }
        const currentMonth = currentMonthVal - 1;

        // --- Uso da Fonte Única da Verdade ---
        const monthlyExpenses = getMonthExpenses(currentMonth, currentYear);

        const activeMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const activeBudgets = budgetLimits.filter(b => (b.type === 'mensal' || b.targetMonth === activeMonthStr));
        const currentPinned = JSON.parse(localStorage.getItem('fin_pinned_budgets')) || [];

        if (container) {
            container.innerHTML = activeBudgets.map(budget => {
                const spent = monthlyExpenses[budget.category] || 0;
                const percent = Math.min((spent / budget.amount) * 100, 100);
                const status = percent > 90 ? 'status-danger' : (percent > 70 ? 'status-warning' : 'status-ok');
                const isPinned = currentPinned.includes(budget.category);
                return `
                    <div class="budget-row">
                        <div class="budget-meta-header">
                            <div class="budget-meta-info">
                                <strong>${budget.category} <small>${budget.type === 'mensal' ? '(Recorrente)' : '(Único)'}</small></strong>
                                <span>${spent.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})} / ${budget.amount.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                            </div>
                            <div class="actions">
                                <button onclick="BudgetModule.togglePin('${budget.category}')" class="btn-pin ${isPinned ? 'pinned' : ''}">Pin</button>
                                <button onclick="BudgetModule.edit('${budget.id}')">Editar</button>
                                <button onclick="BudgetModule.remove('${budget.id}')">Sair</button>
                            </div>
                        </div>
                        <div class="progress-track"><div class="progress-fill ${status}" style="width: ${percent}%"></div></div>
                    </div>
                `;
            }).join('') || '<p>Nenhum orçamento para este mês.</p>';
        }
    }

    function togglePin(category) {
        let currentPinned = JSON.parse(localStorage.getItem('fin_pinned_budgets')) || [];
        currentPinned = currentPinned.includes(category) ? currentPinned.filter(c => c !== category) : [...currentPinned, category];
        localStorage.setItem('fin_pinned_budgets', JSON.stringify(currentPinned));
        showToast(currentPinned.includes(category) ? 'Fixado!' : 'Removido!');
        render(); 
    }

    return { init, render, edit, remove, updateCategoryOptions, togglePin };
})();
