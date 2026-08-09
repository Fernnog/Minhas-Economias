const ExtractModule = (function() {
    const list = document.getElementById('transaction-list');
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();

    // === ESTADO: CONFERÊNCIA, FILTRO E BUSCA ===
    // 0 = todos | 1 = somente conferidos | 2 = somente pendentes
    let filterMode = 0;
    let searchQuery = ''; 
    let searchDebounce = null; // Controle anti-travamento para digitação rápida
    let confirmedItems = JSON.parse(localStorage.getItem('fin_confirmed_items') || '{}');

    function _saveConfirmed() {
        localStorage.setItem('fin_confirmed_items', JSON.stringify(confirmedItems));
    }

    function _confirmKey(id, date) {
        return `${id}|${date}`;
    }

    // Exposta globalmente para uso inline nos elementos renderizados
    window.toggleConfirmed = function(id, date) {
        const key = _confirmKey(id, date);
        if (confirmedItems[key]) {
            delete confirmedItems[key];
        } else {
            confirmedItems[key] = true;
        }
        _saveConfirmed();

        // NOVO: Espelha o dicionário atualizado na nuvem
        if (typeof FirebaseModule !== 'undefined') {
            FirebaseModule.syncData('preferences', { id: 'confirmed_items', items: confirmedItems });
        }

        render();
    };

    // Cicla entre os 3 modos de filtro e atualiza o visual do botão
    window.cycleExtractFilter = function() {
        filterMode = (filterMode + 1) % 3;

        const messages = [
            '📋 Exibindo todos os lançamentos',
            '✓ Exibindo apenas conferidos',
            '⏳ Exibindo apenas pendentes de conferência'
        ];
        showToast(messages[filterMode]);

        const btn = document.getElementById('btn-filter-extract');
        if (btn) {
            btn.dataset.filterMode = filterMode;
        }

        render();
    };

    // --- NOVA LÓGICA DE ROLAGEM ---
    function _setupScrollButtons() {
        const btnTop = document.getElementById('btn-scroll-top');
        const btnBottom = document.getElementById('btn-scroll-bottom');
        const container = document.getElementById('extract-scroll-controls');
        
        if (!btnTop || !btnBottom || !container) return;

        // Ações de clique (Rolagem Suave)
        btnTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        btnBottom.addEventListener('click', () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));

        const scrollToInvoiceCycle = (targetDay) => {
            const headers = Array.from(document.querySelectorAll('.day-group-header'));
            if (headers.length === 0) return;

            // 1. Encontra o dia exato ou o dia anterior mais próximo
            const availableDays = headers.map(h => parseInt(h.dataset.day));
            const validDays = availableDays.filter(d => d <= targetDay);
            
            if (validDays.length === 0) {
                showToast(`Nenhuma transação até o dia ${targetDay} encontrada.`, 'warning');
                return;
            }

            const closestDay = Math.max(...validDays);
            const targetHeader = headers.find(h => parseInt(h.dataset.day) === closestDay);
            
            // 2. Foco na PRIMEIRA compra cronológica (a ÚLTIMA linha antes de fechar o dia)
            let current = targetHeader.nextElementSibling;
            let targetRow = null;

            while (current && current.classList.contains('extract-row')) {
                targetRow = current; // Salva a linha e avança
                current = current.nextElementSibling;
            }

            // Fallback de segurança (se não achar linhas, vai para o título do dia)
            if (!targetRow) targetRow = targetHeader;

            // 3. Centraliza a compra escolhida exatamente no meio da tela
            targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // UX Feedback Visual
            const msg = closestDay === targetDay 
                ? `Primeira compra do ciclo localizada (Dia ${targetDay}).` 
                : `Dia ${targetDay} vazio. Retrocedendo para o dia ${closestDay}.`;
            showToast(msg);
            
            // Pisca a linha em amarelo para guiar o olhar
            targetRow.style.transition = 'background-color 0.5s';
            targetRow.style.backgroundColor = 'rgba(201, 168, 76, 0.25)';
            setTimeout(() => targetRow.style.backgroundColor = '', 1500);
        };

        const btnPassai = document.getElementById('btn-scroll-passai');
        const btnCef = document.getElementById('btn-scroll-cef');
        
        // Agora ambos executam a mesma regra de "fundo de funil" (última linha do dia)
        if (btnPassai) btnPassai.addEventListener('click', () => scrollToInvoiceCycle(24));
        if (btnCef) btnCef.addEventListener('click', () => scrollToInvoiceCycle(25));

        let isScrolling = false;

        // Ouve o scroll do navegador com otimização (requestAnimationFrame)
        window.addEventListener('scroll', () => {
            const extractView = document.getElementById('view-extract');
            // Só executa se estivermos na tela de Extrato
            if (!extractView || extractView.classList.contains('hidden')) {
                if (!container.classList.contains('hidden')) container.classList.add('hidden');
                return;
            }

            container.classList.remove('hidden');

            if (!isScrolling) {
                window.requestAnimationFrame(() => {
                    const scrollY = window.scrollY;
                    const windowHeight = window.innerHeight;
                    const documentHeight = document.documentElement.scrollHeight;
                    
                    // Margens de tolerância (100px)
                    const thresholdTop = 100;
                    const thresholdBottom = 100;

                    // Controle do Botão TOPO (Soma se estiver perto do topo)
                    if (scrollY <= thresholdTop) {
                        btnTop.classList.add('hidden');
                    } else {
                        btnTop.classList.remove('hidden');
                    }

                    // Controle do Botão RODAPÉ (Soma se estiver no fim da página)
                    if (scrollY + windowHeight >= documentHeight - thresholdBottom) {
                        btnBottom.classList.add('hidden');
                    } else {
                        btnBottom.classList.remove('hidden');
                    }

                    isScrolling = false;
                });
                isScrolling = true;
            }
        });
    }

    function init() {
        const picker = document.getElementById('extract-month-picker');
        if (picker) {
            picker.value = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
            picker.addEventListener('change', (e) => {
                const [y, m] = e.target.value.split('-');
                currentMonth = parseInt(m) - 1;
                currentYear = parseInt(y);
                
                // CORREÇÃO CRÍTICA: Reset do estado da busca ao mudar o mês
                searchQuery = '';
                const searchInput = document.getElementById('extract-search-input');
                const searchClear = document.getElementById('extract-search-clear');
                if (searchInput) searchInput.value = '';
                if (searchClear) searchClear.classList.add('hidden');
                
                render();
            });
        }

        // Listeners da Busca Investigativa com Debounce (Performance)
        const searchInput = document.getElementById('extract-search-input');
        const searchClear = document.getElementById('extract-search-clear');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchDebounce);
                searchDebounce = setTimeout(() => {
                    searchQuery = e.target.value.trim().toLowerCase();
                    if (searchClear) searchClear.classList.toggle('hidden', searchQuery === '');
                    render();
                }, 150); // Aguarda 150ms de pausa na digitação antes de renderizar
            });
        }

        if (searchClear) {
            searchClear.addEventListener('click', () => {
                searchInput.value = '';
                searchQuery = '';
                searchClear.classList.add('hidden');
                render();
                searchInput.focus();
            });
        }

        // Inicializa os botões flutuantes de rolagem
        _setupScrollButtons();
    }

    /**
     * Helper para renderizar o chip no extrato usando a config central
     */
    function _renderExtractChip(method) {
        if (!method || !PAYMENT_CONFIG[method]) return '';
        const c = PAYMENT_CONFIG[method];
        if (c.clsExtract === '') return '';
        return `<span class="payment-chip ${c.clsExtract}" title="${c.title}">${c.svg}</span>`;
    }

    // SVG de check leve usado dentro do nome quando conferido
    const _checkSvg = `<svg class="confirm-check-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    function render() {
        if (!list) return;
        list.innerHTML = '';

        // --- Monta lista base do mês ---
        const allMonth = [];
        const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        
        transactions.forEach(t => {
            // Delega TUDO para a SSOT global
            if (window.isTransactionActiveInMonth(t, currentYear, currentMonth)) {
                const isOriginMonth = t.date.slice(0, 7) === currentMonthStr;
                const projDateStr = isOriginMonth ? t.date : `${currentMonthStr}-${t.date.slice(8, 10)}`;
                
                if (isOriginMonth) {
                    allMonth.push(t);
                } else {
                    allMonth.push({ ...t, id: t.id + '_proj', date: projDateStr });
                }
            }
        });

        // --- Aplica filtro de conferência ---
        let filtered = filterMode === 0
            ? allMonth
            : allMonth.filter(t => {
                const isConf = !!confirmedItems[_confirmKey(t.id, t.date)];
                return filterMode === 1 ? isConf : !isConf;
            });

        // --- Aplica Busca Investigativa (Dual: Texto e Valor) ---
        let searchTotalSum = 0;
        let searchCount = 0;

        if (searchQuery) {
            filtered = filtered.filter(t => {
                const descMatch = t.desc.toLowerCase().includes(searchQuery);
                const catMatch = t.category.toLowerCase().includes(searchQuery);
                
                const valCents = t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                const valPlain = t.amount.toString();
                const valMatch = valCents.includes(searchQuery) || valPlain.includes(searchQuery);

                if (descMatch || catMatch || valMatch) {
                    searchTotalSum += (t.type === 'receita' ? t.amount : -t.amount);
                    searchCount++;
                    return true;
                }
                return false;
            });
        }

        // --- Gestão do Mini-Relatório Dinâmico UI ---
        const reportContainer = document.getElementById('extract-search-report');
        if (searchQuery) {
            const formattedTotal = Math.abs(searchTotalSum).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const colorClass = searchTotalSum >= 0 ? 'var(--success)' : 'var(--danger)';
            const prefix = searchTotalSum < 0 ? '-' : '';
            
            if (reportContainer) {
                reportContainer.innerHTML = `
                    <div class="search-mini-report">
                        <span>🔍 <strong>${searchCount}</strong> resultado(s) para "${searchQuery}"</span>
                        <span style="color: ${colorClass};">${prefix}${formattedTotal}</span>
                    </div>
                `;
                reportContainer.classList.remove('hidden');
            }
        } else {
            if (reportContainer) {
                reportContainer.classList.add('hidden');
                reportContainer.innerHTML = ''; // Limpeza de memória
            }
        }

        // --- Saldo acumulado (Seed Balance) via SSOT ---
        // Calcula o saldo exato até as 23:59:59 do último dia do mês ANTERIOR
        const dataInicioMes = new Date(currentYear, currentMonth, 1);
        const dataFimMesAnterior = new Date(dataInicioMes.getTime() - 1); 
        
        // Chamada única ao motor matemático pesado
        let balance = typeof window.calculateCumulativeBalanceUpTo === 'function' 
            ? window.calculateCumulativeBalanceUpTo(dataFimMesAnterior)
            : 0;

        // --- Agrupa por data (Usa o reduce com matemática leve O(N)) ---
        const groups = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date)).reduce((acc, t) => {
            if (!acc[t.date]) acc[t.date] = { items: [], dayBalance: 0 };
            balance += (t.type === 'receita' ? t.amount : -t.amount);
            acc[t.date].items.push(t);
            acc[t.date].dayBalance = balance;
            return acc;
        }, {});

        if (Object.keys(groups).length === 0) {
            list.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:2rem;color:var(--text-light);font-size:0.9rem;">Nenhum lançamento para exibir.</td></tr>`;
            return;
        }

        Object.keys(groups).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
            const group = groups[date];
            const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();

            // Extrai o dia para o data-attribute ignorando fuso horário
            const diaStr = date.split('-')[2];
            list.innerHTML += `<tr class="day-group-header" data-day="${diaStr}"><td colspan="3">${dateLabel}</td></tr>`;

            group.items.forEach(t => {
                const isVirtual = t.id.includes('_proj');
                const isConf = !!confirmedItems[_confirmKey(t.id, t.date)];
                const confClass = isConf ? 'confirmed' : '';
                const confTitle = isConf ? 'Clique para desmarcar como conferido' : 'Clique para marcar como conferido';

                list.innerHTML += `
                    <tr class="extract-row ${confClass}">
                        <td>
                            <div class="extract-info">
                                <div class="extract-info-header">
                                    ${_renderExtractChip(t.paymentMethod)}
                                    <strong>
                                        <span class="extract-name ${confClass}"
                                              onclick="toggleConfirmed('${t.id}', '${t.date}')"
                                              title="${confTitle}">
                                            ${isConf ? _checkSvg : ''}${t.desc}
                                        </span>
                                        ${isVirtual ? '<small>(Recorrente)</small>' : ''}
                                    </strong>
                                </div>
                                <small>${t.category}</small>
                            </div>
                        </td>
                        <td class="${t.type}">${t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td class="actions">
                            ${!isVirtual ? `
                            <button onclick="editTransaction('${t.id}')" title="Editar">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button onclick="deleteTransaction('${t.id}')" title="Excluir">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                            ` : `
                            <button onclick="editSingleProjected('${t.id}', '${t.date}')" title="Editar apenas este mês">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button onclick="stopRecurrence('${t.id}', '${t.date}')" title="Parar Repetição a partir daqui" style="color: var(--danger);">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                            </button>
                            `}
                        </td>
                    </tr>`;
            });

            if (!searchQuery) {
                list.innerHTML += `
                    <tr class="day-balance-row">
                        <td colspan="3">Saldo do dia: <span class="${group.dayBalance < 0 ? 'despesa' : ''}">${group.dayBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></td>
                    </tr>`;
            }
        });

        // NOVO: Força um evento de scroll falso para recalcular botões após remontar a lista
        setTimeout(() => window.dispatchEvent(new Event('scroll')), 100);
    }

    function loadConfirmedFromCloud(cloudData) {
        if (cloudData) {
            confirmedItems = cloudData;
            _saveConfirmed(); // Garante que o localStorage local também fique atualizado
            render();
        }
    }

    return { init, render, loadConfirmedFromCloud };
})();
