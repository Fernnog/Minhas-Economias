const BudgetModule = (function() {
    // Estado interno (Skeleton - será substituído por Firestore futuramente)
    let budgetLimits = JSON.parse(localStorage.getItem('fin_budgets')) || {};

    function init() {
        const form = document.getElementById('budget-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            save();
        });
        updateCategoryOptions();
    }

    function updateCategoryOptions() {
        const select = document.getElementById('budget-category');
        select.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }

    function save() {
        const cat = document.getElementById('budget-category').value;
        const amt = parseFloat(document.getElementById('budget-amount').value);
        
        budgetLimits[cat] = amt;
        localStorage.setItem('fin_budgets', JSON.stringify(budgetLimits));
        render();
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

        // Atualiza o Card do Mês Centralizado
        const monthCard = document.getElementById('budget-current-month');
        if (monthCard) {
            const dateObj = new Date(currentYear, currentMonth, 1);
            const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
            monthCard.innerText = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${currentYear}`;
        }

        // Calcula gastos por categoria do mês selecionado (NÃO APENAS O ATUAL)
        const monthlyExpenses = transactions.reduce((acc, t) => {
            const d = new Date(t.date + 'T00:00:00');
            if (t.type === 'despesa' && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                acc[t.category] = (acc[t.category] || 0) + t.amount;
            }
            return acc;
        }, {});

        container.innerHTML = Object.entries(budgetLimits).map(([cat, limit]) => {
            const spent = monthlyExpenses[cat] || 0;
            const percent = Math.min((spent / limit) * 100, 100);
            const status = percent > 90 ? 'status-danger' : (percent > 70 ? 'status-warning' : 'status-ok');
            
            return `
                <div class="budget-row">
                    <div class="budget-meta">
                        <span>${cat}</span>
                        <span>R$ ${spent.toFixed(2)} / R$ ${limit.toFixed(2)}</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill ${status}" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        }).join('') || '<p class="text-light">Nenhum orçamento definido.</p>';
    }

    return { init, render };
})();

// Inicializa o módulo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => BudgetModule.init());
