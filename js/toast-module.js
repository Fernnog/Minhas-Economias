// ===================================================
// TOAST MODULE — Sistema Centralizado de Notificações
// ===================================================

const ToastModule = (function () {
    
    /**
     * Exibe um toast simples (texto).
     * @param {string} message - O texto a ser exibido
     * @param {string} type - 'default', 'info', 'warning', 'danger', 'success'
     */
    function show(message, type = 'default') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type !== 'default' ? 'toast-' + type : ''}`;
        toast.innerText = message;
        
        _renderAndAnimate(toast, container, 3000);
    }

    /**
     * Exibe um toast enriquecido para os Marcos do Termômetro.
     * @param {Object} config - Configurações do marco atingido (icon, label, msg, type)
     */
    function showMilestone(config) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-milestone toast-milestone-${config.type}`;
        toast.innerHTML = `
            <span class="toast-milestone-icon">${config.icon}</span>
            <div class="toast-milestone-body">
                <strong>${config.label}</strong>
                <span>${config.msg}</span>
            </div>
        `;
        
        _renderAndAnimate(toast, container, 6000);
    }

    /**
     * Helper interno para injetar no DOM e gerenciar o ciclo de vida/animação.
     */
    function _renderAndAnimate(element, container, duration) {
        container.appendChild(element);
        
        // Força reflow para a transição CSS funcionar
        void element.offsetWidth; 
        element.classList.add('show');
        
        setTimeout(() => {
            element.classList.remove('show');
            setTimeout(() => element.remove(), 300);
        }, duration);
    }

    // API Pública
    return {
        show,
        showMilestone
    };

})();
