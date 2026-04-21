// === ARQUIVO: firebase-service.js ===
const firebaseConfig = {
  apiKey: "AIzaSyB-Mf1-G1dgIjmgFHDqDr1irGqTmFK8BxI",
  authDomain: "minhas-economias-46029.firebaseapp.com",
  projectId: "minhas-economias-46029",
  storageBucket: "minhas-economias-46029.firebasestorage.app",
  messagingSenderId: "427744923145",
  appId: "1:427744923145:web:adc2223e03d52abecd32d8",
  measurementId: "G-LQKFN76JCN"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const FirebaseModule = (function() {
    function init() {
        const toggleBtn = document.getElementById('btn-login-toggle');
        const panel = document.getElementById('login-panel');
        const form = document.getElementById('login-form');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => panel.classList.toggle('hidden'));
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('auth-email').value;
                const pass = document.getElementById('auth-password').value;
                
                auth.signInWithEmailAndPassword(email, pass)
                    .then(() => {
                        panel.classList.add('hidden');
                        toggleBtn.style.color = 'var(--primary)'; // Feedback visual
                        form.reset();
                        // Opcional: Recarregar dados após login
                        if (typeof updateAllViews === 'function') updateAllViews();
                    })
                    .catch(err => alert('Falha na autenticação: ' + err.message));
            });
        }
    }

    /**
     * Sincroniza um documento individual com o Firestore.
     * @param {string} collectionName - 'transactions' ou 'budgets'
     * @param {Object} dataObj - O objeto de dado com ID.
     */
    async function syncData(collectionName, dataObj) {
        if (!auth.currentUser) {
            console.warn(`Usuário não autenticado. ${collectionName} salvo apenas localmente.`);
            return;
        }
        try {
            await db.collection('users').doc(auth.currentUser.uid).collection(collectionName).doc(dataObj.id).set(dataObj);
            console.log(`${collectionName} sincronizado com a nuvem.`);
        } catch (error) {
            console.error(`Erro ao sincronizar ${collectionName}:`, error);
        }
    }

    /**
     * Remove um documento do Firestore.
     * @param {string} collectionName 
     * @param {string} id 
     */
    async function deleteData(collectionName, id) {
        if (!auth.currentUser) return;
        try {
            await db.collection('users').doc(auth.currentUser.uid).collection(collectionName).doc(id).delete();
            console.log(`${id} removido da nuvem.`);
        } catch (error) {
            console.error(`Erro ao deletar em ${collectionName}:`, error);
        }
    }

    return { init, syncData, deleteData };
})();

// Inicializa a interface de auth quando o DOM carregar
document.addEventListener('DOMContentLoaded', () => FirebaseModule.init());
