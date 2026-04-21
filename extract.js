const ExtractModule = (function() {
    const list = document.getElementById('transaction-list');
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();

    function init() {
        const picker = document.getElementById('extract-month-picker');
        picker.value = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        picker.addEventListener('change', (e) => {
            const [y, m] = e.target.value.split('-');
            currentMonth = parseInt(m) - 1;
            currentYear = parseInt(y);
            render();
        });
    }

    function render() {
        if (!list) return;
        list.innerHTML = '';
        
        // 1. Filtragem e Cálculo de Saldo Anterior
        const filtered = transactions.filter(t => {
            const d = new Date(t.date + 'T00:00:00');
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        let balance = transactions.reduce((acc, t) => {
            if (new Date(t.date + 'T00:00:00') < new Date(currentYear, currentMonth, 1)) {
                return acc + (t.type === 'receita' ? t.amount : -t.amount);
            }
            return acc;
        }, 0);

        // 2. Agrupamento Diário
        const groups = [...filtered].sort((a,b) => new Date(a.date) - new Date(b.date)).reduce((acc, t) => {
            if (!acc[t.date]) acc[t.date] = { items: [], dayBalance: 0 };
            balance += (t.type === 'receita' ? t.amount : -t.amount);
            acc[t.date].items.push(t);
            acc[t.date].dayBalance = balance;
            return acc;
        }, {});

        // 3. Renderização (Mais recentes primeiro)
        Object.keys(groups).sort((a,b) => new Date(b) - new Date(a)).forEach(date => {
            const group = groups[date];
            const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
            
            list.innerHTML += `<tr class="day-group-header"><td colspan="3">${dateLabel}</td></tr>`;
            
            group.items.forEach(t => {
                list.innerHTML += `
                    <tr class="extract-row">
                        <td><div class="extract-info"><strong>${t.desc}</strong><br><small>${t.category}</small></div></td>
                        <td class="${t.type}">${t.amount.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                        <td class="actions">
                            <button onclick="editTransaction('${t.id}')"><svg>...</svg></button>
                        </td>
                    </tr>`;
            });

            list.innerHTML += `
                <tr class="day-balance-row">
                    <td colspan="3">Saldo do dia: <span class="${group.dayBalance < 0 ? 'despesa' : ''}">${group.dayBalance.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span></td>
                </tr>`;
        });
    }

    return { init, render };
})();
