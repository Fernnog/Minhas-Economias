// ============================================================
// ARQUIVO: js/category-groups.js
// Módulo de Hierarquia de Categorias (Pai → Subcategorias)
// Carregar ANTES de category-manager.js no HTML
// ============================================================

const CategoryGroups = (function () {

    const STORAGE_KEY = 'fin_category_groups';

    // Categorias-mãe fixas
const FIXED_PARENTS = [
    { id: 'moradia',     name: 'Moradia',              color: '#3B82F6' },
    { id: 'alimentacao', name: 'Alimentação',           color: '#10B981' },
    { id: 'transporte',  name: 'Transporte',            color: '#F59E0B' },
    { id: 'saude',       name: 'Saúde',                 color: '#EF4444' },
    { id: 'educacao',    name: 'Educação',              color: '#8B5CF6' },
    { id: 'familiares',  name: 'Familiares',            color: '#EC4899' },
    { id: 'lazer',       name: 'Lazer',                 color: '#06B6D4' },
    { id: 'dizimo',      name: 'Dízimo',                color: '#C9A84C' },
    { id: 'encargos',    name: 'Encargos & Tributos',   color: '#475569' }, // ← NOVO
    { id: 'imprevistos', name: 'Imprevistos',           color: '#F97316' },
];

    function _load() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
        return _getDefaults();
    }

    function _getDefaults() {
        return FIXED_PARENTS.map(p => ({ ...p, isFixed: true, subcategories: [] }));
    }

    function _persist(groups) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
    }

    function getGroups() { return _load(); }

    function getFixedParents() { return FIXED_PARENTS; }

    function getParentOf(subName) {
        for (const g of _load()) {
            if (g.subcategories.includes(subName)) return g;
        }
        return null;
    }

    function addSubcategory(parentId, subName) {
        const groups = _load();
        const group = groups.find(g => g.id === parentId);
        if (!group) return false;
        const already = group.subcategories.map(s => s.toLowerCase()).includes(subName.toLowerCase());
        if (already) return false;
        group.subcategories.push(subName);
        _persist(groups);
        return true;
    }

    function removeSubcategory(subName) {
        const groups = _load();
        groups.forEach(g => { g.subcategories = g.subcategories.filter(s => s !== subName); });
        _persist(groups);
    }

    function renameSubcategory(oldName, newName) {
        const groups = _load();
        groups.forEach(g => {
            const idx = g.subcategories.indexOf(oldName);
            if (idx > -1) g.subcategories[idx] = newName;
        });
        _persist(groups);
    }

    function groupExpenses(expensesMap) {
        const groups = _load();
        const result = [];
        const assignedCats = new Set();

        groups.forEach(g => {
            const children = g.subcategories
                .filter(s => expensesMap[s] != null)
                .map(s => ({ name: s, value: expensesMap[s] }))
                .sort((a, b) => b.value - a.value);

            if (children.length > 0) {
                const total = children.reduce((sum, c) => sum + c.value, 0);
                result.push({ parent: g, total, children });
                children.forEach(c => assignedCats.add(c.name));
            }
        });

        const ungrouped = Object.keys(expensesMap)
            .filter(cat => !assignedCats.has(cat))
            .map(cat => ({ name: cat, value: expensesMap[cat] }))
            .sort((a, b) => b.value - a.value);

        if (ungrouped.length > 0) {
            result.push({
                parent: { id: '_ungrouped', name: 'Outros', color: '#6B7280', isFixed: false },
                total: ungrouped.reduce((s, c) => s + c.value, 0),
                children: ungrouped
            });
        }

        return result.sort((a, b) => b.total - a.total);
    }

    return { getGroups, getFixedParents, getParentOf, addSubcategory, removeSubcategory, renameSubcategory, groupExpenses };

})();
