// Get DOM elements
const registerForm = document.getElementById('registerForm');
const countrySelect = document.getElementById('country');
const firstNameInput = document.getElementById('firstName');
const lastNameInput = document.getElementById('lastName');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const retypePasswordInput = document.getElementById('retypePassword');
const registerBtn = document.getElementById('registerBtn');
const clientLoginBtn = document.querySelector('.client-login-btn');
const togglePassword = document.getElementById('togglePassword');
const toggleRetypePassword = document.getElementById('toggleRetypePassword');

const emailError = document.getElementById('emailError');
const retypeError = document.getElementById('retypeError');
const passwordStrength = document.getElementById('passwordStrength');
const strengthBar = document.getElementById('strengthBar');
const strengthText = document.getElementById('strengthText');


// Extract options (skip placeholder)
let options = Array.from(countrySelect.options).slice(1);

// Separate Malaysia from the rest
const malaysiaOption = options.find(opt => opt.value === 'MY');
options = options.filter(opt => opt.value !== 'MY');

// Sort remaining countries alphabetically
options.sort((a, b) => a.text.localeCompare(b.text));

// Rebuild the select
countrySelect.innerHTML = '<option value="">Select your country</option>';
countrySelect.appendChild(malaysiaOption); // Malaysia stays at top
options.forEach(option => countrySelect.appendChild(option));

// Optionally set Malaysia as selected by default
malaysiaOption.selected = true;



// Toggle password visibility
togglePassword.addEventListener('click', () => {
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        togglePassword.style.opacity = '0.5';
    } else {
        passwordInput.type = 'password';
        togglePassword.style.opacity = '1';
    }
});

toggleRetypePassword.addEventListener('click', () => {
    if (retypePasswordInput.type === 'password') {
        retypePasswordInput.type = 'text';
        toggleRetypePassword.style.opacity = '0.5';
    } else {
        retypePasswordInput.type = 'password';
        toggleRetypePassword.style.opacity = '1';
    }
});

// Password strength checker
function checkPasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    if (strength <= 2) return { strength: 'Weak', class: 'weak' };
    else if (strength <= 4) return { strength: 'Medium', class: 'medium' };
    else return { strength: 'Strong', class: 'strong' };
}

// Password input listener
passwordInput.addEventListener('input', () => {
    const password = passwordInput.value;
    if (password.length > 0) {
        passwordStrength.classList.add('show');
        const result = checkPasswordStrength(password);
        strengthBar.className = 'strength-bar-fill ' + result.class;
        strengthText.className = 'strength-text ' + result.class;
        strengthText.textContent = result.strength + ' password';
    } else {
        passwordStrength.classList.remove('show');
    }

    if (retypePasswordInput.value.length > 0) checkPasswordMatch();
});

// Retype password listener
retypePasswordInput.addEventListener('input', checkPasswordMatch);

function checkPasswordMatch() {
    if (retypePasswordInput.value.length > 0) {
        if (passwordInput.value !== retypePasswordInput.value) {
            retypeError.classList.add('show');
            retypePasswordInput.style.borderColor = '#e74c3c';
        } else {
            retypeError.classList.remove('show');
            retypePasswordInput.style.borderColor = '#27ae60';
        }
    } else {
        retypeError.classList.remove('show');
        retypePasswordInput.style.borderColor = '#ddd';
    }
}

// Email validation
emailInput.addEventListener('blur', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailInput.value && !emailRegex.test(emailInput.value)) {
        emailError.classList.add('show');
        emailInput.style.borderColor = '#e74c3c';
    } else {
        emailError.classList.remove('show');
        emailInput.style.borderColor = '#ddd';
    }
});

// Form submission
registerForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const country = countrySelect.value;
    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    const fullName = `${firstName} ${lastName}`;
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const retypePassword = retypePasswordInput.value;

    // Validation
    if (!country) {
        alert('Please select your country');
        countrySelect.focus();
        return;
    }

    if (!firstName || !lastName) {
        alert('Please enter both first and last name');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        emailError.classList.add('show');
        emailInput.focus();
        return;
    }

    if (password.length < 8) {
        alert('Password must be at least 8 characters long');
        passwordInput.focus();
        return;
    }

    if (password !== retypePassword) {
        retypeError.classList.add('show');
        retypePasswordInput.focus();
        return;
    }

    // Get existing users from localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');

    // Check if email already registered
    const existingUser = users.find((user) => user.email === email);
    if (existingUser) {
        alert('❌ This email is already registered. Please log in instead.');
        emailInput.focus();
        return;
    }

    // Add new user
    const newUser = { name: fullName, country, email, password };
    users.push(newUser);

    // Save updated user list
    localStorage.setItem('users', JSON.stringify(users));

    alert('✅ Account created successfully! You can now log in.');
    window.location.href = '../login/login.html';
});

// Client login button
clientLoginBtn.addEventListener('click', () => {
    window.location.href = '../login/login.html';
});
