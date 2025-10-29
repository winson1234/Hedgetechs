// Generate random candlesticks
function generateCandlesticks() {
    const container = document.getElementById('candlesticks');
    const numCandles = 60;
    for (let i = 0; i < numCandles; i++) {
        const candle = document.createElement('div');
        candle.className = 'candlestick';
        const height = Math.random() * 100 + 30;
        const left = (i / numCandles) * 100;
        const bottom = Math.random() * 40 + 10;
        candle.style.height = `${height}px`;
        candle.style.left = `${left}%`;
        candle.style.bottom = `${bottom}%`;
        container.appendChild(candle);
    }
}
generateCandlesticks();
// Get login form
const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const emailInput = document.querySelector('input[type="email"]');
    const passwordInput = document.querySelector('input[type="password"]');

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    // Get all users from localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');

    // Find user with matching email and password
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        // Optionally, save logged-in user separately
        localStorage.setItem('loggedInUser', JSON.stringify(user));

        window.location.href = '../dashboard/dashboard.html';
    } else {
        alert('❌ Incorrect email or password.');
    }
});


// Forgot password navigation
const forgotLink = document.getElementById('forgotPasswordLink');
forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    console.log("Forgot Password link clicked");
window.location.href = '../forgotPassword/forgotpassword.html';
});
// Register 
const registerDemoLink = document.getElementById('registerDemoLink');
registerDemoLink.addEventListener('click', (e) => {
    e.preventDefault();
    console.log("Register account clicked");
window.location.href = '../register/register.html';
});
