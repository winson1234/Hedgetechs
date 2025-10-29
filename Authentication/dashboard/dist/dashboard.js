// Get user data from localStorage (after login)
const storedUser = JSON.parse(localStorage.getItem('loggedInUser') || '{}');

const userData = {
    name: storedUser.name || 'John Doe',
    email: storedUser.email || 'john.doe@example.com',
    initials: getInitials(storedUser.name || 'John Doe')
};

// Function to get initials from name
function getInitials(name) {
    const names = name.trim().split(' ');
    if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Update UI with user data
const profileIcon = document.getElementById('profileIcon');
const welcomeUsername = document.getElementById('welcomeUsername');
const dropdownUsername = document.getElementById('dropdownUsername');
const dropdownEmail = document.getElementById('dropdownEmail');

if (profileIcon) profileIcon.textContent = userData.initials;
if (welcomeUsername) welcomeUsername.textContent = userData.name;
if (dropdownUsername) dropdownUsername.textContent = userData.name;
if (dropdownEmail) dropdownEmail.textContent = userData.email;

// Profile dropdown toggle
const profileDropdown = document.getElementById('profileDropdown');
if (profileIcon && profileDropdown) {
    profileIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('show');
    });
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (profileDropdown && !profileDropdown.contains(e.target) && e.target !== profileIcon) {
        profileDropdown.classList.remove('show');
    }
});

// Logout functionality
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
}

function handleLogout() {
    // Clear logged-in user data
    localStorage.removeItem('loggedInUser');
    // Redirect to login page
    alert('You have been logged out successfully!');
    window.location.href = '../login/login.html';
}

// Fix: Add event listeners for dropdown menu items
document.addEventListener('DOMContentLoaded', function() {
    // Get all dropdown items except the logout button
    const dropdownItems = document.querySelectorAll('.dropdown-item:not(#logoutBtn)');
    
    dropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Close dropdown
            if (profileDropdown) {
                profileDropdown.classList.remove('show');
            }
            
            // Show appropriate message based on which item was clicked
            const text = item.textContent.trim();
            if (text.includes('Profile')) {
                alert('My Profile feature is coming soon!');
            } else if (text.includes('Settings')) {
                alert('Settings feature is coming soon!');
            } else if (text.includes('Help')) {
                alert('Help & Support feature is coming soon!');
            } else {
                alert('This feature is coming soon!');
            }
        });
    });
});

// Action buttons (if you add them later)
const actionButtons = document.querySelectorAll('.action-btn');
actionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        alert('This feature is coming soon!');
    });
});