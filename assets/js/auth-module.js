// ===== AUTH MODULE =====
// Handles login/logout functionality

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');

    // Check if already logged in
    const session = localStorage.getItem('sppg_session');
    if (session) {
        window.location.href = 'dashboard.html';
        return;
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;

            const user = window.ADMIN_USERS.find(
                u => u.username === username && u.password === password
            );

            if (user) {
                const sessionData = {
                    username: user.username,
                    name: user.name,
                    role: user.role,
                    loginTime: new Date().toISOString()
                };
                localStorage.setItem('sppg_session', JSON.stringify(sessionData));
                
                if (document.getElementById('rememberMe').checked) {
                    localStorage.setItem('sppg_remember', username);
                }
                
                window.location.href = 'dashboard.html';
            } else {
                loginError.classList.remove('d-none');
                loginError.innerHTML = '<i class="fas fa-exclamation-circle me-2"></i>Username atau password salah!';
                
                // Shake animation
                loginForm.classList.add('shake');
                setTimeout(() => loginForm.classList.remove('shake'), 500);
            }
        });

        // Auto-fill remembered username
        const remembered = localStorage.getItem('sppg_remember');
        if (remembered) {
            document.getElementById('loginUsername').value = remembered;
            document.getElementById('rememberMe').checked = true;
        }
    }
});

// Add shake animation
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    .shake { animation: shake 0.3s ease-in-out; }
`;
document.head.appendChild(style);
