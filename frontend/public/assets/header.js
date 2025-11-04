// ================================
// INITIALIZATION
// ================================
document.addEventListener("DOMContentLoaded", () => {
    initializeTheme();
    setupThemeToggle();
    setupProfileDropdown();
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

    // Load user data from localStorage
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

    // Update profile icon with picture or initials
    const profileImage = storedUser.profilePicture || storedUser.profilePic;
    
    if (profileImage && profileImage.startsWith('data:image')) {
        // Has profile picture
        profileIcon.style.backgroundImage = `url(${profileImage})`;
        profileIcon.style.backgroundSize = "cover";
        profileIcon.style.backgroundPosition = "center";
        profileIcon.style.backgroundColor = "transparent";
        profileIcon.textContent = "";
    } else if (storedUser.name || storedUser.fullName) {
        // No picture - show initials
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

    // Handle logout button specifically
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            handleLogout();
        });
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