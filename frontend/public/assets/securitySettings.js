// ================================
// INITIALIZATION
// ================================
// At the very top of securitySettings.js
const html = document.documentElement;

// Then your existing code
const savedTheme = localStorage.getItem('theme') || 'dark';
html.setAttribute('data-theme', savedTheme);

// Change logo based on saved theme
const logoImg = document.querySelector('.logo-img');
if (logoImg) {
    if (savedTheme === 'light') {
        logoImg.src = '/dashboard/styles/first-pavilion.jpg';
    } else {
        logoImg.src = '/dashboard/styles/OIP-removebg-preview.png';
    }
}
document.addEventListener("DOMContentLoaded", () => {
    initializeTheme();
    setupThemeToggle();
    setupLanguageSelector();
    setupProfileDropdown();
    initializeTwoFA();
    setupDeviceManagement();
    animateOnScroll();
 const html = document.documentElement;
  const savedTheme = localStorage.getItem('theme') || 'dark';
  html.setAttribute('data-theme', savedTheme);

  const themeToggle = document.getElementById('themeToggle');
  themeToggle.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);

    themeToggle.style.transform = 'rotate(360deg)';
    setTimeout(() => (themeToggle.style.transform = 'rotate(0deg)'), 300);
  });

});

// ================================
// THEME FUNCTIONALITY
// ================================
function initializeTheme() {
    // Get theme from localStorage, default to 'dark'
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    console.log('Theme initialized:', savedTheme);
}

function setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        // Add rotation animation
        themeToggle.style.transition = 'transform 0.3s ease';
        themeToggle.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            themeToggle.style.transform = 'rotate(0deg)';
        }, 300);

        console.log('Theme changed to:', newTheme);
    });
}

// ================================
// LANGUAGE SELECTOR
// ================================
function setupLanguageSelector() {
    const languageToggle = document.getElementById('languageToggle');
    const languageMenu = document.getElementById('languageMenu');
    const languageLabel = document.getElementById('languageLabel');
    
    if (!languageToggle || !languageMenu) return;

    // Toggle language menu
    languageToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        languageMenu.classList.toggle('show');
    });

    // Select language
    const languageItems = languageMenu.querySelectorAll('li');
    languageItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const lang = item.getAttribute('data-lang');
            const langMap = {
                'en': 'EN',
                'zh': 'ZH',
                'jp': 'JP',
                'kr': 'KR'
            };
            languageLabel.textContent = langMap[lang] || 'EN';
            languageMenu.classList.remove('show');
            console.log('Language changed to:', lang);
        });
    });

    // Close language menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!languageToggle.contains(e.target) && !languageMenu.contains(e.target)) {
            languageMenu.classList.remove('show');
        }
    });
}

// ================================
// PROFILE DROPDOWN
// ================================
function setupProfileDropdown() {
    const profileIcon = document.getElementById("profileIcon");
    const profileDropdown = document.getElementById("profileDropdown");
    const dropdownUsername = document.querySelector(".dropdown-username");
    const dropdownEmail = document.querySelector(".dropdown-email");

    if (!profileIcon || !profileDropdown) {
        console.log("Profile elements not found");
        return;
    }

    // Load user data from localStorage
    const storedUser = JSON.parse(localStorage.getItem("loggedInUser") || "{}");
    
    console.log("Stored user data:", storedUser);

    // Update dropdown text
    if (storedUser.name || storedUser.fullName) {
        const userName = storedUser.name || storedUser.fullName;
        dropdownUsername.textContent = userName;
    }
    
    if (storedUser.email) {
        dropdownEmail.textContent = storedUser.email;
    }

  // Update profile icon
    const profileImage = storedUser.profilePicture || storedUser.profilePic;
    
    if (profileImage && profileImage.startsWith('data:image')) {
        // Has profile picture
        profileIcon.style.background = `url(${profileImage}) center/cover no-repeat`;
        profileIcon.textContent = "";
    } else if (storedUser.name || storedUser.fullName) {
        // No picture - show initials with gold gradient
        const userName = storedUser.name || storedUser.fullName;
        profileIcon.textContent = getInitials(userName);
        profileIcon.style.background = "linear-gradient(135deg, #C76D00, #FDDB92)";
    }
    // Toggle dropdown
    profileIcon.addEventListener("click", (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle("show");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
        if (!profileIcon.contains(e.target) && !profileDropdown.contains(e.target)) {
            profileDropdown.classList.remove("show");
        }
    });

    // Handle dropdown item clicks
    const dropdownItems = document.querySelectorAll(".dropdown-item");
    dropdownItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const itemText = item.textContent.trim();
            
            if (itemText === "My Profile") {
                window.location.href = "/profile.html";
            } else if (itemText === "Accounts") {
                window.location.href = "/";
            } else if (itemText === "Settings") {
                window.location.href = "/securitySettings.html";
            } else if (itemText === "Logout") {
                handleLogout();
            }
        });
    });

function handleLogout() {
  if (confirm("Are you sure you want to logout?")) {
    // Create the logout overlay
    const overlay = document.createElement("div");
    overlay.className = "logout-overlay";
    overlay.textContent = "Logging out...";
    document.body.appendChild(overlay);

    // Trigger the fade-in effect
    requestAnimationFrame(() => overlay.classList.add("show"));

    // Wait for animation
    setTimeout(() => {
      // Clear user session
      localStorage.removeItem("loggedInUser");

      // Fade out overlay before redirect
      overlay.classList.add("fade-out");

      setTimeout(() => {
        // Redirect after animation ends
        window.location.href = "/dashboard.html";
      }, 400);
    }, 1000);
  }
}

}

function getInitials(name) {
    return name
        .trim()
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);
}

function handleLogout() {
    if (confirm("Are you sure you want to logout?")) {
        localStorage.removeItem("loggedInUser");
        window.location.href = "/dashboard.html";
    }
}

// ================================
// TWO-FACTOR AUTHENTICATION
// ================================
let is2FAEnabled = false;
let generatedOTP = '';
let countdownTimer = null;
let timeLeft = 60;

function initializeTwoFA() {
    const twofaToggle = document.getElementById('twofaToggle');
    const tfaModal = document.getElementById('tfaModal');
    const modalClose = document.getElementById('modalClose');
    const otpDigits = document.querySelectorAll('.otp-digit');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const resendBtn = document.getElementById('resendBtn');

    if (!twofaToggle) return;

    // Toggle 2FA
    twofaToggle.addEventListener('click', () => {
        if (!is2FAEnabled) {
            // Open modal to enable 2FA
            tfaModal.classList.add('show');
            generateOTP();
            startCountdown();
            clearOTPInputs();
        } else {
            // Disable 2FA
            is2FAEnabled = false;
            updateTwoFAUI();
            showSuccessToast('Two-Factor Authentication has been disabled');
        }
    });

    // Close modal
    modalClose.addEventListener('click', closeTFAModal);
    tfaModal.addEventListener('click', (e) => {
        if (e.target === tfaModal) {
            closeTFAModal();
        }
    });

    // OTP input handling
    setupOTPInputs(otpDigits);

    // Verify OTP
    verifyOtpBtn.addEventListener('click', () => {
        const enteredOtp = Array.from(otpDigits).map(i => i.value).join('');
        
        if (enteredOtp.length < 6) {
            showError('Please enter the complete 6-digit OTP');
            return;
        }

        if (enteredOtp !== generatedOTP) {
            showError('Invalid OTP. Please try again.');
            clearOTPInputs();
            return;
        }

        // OTP correct - Enable 2FA
        is2FAEnabled = true;
        updateTwoFAUI();
        showSuccessToast('Two-Factor Authentication has been enabled successfully!');
        closeTFAModal();
    });

    // Resend OTP
    resendBtn.addEventListener('click', () => {
        if (!resendBtn.disabled) {
            generateOTP();
            startCountdown();
            clearOTPInputs();
            clearError();
            showSuccessToast('New OTP sent!');
        }
    });
}

function generateOTP() {
    generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('Generated OTP (for testing):', generatedOTP);
    return generatedOTP;
}

function setupOTPInputs(otpDigits) {
    otpDigits.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            
            // Allow only digits
            if (!/^\d$/.test(value)) {
                e.target.value = '';
                return;
            }

            // Add filled class
            e.target.classList.add('filled');

            // Move to next input
            if (index < otpDigits.length - 1 && value) {
                otpDigits[index + 1].focus();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                e.target.classList.remove('filled');
                
                if (!e.target.value && index > 0) {
                    otpDigits[index - 1].focus();
                    otpDigits[index - 1].value = '';
                    otpDigits[index - 1].classList.remove('filled');
                }
            }
        });

        // Paste handling
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
            
            if (pastedData.length === 6) {
                otpDigits.forEach((digit, i) => {
                    digit.value = pastedData[i] || '';
                    if (digit.value) {
                        digit.classList.add('filled');
                    }
                });
                otpDigits[5].focus();
            }
        });
    });
}

function clearOTPInputs() {
    const otpDigits = document.querySelectorAll('.otp-digit');
    otpDigits.forEach(input => {
        input.value = '';
        input.classList.remove('filled');
    });
    if (otpDigits.length > 0) {
        otpDigits[0].focus();
    }
}

function startCountdown() {
    const timerElement = document.getElementById('timer');
    const resendBtn = document.getElementById('resendBtn');
    
    timeLeft = 60;
    resendBtn.disabled = true;
    updateTimerDisplay();

    countdownTimer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            clearInterval(countdownTimer);
            resendBtn.disabled = false;
            timerElement.textContent = '';
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.textContent = `(${timeLeft}s)`;
    }
}

function closeTFAModal() {
    const tfaModal = document.getElementById('tfaModal');
    tfaModal.classList.remove('show');
    clearOTPInputs();
    clearError();
    if (countdownTimer) {
        clearInterval(countdownTimer);
    }
}

function updateTwoFAUI() {
    const toggleSwitch = document.querySelector('#twofaToggle .toggle-switch');
    const statusIcon = document.getElementById('twofaStatusIcon');
    const statusText = document.getElementById('twofaStatusText');
    const statusBadge = document.getElementById('statusBadge');
    const twoFAStatusBadge = document.getElementById('twoFAStatusBadge');

    if (is2FAEnabled) {
        toggleSwitch?.classList.add('active');
        statusIcon?.classList.remove('disabled');
        statusIcon?.classList.add('enabled');
        if (statusIcon) statusIcon.textContent = '✓';
        if (statusText) statusText.textContent = '2FA Enabled';
        if (statusBadge) {
            statusBadge.textContent = 'Active';
            statusBadge.classList.add('active');
        }
        if (twoFAStatusBadge) {
            twoFAStatusBadge.textContent = 'Enabled';
        }
        updateAccountStatus();
    } else {
        toggleSwitch?.classList.remove('active');
        statusIcon?.classList.remove('enabled');
        statusIcon?.classList.add('disabled');
        if (statusIcon) statusIcon.textContent = '🔒';
        if (statusText) statusText.textContent = '2FA Disabled';
        if (statusBadge) {
            statusBadge.textContent = 'Inactive';
            statusBadge.classList.remove('active');
        }
        if (twoFAStatusBadge) {
            twoFAStatusBadge.textContent = 'Disabled';
        }
        updateAccountStatus();
    }
}

function updateAccountStatus() {
    const accountStatus = document.getElementById('accountStatus');
    if (!accountStatus) return;

    if (is2FAEnabled) {
        accountStatus.textContent = 'Highly Protected';
    } else {
        accountStatus.textContent = 'Protected';
    }
}

function showError(message) {
    const otpError = document.getElementById('otpError');
    if (otpError) {
        otpError.textContent = message;
        otpError.classList.add('show');
        
        setTimeout(() => {
            clearError();
        }, 3000);
    }
}

function clearError() {
    const otpError = document.getElementById('otpError');
    if (otpError) {
        otpError.textContent = '';
        otpError.classList.remove('show');
    }
}

// ================================
// DEVICE MANAGEMENT
// ================================
let deviceToRemove = null;

function setupDeviceManagement() {
    const removeButtons = document.querySelectorAll('.remove-device-btn:not([disabled])');
    const removeModal = document.getElementById('removeModal');
    const removeModalClose = document.getElementById('removeModalClose');
    const cancelRemoveBtn = document.getElementById('cancelRemoveBtn');
    const confirmRemoveBtn = document.getElementById('confirmRemoveBtn');

    // Setup remove buttons
    removeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const deviceId = button.getAttribute('data-device-id');
            const deviceName = button.getAttribute('data-device-name');
            showRemoveModal(deviceId, deviceName);
        });
    });

    // Close modal
    removeModalClose?.addEventListener('click', closeRemoveModal);
    cancelRemoveBtn?.addEventListener('click', closeRemoveModal);
    removeModal?.addEventListener('click', (e) => {
        if (e.target === removeModal) {
            closeRemoveModal();
        }
    });

    // Confirm remove
    confirmRemoveBtn?.addEventListener('click', confirmRemoveDevice);
}

function showRemoveModal(deviceId, deviceName) {
    deviceToRemove = { id: deviceId, name: deviceName };
    const modal = document.getElementById('removeModal');
    const description = document.getElementById('modalDescription');

    if (description) {
        description.textContent = `Are you sure you want to remove "${deviceName}"? You'll need to log in again on this device.`;
    }
    modal.classList.add('show');
}

function closeRemoveModal() {
    const modal = document.getElementById('removeModal');
    modal.classList.remove('show');
    deviceToRemove = null;
}

function confirmRemoveDevice() {
    if (!deviceToRemove) return;

    const deviceItem = document.querySelector(`[data-device-id="${deviceToRemove.id}"]`);
    if (deviceItem) {
        deviceItem.style.opacity = '0';
        deviceItem.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
            deviceItem.remove();
            updateDeviceCount();
            showSuccessToast(`${deviceToRemove.name} has been removed successfully!`);
            addActivityLog('Device Removed', `${deviceToRemove.name} was disconnected from your account`, 'Just now');
        }, 300);
    }

    closeRemoveModal();
}

function updateDeviceCount() {
    const deviceItems = document.querySelectorAll('.device-item');
    const count = deviceItems.length;

    const countElement = document.getElementById('deviceCount');
    if (countElement) {
        countElement.textContent = `${count} active device${count !== 1 ? 's' : ''}`;
    }

    // Update stat card
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        const label = card.querySelector('.stat-label');
        if (label && label.textContent === 'Active Devices') {
            const valueElement = card.querySelector('.stat-value');
            if (valueElement) valueElement.textContent = count;
        }
    });
}

function addActivityLog(title, description, time) {
    const activityList = document.querySelector('.activity-list');
    if (!activityList) return;

    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';
    activityItem.style.opacity = '0';
    activityItem.style.transform = 'translateY(-10px)';
    activityItem.innerHTML = `
        <div class="activity-icon" style="background: linear-gradient(135deg, #ef4444, #dc2626);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
        </div>
        <div class="activity-details">
            <h4>${title}</h4>
            <p>${description}</p>
            <p class="activity-time">${time}</p>
        </div>
        <div class="activity-status" style="background: var(--error-bg); color: var(--error-color);">Removed</div>
    `;
    
    activityList.insertBefore(activityItem, activityList.firstChild);
    
    setTimeout(() => {
        activityItem.style.transition = 'all 0.3s ease';
        activityItem.style.opacity = '1';
        activityItem.style.transform = 'translateY(0)';
    }, 10);

    // Keep only 5 most recent activities
    const allActivities = activityList.querySelectorAll('.activity-item');
    if (allActivities.length > 5) {
        allActivities[allActivities.length - 1].remove();
    }
}

// ================================
// SUCCESS TOAST
// ================================
function showSuccessToast(message) {
    const toast = document.getElementById('successToast');
    const text = document.getElementById('successText');
    
    if (text) text.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// ================================
// SCROLL ANIMATIONS
// ================================
function animateOnScroll() {
    const cards = document.querySelectorAll('.security-card, .stat-card');
    
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }, index * 50);
                }
            });
        },
        { threshold: 0.1 }
    );

    cards.forEach((card) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'all 0.5s ease';
        observer.observe(card);
    });
}
// Theme Toggle - update logo
themeToggle.addEventListener('click', () => {
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Change logo based on theme
    const logoImg = document.querySelector('.logo-img');
    if (newTheme === 'light') {
        logoImg.src = '/dashboard/styles/logo-light.png';
    } else {
        logoImg.src = '/dashboard/styles/logo-dark.png';
    }
});
