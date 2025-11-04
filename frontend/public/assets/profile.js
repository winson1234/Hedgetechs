// ================================
// INITIALIZATION
// ================================
document.addEventListener("DOMContentLoaded", () => {
    initializeTheme();
    setupThemeToggle();
    setupProfileDropdown();
    loadProfileData();
    initializeEventListeners();
});

// ================================
// THEME FUNCTIONALITY
// ================================
function initializeTheme() {
    const html = document.documentElement;
    const savedTheme = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);
    console.log('Theme initialized:', savedTheme);
}

function setupThemeToggle() {
    const html = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');
    
    if (!themeToggle) return;

    themeToggle.addEventListener('click', () => {
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        // Add rotation animation
        themeToggle.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            themeToggle.style.transform = 'rotate(0deg)';
        }, 300);

        console.log('Theme changed to:', newTheme);
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

    // Load user data
    const storedUser = JSON.parse(localStorage.getItem("loggedInUser") || "{}");
    console.log("Stored user data:", storedUser);

    // Update dropdown text
    if (storedUser.name || storedUser.fullName) {
        const userName = storedUser.name || storedUser.fullName;
        if (dropdownUsername) dropdownUsername.textContent = userName;
    }
    
    if (storedUser.email) {
        if (dropdownEmail) dropdownEmail.textContent = storedUser.email;
    }

    // Update profile icon
    const profileImage = storedUser.profilePicture || storedUser.profilePic;
    
    if (profileImage && profileImage.startsWith('data:image')) {
        profileIcon.style.backgroundImage = `url(${profileImage})`;
        profileIcon.style.backgroundSize = "cover";
        profileIcon.style.backgroundPosition = "center";
        profileIcon.style.backgroundColor = "transparent";
        profileIcon.textContent = "";
    } else if (storedUser.name || storedUser.fullName) {
        const userName = storedUser.name || storedUser.fullName;
        profileIcon.textContent = getInitials(userName);
        profileIcon.style.backgroundImage = "none";
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

// ================================
// HELPER FUNCTIONS
// ================================
function getInitials(name) {
    if (!name) return 'JD';
    const names = name.trim().split(' ');
    if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function handleLogout() {
    if (confirm("Are you sure you want to logout?")) {
        localStorage.removeItem("loggedInUser");
        window.location.href = "/dashboard.html";
    }
}

// ================================
// PROFILE DATA
// ================================
const storedUser = JSON.parse(localStorage.getItem('loggedInUser') || '{}');

let profileData = {
    name: storedUser.name || 'John Doe',
    email: storedUser.email || 'john.doe@fpmarkets.com',
    phone: storedUser.phone || '',
    country: storedUser.country || 'United States',
    clientId: storedUser.clientId || '#FPM-78945',
    accountType: storedUser.accountType || 'Premium',
    registrationDate: storedUser.registrationDate || 'March 15, 2023',
    language: storedUser.language || 'English (US)',
    timezone: storedUser.timezone || 'GMT+8 (Kuala Lumpur)',
    currency: storedUser.currency || 'USD ($)',
    profilePicture: storedUser.profilePicture || null,
    authenticatorEnabled: storedUser.authenticatorEnabled || false
};

let pendingSaveAction = null;
let newEmailForVerification = null;
let generatedOTP = null;

// ================================
// PROFILE PICTURE FUNCTIONS
// ================================
function loadProfilePicture(imageUrl) {
    const profileImage = document.getElementById('profileImage');
    const profileInitials = document.getElementById('profileInitials');
    const headerProfileIcon = document.getElementById('profileIcon');
    const profileAvatar = document.getElementById('profileAvatar');
    const initials = getInitials(profileData.name);

    console.log("Loading profile picture:", imageUrl ? "Yes" : "No (showing initials)");

    if (imageUrl && imageUrl.trim() !== '') {
        if (profileImage) {
            profileImage.src = imageUrl;
            profileImage.style.display = 'block';
        }
        if (profileInitials) profileInitials.style.display = 'none';

        [headerProfileIcon, profileAvatar].forEach(el => {
            if (!el) return;
            el.style.backgroundImage = `url(${imageUrl})`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.style.backgroundColor = 'transparent';
            el.textContent = '';
        });
    } else {
        if (profileImage) {
            profileImage.src = '';
            profileImage.style.display = 'none';
        }
        if (profileInitials) {
            profileInitials.style.display = 'flex';
            profileInitials.textContent = initials;
        }

        [headerProfileIcon, profileAvatar].forEach(el => {
            if (!el) return;
            el.style.backgroundImage = '';
            el.style.background = 'linear-gradient(135deg, #C76D00, #FDDB92)';
            el.textContent = initials;
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.fontWeight = '700';
            el.style.fontSize = '16px';
            el.style.color = '#ffffff';
        });
    }
}

function updateProfileIcon() {
    const headerProfileIcon = document.getElementById('profileIcon');
    const profileAvatar = document.getElementById('profileAvatar');
    const initials = getInitials(profileData.name);

    if (!profileData.profilePicture || profileData.profilePicture.trim() === '') {
        [headerProfileIcon, profileAvatar].forEach(el => {
            if (!el) return;
            el.style.backgroundImage = '';
            el.style.background = 'linear-gradient(135deg, #C76D00, #FDDB92)';
            el.textContent = initials;
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.fontWeight = '700';
            el.style.fontSize = '16px';
            el.style.color = '#ffffff';
        });
    } else {
        [headerProfileIcon, profileAvatar].forEach(el => {
            if (!el) return;
            el.style.backgroundImage = `url(${profileData.profilePicture})`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.style.backgroundColor = 'transparent';
            el.textContent = '';
        });
    }
}

// ================================
// LOAD PROFILE DATA
// ================================
function loadProfileData() {
    const dropdownUsername = document.querySelector('.dropdown-username');
    const dropdownEmail = document.querySelector('.dropdown-email');
    if (dropdownUsername) dropdownUsername.textContent = profileData.name;
    if (dropdownEmail) dropdownEmail.textContent = profileData.email;

    const avatar = document.querySelector('.profile-avatar');
    if (avatar) avatar.textContent = getInitials(profileData.name);

    const profileInfoH1 = document.querySelector('.profile-info h1');
    if (profileInfoH1) profileInfoH1.textContent = profileData.name;
    
    const emailP = document.querySelector('.profile-info p:nth-of-type(1)');
    const phoneP = document.querySelector('.profile-info p:nth-of-type(2)');
    
    if (emailP) emailP.textContent = `📧 ${profileData.email}`;

    if (phoneP) {
        if (!profileData.phone || profileData.phone.trim() === '') {
            phoneP.textContent = '📱 Update your phone number';
            phoneP.classList.add('warning');
        } else {
            phoneP.textContent = `📱 ${profileData.phone}`;
            phoneP.classList.remove('warning');
        }
    }

    const firstCard = document.querySelector('.profile-card');
    if (firstCard && !firstCard.querySelector('#editForm')) {
        const contactValues = firstCard.querySelectorAll('.info-value');
        if (contactValues.length >= 4) {
            contactValues[0].textContent = profileData.name;
            contactValues[1].textContent = profileData.email;

            const phoneValue = contactValues[2];
            if (!profileData.phone || profileData.phone.trim() === '') {
                phoneValue.textContent = 'Update your phone number';
                phoneValue.classList.add('warning');
            } else {
                phoneValue.textContent = profileData.phone;
                phoneValue.classList.remove('warning');
            }

            contactValues[3].textContent = profileData.country;
        }
    }

    const languageCard = document.querySelectorAll('.profile-card')[2];
    if (languageCard && !languageCard.querySelector('#languageForm')) {
        const languageValues = languageCard.querySelectorAll('.info-value');
        if (languageValues.length >= 3) {
            languageValues[0].textContent = profileData.language;
            languageValues[1].textContent = profileData.timezone;
            languageValues[2].textContent = profileData.currency;
        }
    }

    loadProfilePicture(profileData.profilePicture);
}

// ================================
// EVENT LISTENERS
// ================================
function initializeEventListeners() {
    const changePhotoBtn = document.getElementById('changePhotoBtn');
    const photoInput = document.getElementById('photoInput');

    if (changePhotoBtn && photoInput) {
        changePhotoBtn.addEventListener('click', () => {
            photoInput.click();
        });

        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageUrl = e.target.result;
                    
                    showStatusMessage('Uploading profile picture...');
                    setTimeout(() => {
                        profileData.profilePicture = imageUrl;
                        loadProfilePicture(imageUrl);
                        saveProfileData();
                        showSuccessMessage('Profile picture updated successfully!');
                    }, 1000);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    const editButtons = document.querySelectorAll('.edit-link');
    if (editButtons[0]) editButtons[0].addEventListener('click', () => editPersonalInfo());
    if (editButtons[2]) editButtons[2].addEventListener('click', () => editLanguageRegion());

    const toggleButtons = document.querySelectorAll(".toggle-btn");
    toggleButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            btn.classList.toggle("active");
        });
    });
}

function showStatusMessage(message) {
    const statusDiv = document.createElement('div');
    statusDiv.className = 'status-message';
    statusDiv.textContent = message;
    document.body.appendChild(statusDiv);

    setTimeout(() => {
        statusDiv.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        statusDiv.remove();
    }, 2000);
}

// ================================
// COUNTRY DATA
// ================================
const countryCodes = {
    MY: "+60", SG: "+65", TH: "+66", ID: "+62", PH: "+63", VN: "+84",
    US: "+1", GB: "+44", AU: "+61", CN: "+86", JP: "+81", KR: "+82",
    IN: "+91", DE: "+49", FR: "+33", IT: "+39", ES: "+34", CA: "+1",
    BR: "+55", MX: "+52"
};

const countryNames = {
    MY: "Malaysia", SG: "Singapore", TH: "Thailand", ID: "Indonesia",
    PH: "Philippines", VN: "Vietnam", US: "United States", GB: "United Kingdom",
    AU: "Australia", CN: "China", JP: "Japan", KR: "South Korea",
    IN: "India", DE: "Germany", FR: "France", IT: "Italy",
    ES: "Spain", CA: "Canada", BR: "Brazil", MX: "Mexico"
};

// ================================
// EDIT PERSONAL INFO
// ================================
function editPersonalInfo() {
    const card = document.querySelector('.profile-card');
    const infoSection = card.querySelector('.info-section');

    infoSection.innerHTML = `
        <h3 class="section-title">Contact Details</h3>
        <form id="editForm" class="edit-form">
            <div class="form-group">
                <label>Full Name *</label>
                <input type="text" id="name" value="${profileData.name}" required>
                <span class="error-message" id="nameError"></span>
            </div>
            <div class="form-group">
                <label>Email Address *</label>
                <input type="email" id="email" value="${profileData.email}" required>
                <span class="error-message" id="emailError"></span>
            </div>
            <div class="form-group">
                <label>Phone Number *</label>
                <input type="tel" id="phone" value="${profileData.phone}" required>
                <span class="error-message" id="phoneError"></span>
            </div>
            <div class="form-group">
                <label>Country *</label>
                <select id="country" required></select>
                <span class="error-message" id="countryError"></span>
            </div>
            <div class="form-actions">
                <button type="submit" class="save-btn">Save Changes</button>
                <button type="button" class="cancel-btn" onclick="cancelEdit()">Cancel</button>
            </div>
        </form>
    `;

    const countrySelectEl = document.getElementById('country');
    countrySelectEl.innerHTML = '<option value="">Select your country</option>';

    Object.entries(countryNames).forEach(([code, name]) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = name;
        if (name === profileData.country) option.selected = true;
        countrySelectEl.appendChild(option);
    });

    const phoneInputEl = document.getElementById('phone');
    const currentCode = Object.keys(countryNames).find(
        key => countryNames[key] === profileData.country
    );
    if ((!profileData.phone || profileData.phone.trim() === '') && currentCode) {
        phoneInputEl.value = `${countryCodes[currentCode]} `;
    }

    countrySelectEl.addEventListener('change', () => {
        const selectedCode = countrySelectEl.value;
        const prefix = countryCodes[selectedCode] || '';
        if (prefix && !phoneInputEl.value.startsWith(prefix)) {
            phoneInputEl.value = `${prefix} `;
        }
    });

    document.getElementById('editForm').addEventListener('submit', (e) => {
        e.preventDefault();
        if (validatePersonalInfo()) {
            savePersonalInfo();
        }
    });
}

function validatePersonalInfo() {
    let isValid = true;
    
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-group input, .form-group select').forEach(el => {
        el.classList.remove('error');
    });
    
    const name = document.getElementById('name').value.trim();
    if (name.length < 2) {
        showError('nameError', 'Name must be at least 2 characters');
        document.getElementById('name').classList.add('error');
        isValid = false;
    } else if (!/^[a-zA-Z\s]+$/.test(name)) {
        showError('nameError', 'Name can only contain letters and spaces');
        document.getElementById('name').classList.add('error');
        isValid = false;
    }
    
    const email = document.getElementById('email').value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('emailError', 'Please enter a valid email address');
        document.getElementById('email').classList.add('error');
        isValid = false;
    }
    
    const phone = document.getElementById('phone').value.trim();
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(phone) || phone.replace(/\D/g, '').length < 10) {
        showError('phoneError', 'Please enter a valid phone number (min 10 digits)');
        document.getElementById('phone').classList.add('error');
        isValid = false;
    }
    
    const country = document.getElementById('country').value;
    if (!country) {
        showError('countryError', 'Please select a country');
        document.getElementById('country').classList.add('error');
        isValid = false;
    }

    return isValid;
}

function showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) errorEl.textContent = message;
}

function savePersonalInfo() {
    showConfirmationModal(() => {
        const newEmail = document.getElementById('email').value.trim();
        
        if (newEmail !== profileData.email) {
            if (!profileData.authenticatorEnabled) {
                showError('emailError', 'Verification Required — Please enable Security Authenticator APP before proceeding.');
                return;
            } else {
                generatedOTP = Math.floor(100000 + Math.random() * 900000);
                alert(`Verification code sent to ${newEmail}: ${generatedOTP}`);
                
                const userOTP = prompt("Enter the 6-digit verification code:");
                if (userOTP != generatedOTP) {
                    showError('emailError', 'Invalid OTP. Email not updated.');
                    return;
                }
            }
        }

        profileData.name = document.getElementById('name').value.trim();
        profileData.email = newEmail;
        profileData.phone = document.getElementById('phone').value.trim();
        profileData.country = countryNames[document.getElementById('country').value];

        saveProfileData();
        cancelEdit();
        loadProfileData();
        
        const dropdownUsername = document.querySelector('.dropdown-username');
        const dropdownEmail = document.querySelector('.dropdown-email');
        if (dropdownUsername) dropdownUsername.textContent = profileData.name;
        if (dropdownEmail) dropdownEmail.textContent = profileData.email;
        updateProfileIcon();
        
        showSuccessMessage('Profile updated successfully!');
    });
}

// ================================
// EDIT LANGUAGE & REGION
// ================================
function editLanguageRegion() {
    const card = document.querySelectorAll('.profile-card')[2];
    const infoSection = card.querySelector('.info-section');
    
    infoSection.innerHTML = `
        <form id="languageForm" class="edit-form">
            <div class="form-group">
                <label>Language *</label>
                <select id="language" required>
                    <option value="English (US)" ${profileData.language === 'English (US)' ? 'selected' : ''}>English (US)</option>
                    <option value="English (UK)" ${profileData.language === 'English (UK)' ? 'selected' : ''}>English (UK)</option>
                    <option value="Spanish" ${profileData.language === 'Spanish' ? 'selected' : ''}>Spanish</option>
                    <option value="French" ${profileData.language === 'French' ? 'selected' : ''}>French</option>
                    <option value="German" ${profileData.language === 'German' ? 'selected' : ''}>German</option>
                    <option value="Chinese" ${profileData.language === 'Chinese' ? 'selected' : ''}>Chinese</option>
                </select>
            </div>
            <div class="form-group">
                <label>Timezone *</label>
                <select id="timezone" required>
                    <option value="GMT-5 (New York)" ${profileData.timezone === 'GMT-5 (New York)' ? 'selected' : ''}>GMT-5 (New York)</option>
                    <option value="GMT (London)" ${profileData.timezone === 'GMT (London)' ? 'selected' : ''}>GMT (London)</option>
                    <option value="GMT+1 (Paris)" ${profileData.timezone === 'GMT+1 (Paris)' ? 'selected' : ''}>GMT+1 (Paris)</option>
                    <option value="GMT+8 (Kuala Lumpur)" ${profileData.timezone === 'GMT+8 (Kuala Lumpur)' ? 'selected' : ''}>GMT+8 (Kuala Lumpur)</option>
                    <option value="GMT+8 (Singapore)" ${profileData.timezone === 'GMT+8 (Singapore)' ? 'selected' : ''}>GMT+8 (Singapore)</option>
                    <option value="GMT+10 (Sydney)" ${profileData.timezone === 'GMT+10 (Sydney)' ? 'selected' : ''}>GMT+10 (Sydney)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Currency Display *</label>
                <select id="currency" required>
                    <option value="USD ($)" ${profileData.currency === 'USD ($)' ? 'selected' : ''}>USD ($)</option>
                    <option value="EUR (€)" ${profileData.currency === 'EUR (€)' ? 'selected' : ''}>EUR (€)</option>
                    <option value="GBP (£)" ${profileData.currency === 'GBP (£)' ? 'selected' : ''}>GBP (£)</option>
                    <option value="MYR (RM)" ${profileData.currency === 'MYR (RM)' ? 'selected' : ''}>MYR (RM)</option>
                    <option value="SGD (S$)" ${profileData.currency === 'SGD (S$)' ? 'selected' : ''}>SGD (S$)</option>
                    <option value="AUD (A$)" ${profileData.currency === 'AUD (A$)' ? 'selected' : ''}>AUD (A$)</option>
                </select>
            </div>
            <div class="form-actions">
                <button type="submit" class="save-btn">Save Changes</button>
                <button type="button" class="cancel-btn" onclick="cancelLanguageEdit()">Cancel</button>
            </div>
        </form>
    `;

    document.getElementById('languageForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveLanguageRegion();
    });
}

function saveLanguageRegion() {
    profileData.language = document.getElementById('language').value;
    profileData.timezone = document.getElementById('timezone').value;
    profileData.currency = document.getElementById('currency').value;
    
    saveProfileData();
    cancelLanguageEdit();
    
    const languageCard = document.querySelectorAll('.profile-card')[2];
    const languageValues = languageCard.querySelectorAll('.info-value');
    if (languageValues.length >= 3) {
        languageValues[0].textContent = profileData.language;
        languageValues[1].textContent = profileData.timezone;
        languageValues[2].textContent = profileData.currency;
    }
    
    showSuccessMessage('Language & Region updated successfully!');
}

function showConfirmationModal(onConfirm) {
    const modal = document.getElementById('confirmationModal');
    if (!modal) return;
    modal.style.display = 'flex';

    const confirmBtn = document.getElementById('confirmSaveBtn');
    const cancelBtn = document.getElementById('cancelSaveBtn');

    const closeModal = () => {
        modal.style.display = 'none';
        confirmBtn.removeEventListener('click', confirmHandler);
        cancelBtn.removeEventListener('click', closeModal);
    };

    const confirmHandler = () => {
        onConfirm();
        closeModal();
    };

    confirmBtn.addEventListener('click', confirmHandler);
    cancelBtn.addEventListener('click', closeModal);
}

function cancelEdit() {
    const card = document.querySelector('.profile-card');
    const infoSection = card.querySelector('.info-section');
    
    infoSection.innerHTML = `
        <h3 class="section-title">Contact Details</h3>
        <div class="info-row">
            <span class="info-label">Full Name</span>
            <span class="info-value">${profileData.name}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Email Address</span>
            <span class="info-value">${profileData.email}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Phone Number</span>
            <span class="info-value">${profileData.phone}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Country</span>
            <span class="info-value">${profileData.country}</span>
        </div>
    `;
}

function cancelLanguageEdit() {
    const card = document.querySelectorAll('.profile-card')[2];
    const infoSection = card.querySelector('.info-section');
    
    infoSection.innerHTML = `
        <div class="info-row">
            <span class="info-label">Language</span>
            <span class="info-value">${profileData.language}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Timezone</span>
            <span class="info-value">${profileData.timezone}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Currency Display</span>
            <span class="info-value">${profileData.currency}</span>
        </div>
    `;
}

function saveProfileData() {
    localStorage.setItem('loggedInUser', JSON.stringify(profileData));
    console.log("Profile data saved:", profileData);
}

function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => successDiv.classList.add('show'), 100);
    setTimeout(() => {
        successDiv.classList.remove('show');
        setTimeout(() => successDiv.remove(), 300);
    }, 3000);
}

// ================================
// CHANGE PASSWORD MODAL
// ================================
const changePasswordModal = document.getElementById('changePasswordModal');
const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
const savePasswordBtn = document.getElementById('savePasswordBtn');
const messageBox = document.getElementById('passwordMessage');
const newPasswordInput = document.getElementById('newPassword');

const strengthContainer = document.querySelector('.password-strength');
const strengthBarFill = document.querySelector('.strength-bar-fill');
const strengthText = document.querySelector('.strength-text');

function openChangePasswordModal() {
    if (changePasswordModal) changePasswordModal.style.display = 'flex';
}

function closeChangePasswordModal() {
    if (!changePasswordModal) return;
    changePasswordModal.style.display = 'none';
    if (messageBox) messageBox.textContent = '';
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('retypePassword').value = '';
    if (strengthContainer) strengthContainer.classList.remove('show');
    if (strengthBarFill) strengthBarFill.className = 'strength-bar-fill';
    if (strengthText) {
        strengthText.textContent = '';
        strengthText.className = 'strength-text';
    }
}

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

if (newPasswordInput) {
    newPasswordInput.addEventListener('input', (e) => {
        const password = e.target.value.trim();

        if (!password) {
            if (strengthContainer) strengthContainer.classList.remove('show');
            if (strengthBarFill) strengthBarFill.className = 'strength-bar-fill';
            if (strengthText) {
                strengthText.textContent = '';
                strengthText.className = 'strength-text';
            }
            return;
        }

        const result = checkPasswordStrength(password);
        if (strengthContainer) strengthContainer.classList.add('show');
        if (strengthBarFill) strengthBarFill.className = `strength-bar-fill ${result.class}`;
        if (strengthText) {
            strengthText.textContent = result.strength;
            strengthText.className = `strength-text ${result.class}`;
        }
    });
}

if (cancelPasswordBtn) {
    cancelPasswordBtn.addEventListener('click', closeChangePasswordModal);
}

if (savePasswordBtn) {
    savePasswordBtn.addEventListener('click', () => {
        const current = document.getElementById('currentPassword').value.trim();
        const newPass = document.getElementById('newPassword').value.trim();
        const retype = document.getElementById('retypePassword').value.trim();

        if (messageBox) {
            messageBox.textContent = '';
            messageBox.className = 'message';
        }

        const storedUser = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
        const storedPassword = storedUser.password || '';

        if (!current || !newPass || !retype) {
            showMessage('Please fill in all fields.', 'error');
            return;
        }

        if (current !== storedPassword) {
            showMessage('Current password is incorrect.', 'error');
            return;
        }

        if (newPass === storedPassword) {
            showMessage('New password cannot be the same as the current password.', 'error');
            return;
        }

        if (newPass.length < 8) {
            showMessage('New password must be at least 8 characters.', 'error');
            return;
        }

        if (newPass !== retype) {
            showMessage('Passwords do not match.', 'error');
            return;
        }

        storedUser.password = newPass;
        localStorage.setItem('loggedInUser', JSON.stringify(storedUser));

        showMessage('Password updated successfully!', 'success');

        setTimeout(() => {
            closeChangePasswordModal();
        }, 1500);
    });
}

function showMessage(text, type) {
    if (!messageBox) return;
    messageBox.textContent = text;
    messageBox.classList.add(type);
}

// Make functions globally available
window.cancelEdit = cancelEdit;
window.cancelLanguageEdit = cancelLanguageEdit;
window.openChangePasswordModal = openChangePasswordModal;