
const form = document.getElementById('resetForm');
const emailInput = document.getElementById('email');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const clientLoginBtn = document.querySelector('.client-login-btn');

const emailSection = document.getElementById('emailSection');
const passwordSection = document.getElementById('passwordSection');
const verifyEmailBtn = document.getElementById('verifyEmailBtn');
const submitBtn = document.getElementById('submitBtn');

const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const confirmError = document.getElementById('confirmError');
const successBanner = document.getElementById('successBanner');
const cardDescription = document.getElementById('cardDescription');
const passwordStrength = document.getElementById('passwordStrength');
const strengthBar = document.getElementById('strengthBar');
const strengthText = document.getElementById('strengthText');
let verifiedEmail = null;

// Email validation
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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
newPasswordInput.addEventListener('input', () => {
    const password = newPasswordInput.value;
    if (password.length > 0) {
        passwordStrength.classList.add('show');
        const result = checkPasswordStrength(password);
        strengthBar.className = 'strength-bar-fill ' + result.class;
        strengthText.className = 'strength-text ' + result.class;
        strengthText.textContent = result.strength + ' password';
    } else {
        passwordStrength.classList.remove('show');
    }

    if (confirmPasswordInput.value.length > 0) checkPasswordMatch();
});

// Retype password listener
confirmPasswordInput.addEventListener('input', checkPasswordMatch);

function checkPasswordMatch() {
    if (confirmPasswordInput.value.length > 0) {
        if (newPasswordInput.value !== confirmPasswordInput.value) {
            retypeError.classList.add('show');
            confirmPasswordInput.style.borderColor = '#e74c3c';
        } else {
            retypeError.classList.remove('show');
            confirmPasswordInput.style.borderColor = '#27ae60';
        }
    } else {
        retypeError.classList.remove('show');
        confirmPasswordInput.style.borderColor = '#ddd';
    }
}

// Email input validation
emailInput.addEventListener('input', () => {
  const email = emailInput.value.trim();
  if (email && !validateEmail(email)) {
    emailInput.classList.add('error');
    emailError.textContent = 'Please enter a valid email address';
    emailError.classList.add('show');
  } else {
    emailInput.classList.remove('error');
    emailError.classList.remove('show');
  }
});

// Verify email and show password fields
verifyEmailBtn.addEventListener('click', () => {
  const email = emailInput.value.trim().toLowerCase();

  if (!email) {
    emailInput.classList.add('error');
    emailError.textContent = 'Please enter your email';
    emailError.classList.add('show');
    return;
  }

  if (!validateEmail(email)) {
    emailInput.classList.add('error');
    emailError.textContent = 'Please enter a valid email address';
    emailError.classList.add('show');
    return;
  }

  // Get users from localStorage
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const user = users.find(u => u.email === email);

  if (!user) {
    emailInput.classList.add('error');
    emailError.textContent = '❌ This email is not registered';
    emailError.classList.add('show');
    return;
  }

  // Email verified, show password section
  verifiedEmail = email;
  emailSection.style.display = 'none';
  passwordSection.classList.add('show');
  cardDescription.textContent = 'Create a new password for your account';
});

// Password input validation
newPasswordInput.addEventListener('input', () => {
  const password = newPasswordInput.value;
  checkPasswordStrength(password);
  
  if (password.length > 0 && password.length < 8) {
    newPasswordInput.classList.add('error');
    passwordError.textContent = 'Password must be at least 8 characters';
    passwordError.classList.add('show');
  } else {
    newPasswordInput.classList.remove('error');
    passwordError.classList.remove('show');
  }

  // Check confirm password match
  if (confirmPasswordInput.value.length > 0) {
    if (password !== confirmPasswordInput.value) {
      confirmPasswordInput.classList.add('error');
      confirmError.textContent = 'Passwords do not match';
      confirmError.classList.add('show');
    } else {
      confirmPasswordInput.classList.remove('error');
      confirmError.classList.remove('show');
    }
  }
});

// Confirm password validation
confirmPasswordInput.addEventListener('input', () => {
  const password = newPasswordInput.value;
  const confirm = confirmPasswordInput.value;

  if (confirm && confirm !== password) {
    confirmPasswordInput.classList.add('error');
    confirmError.textContent = 'Passwords do not match';
    confirmError.classList.add('show');
  } else {
    confirmPasswordInput.classList.remove('error');
    confirmError.classList.remove('show');
  }
});

// Form submission
form.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Validation
  if (newPassword.length < 8) {
    newPasswordInput.classList.add('error');
    passwordError.textContent = 'Password must be at least 8 characters';
    passwordError.classList.add('show');
    return;
  }

  if (newPassword !== confirmPassword) {
    confirmPasswordInput.classList.add('error');
    confirmError.textContent = 'Passwords do not match';
    confirmError.classList.add('show');
    return;
  }

  // Update password in localStorage
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const userIndex = users.findIndex(u => u.email === verifiedEmail);

  if (userIndex !== -1) {
    users[userIndex].password = newPassword;
    localStorage.setItem('users', JSON.stringify(users));

    // Show success message
    successBanner.classList.add('show');
    passwordSection.style.display = 'none';
    
    // Redirect after 2 seconds
    setTimeout(() => {
      window.location.href = '../login/login.html';
    }, 2000);
  }
});

// Client login button
clientLoginBtn.addEventListener('click', (e) => {
  e.preventDefault();
    window.location.href = '../login/login.html';
});