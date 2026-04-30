// ============================================================
// ARQUIVO: js/category-manager.js
// Central de Gerenciamento de Categorias
// Deve ser carregado ANTES de budget.js e script.js no HTML
// ============================================================

const CategoryManager = (function () {

    const STORAGE_KEY = 'fin_categories';
    const PROTECTED   = ['Sem Categoria'];

    // ----------------------------------------------------------
    // 1. LEITURA E ESCRITA (Fonte da Verdade)
    // ----------------------------------------------------------

    function _load() {
        try {
            const raw    = localStorage.getItem(STORAGE_KEY);
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : _getDefaults();
        } catch {
            return _getDefaults();
        }
    }

    function _getDefaults() {
        return ['Alimentação', 'Moradia', 'Transporte', 'Salário', 'Lazer', 'Sem Categoria'];
    }

    function _persist(newList) {
        // Garante que a categoria protegida sempre existe
        if (!newList.includes('Sem Categoria')) {
            newList.push('Sem Categoria');
        }

        // Ordena alfabeticamente, mantendo 'Sem Categoria' sempre no fim
        newList.sort((a, b) => {
            if (a === 'Sem Categoria') return 1;
            if (b === 'Sem Categoria') return -1;
            return a.localeCompare(b, 'pt-BR');
        });

        // Atualiza a variável global usada pelo restante da aplicação
        categories.length = 0;
        newList.forEach(c => categories.push(c));

        localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));

        // Propaga a mudança para todos os módulos
        _notifyAll();
    }

    // ----------------------------------------------------------
    // 2. NOTIFICAÇÃO DOS MÓDULOS (O Quadro de Avisos Central)
    // ----------------------------------------------------------

    function _notifyAll() {
        if (typeof updateCategorySelect === 'function') {
            updateCategorySelect();
        }
        if (typeof BudgetModule !== 'undefined') {
            BudgetModule.updateCategoryOptions();
        }
        _renderList();
    }

    // ----------------------------------------------------------
    // 3. OPERAÇÕES CRUD
    // ----------------------------------------------------------

    function add(name, parentId = '') {
        if (!name || !name.trim()) {
            showToast('Digite um nome para a categoria.');
            return false;
        }
        const normalized = name.trim();
        if (categories.map(c => c.toLowerCase()).includes(normalized.toLowerCase())) {
            showToast('Já existe uma categoria com esse nome.');
            return false;
        }

        const newList = [...categories, normalized];
        _persist(newList);

        // Salva a relação de subcategoria no grupo pai escolhido
        if (parentId && typeof CategoryGroups !== 'undefined') {
            CategoryGroups.addSubcategory(parentId, normalized);
        }

        // Sincroniza com a nuvem enviando o vínculo do pai
        if (typeof FirebaseModule !== 'undefined') {
            FirebaseModule.syncData('categories', { id: normalized, name: normalized, parentId: parentId });
        }

        showToast(`Categoria "${normalized}" criada com sucesso!`);
        return true;
    }

    function _edit(originalName, newName, parentId = '') {
        if (!newName || !newName.trim()) {
            showToast('O nome não pode ser vazio.');
            return false;
        }
        const trimmed = newName.trim();

        if (PROTECTED.includes(originalName)) {
            showToast(`A categoria "${originalName}" é protegida e não pode ser renomeada.`);
            return false;
        }
        if (
            trimmed.toLowerCase() !== originalName.toLowerCase() &&
            categories.map(c => c.toLowerCase()).includes(trimmed.toLowerCase())
        ) {
            showToast('Já existe uma categoria com esse nome.');
            return false;
        }

        const newList = categories.map(c => (c === originalName ? trimmed : c));
        _persist(newList);

        // --- CORREÇÃO: Atualiza a hierarquia no módulo CategoryGroups ---
        if (typeof CategoryGroups !== 'undefined') {
            // 1. Remove o nome antigo de qualquer grupo que ele estivesse
            CategoryGroups.removeSubcategory(originalName);
            
            // 2. Se o usuário escolheu um grupo, adiciona o novo nome a ele
            if (parentId) {
                CategoryGroups.addSubcategory(parentId, trimmed);
            }
        }

        // Nuvem: remove o antigo, cria o novo (agora com parentId)
        if (typeof FirebaseModule !== 'undefined') {
            FirebaseModule.deleteData('categories', originalName);
            FirebaseModule.syncData('categories', { id: trimmed, name: trimmed, parentId: parentId });
        }

        showToast(`Categoria salva com sucesso!`);
        return true;
    }

    function remove(name) {
        if (PROTECTED.includes(name)) {
            showToast(`A categoria "${name}" é protegida e não pode ser excluída.`);
            return;
        }
        if (!confirm(`Excluir a categoria "${name}"?\n\nOs lançamentos existentes com esta categoria não serão afetados.`)) return;

        const newList = categories.filter(c => c !== name);
        _persist(newList);

        // Limpa a categoria excluída do seu grupo pai
        if (typeof CategoryGroups !== 'undefined') {
            CategoryGroups.removeSubcategory(name);
        }

        if (typeof FirebaseModule !== 'undefined') {
            FirebaseModule.deleteData('categories', name);
        }

        showToast(`Categoria "${name}" excluída.`);
    }

    // ----------------------------------------------------------
    // 4. ESTADO DA UI (Modo: Adicionar vs. Editar)
    // ----------------------------------------------------------

    function _setAddMode() {
        const input        = document.getElementById('new-category-input');
        const btnSave      = document.getElementById('btn-save-category');
        const btnCancel    = document.getElementById('btn-cancel-category-edit');
        const hiddenField  = document.getElementById('category-edit-original');
        const parentSelect = document.getElementById('category-manager-parent');

        if (input)        { input.value = ''; input.placeholder = 'Nome da categoria...'; }
        if (btnSave)      { btnSave.textContent = 'Adicionar'; }
        if (btnCancel)    { btnCancel.classList.add('hidden'); }
        if (hiddenField)  { hiddenField.value = ''; }
        
        // CORREÇÃO: Limpa o seletor de grupo ao voltar pro modo Adicionar
        if (parentSelect) { parentSelect.value = ''; }

        document.querySelectorAll('#category-list li.is-editing')
            .forEach(li => li.classList.remove('is-editing'));
    }

    function startEdit(name) {
        const input        = document.getElementById('new-category-input');
        const btnSave      = document.getElementById('btn-save-category');
        const btnCancel    = document.getElementById('btn-cancel-category-edit');
        const hiddenField  = document.getElementById('category-edit-original');
        const panel        = document.getElementById('category-manager-panel');
        const parentSelect = document.getElementById('category-manager-parent');

        if (hiddenField) hiddenField.value = name;
        if (input)       { input.value = name; input.focus(); }
        if (btnSave)     { btnSave.textContent = 'Salvar Alteração'; }
        if (btnCancel)   { btnCancel.classList.remove('hidden'); }
        if (panel)       { panel.setAttribute('open', ''); }

        // CORREÇÃO: Descobre quem é o grupo pai atual e preenche o <select>
        if (parentSelect && typeof CategoryGroups !== 'undefined') {
            const currentParent = CategoryGroups.getParentOf(name);
            parentSelect.value = currentParent ? currentParent.id : '';
        }

        document.querySelectorAll('#category-list li').forEach(li => {
            li.classList.toggle('is-editing', li.dataset.cat === name);
        });

        window.scrollTo({ top: panel ? panel.offsetTop - 20 : 0, behavior: 'smooth' });
    }

    // ----------------------------------------------------------
    // 5. RENDERIZAÇÃO DA LISTA
    // ----------------------------------------------------------

    function _renderList() {
        const ul = document.getElementById('category-list');
        if (!ul) return;

        if (categories.length === 0) {
            ul.innerHTML = '<li style="justify-content:center; color: var(--text-light); font-size:0.875rem;">Nenhuma categoria cadastrada.</li>';
            return;
        }

        ul.innerHTML = categories.map(cat => {
            const isProtected = PROTECTED.includes(cat);
            return `
                <li data-cat="${cat}">
                    <span class="cat-name">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="var(--text-light)"
                             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                            <line x1="7" y1="7" x2="7.01" y2="7"></line>
                        </svg>
                        ${cat}
                        ${isProtected ? '<span class="cat-protected-badge">protegida</span>' : ''}
                    </span>
                    <div class="cat-actions">
                        ${!isProtected ? `
                        <button onclick="CategoryManager.startEdit('${cat}')" title="Editar categoria e grupo">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-delete" onclick="CategoryManager.remove('${cat}')" title="Excluir categoria">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--danger)"
                                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                        ` : ''}
                    </div>
                </li>
            `;
        }).join('');
    }

    // ----------------------------------------------------------
    // 6. INICIALIZAÇÃO
    // ----------------------------------------------------------

    function init() {
        const saved = _load();
        categories.length = 0;
        saved.forEach(c => categories.push(c));

        const btnSave = document.getElementById('btn-save-category');
        if (btnSave) {
            const newBtn = btnSave.cloneNode(true);
            btnSave.parentNode.replaceChild(newBtn, btnSave);
            newBtn.addEventListener('click', () => {
                const input        = document.getElementById('new-category-input');
                const hiddenField  = document.getElementById('category-edit-original');
                const parentSelect = document.getElementById('category-manager-parent');
                
                const originalName = hiddenField ? hiddenField.value : '';
                const inputValue   = input ? input.value.trim() : '';
                const parentId     = parentSelect ? parentSelect.value : '';

                let success = false;
                if (originalName) {
                    // CORREÇÃO: Agora passamos o parentId para atualizar o grupo na edição
                    success = _edit(originalName, inputValue, parentId);
                } else {
                    success = add(inputValue, parentId);
                }
                if (success) {
                    _setAddMode();
                }
            });
        }

        const btnCancel = document.getElementById('btn-cancel-category-edit');
        if (btnCancel) {
            const newCancel = btnCancel.cloneNode(true);
            btnCancel.parentNode.replaceChild(newCancel, btnCancel);
            newCancel.addEventListener('click', () => _setAddMode());
        }

        const input = document.getElementById('new-category-input');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('btn-save-category')?.click();
                }
            });
        }

        _renderList();
    }

    return { init, add, remove, startEdit };

})();