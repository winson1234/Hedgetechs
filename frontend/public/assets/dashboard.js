
document.addEventListener("DOMContentLoaded", () => {
  const guestButtons = document.getElementById("guestButtons");
  const profileContainer = document.getElementById("profileContainer");

  const storedUser = JSON.parse(localStorage.getItem("loggedInUser") || "null");

  if (storedUser) {
    // Show profile, hide login/signup
    if (guestButtons) guestButtons.style.display = "none";
    if (profileContainer) profileContainer.style.display = "flex";

    setupProfileDropdown(storedUser);
    console.log("✅ Logged-in view loaded");
  } else {
    // Show login/signup, hide profile
    if (guestButtons) guestButtons.style.display = "flex";
    if (profileContainer) profileContainer.style.display = "none";

    console.log("👤 Guest view loaded");
  }
});

function setupProfileDropdown(profileData) {
  const profileIcon = document.getElementById("profileIcon");
  const profileDropdown = document.getElementById("profileDropdown");
  const dropdownUsername = document.querySelector(".dropdown-username");
  const dropdownEmail = document.querySelector(".dropdown-email");

    if (!profileIcon || !profileDropdown) {
        console.log("Profile elements not found");
        return;
    }
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
  // Set initials or image
  if (profileData.profilePicture && profileData.profilePicture.startsWith("data:image")) {
    profileIcon.style.backgroundImage = `url(${profileData.profilePicture})`;
    profileIcon.textContent = "";
  } else {
    const initials = getInitials(profileData.name);
    profileIcon.textContent = initials;
  }

  // Dropdown toggle logic
  profileIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle("show");
  });

  document.addEventListener("click", (e) => {
    if (!profileIcon.contains(e.target) && !profileDropdown.contains(e.target)) {
      profileDropdown.classList.remove("show");
    }
  });

  // Handle dropdown item clicks
  document.querySelectorAll(".dropdown-item").forEach(item => {
    item.addEventListener("click", (e) => {
      const itemText = item.textContent.trim();
      if (itemText === "Logout") {
        e.preventDefault();
        handleLogout();
      }
      // For other items, let the default href behavior work
    });
  });
}
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

// Helper: Get initials from a full name
function getInitials(name) {
  if (!name) return "";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ===========================
// Theme Toggle Functionality
// ===========================
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

// Check for saved theme preference or default to dark mode
const currentTheme = localStorage.getItem('theme') || 'dark';
if (currentTheme === 'light') {
    body.classList.add('light-mode');
}

themeToggle.addEventListener('click', () => {
    body.classList.toggle('light-mode');
    
    // Save theme preference
    const theme = body.classList.contains('light-mode') ? 'light' : 'dark';
    localStorage.setItem('theme', theme);
    
    // Add animation effect
    themeToggle.style.transform = 'rotate(360deg)';
    setTimeout(() => {
        themeToggle.style.transform = 'rotate(0deg)';
    }, 300);
});
// ===========================
// Multi-Language Selector
// ===========================
const languageSelector = document.getElementById('languageSelector');
const languageToggle = document.getElementById('languageToggle');
const languageMenu = document.getElementById('languageMenu');
const languageLabel = document.getElementById('languageLabel');

// Load saved language or default to English
const savedLang = localStorage.getItem('language') || 'en';
setLanguage(savedLang);

// Toggle menu visibility
languageToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    languageMenu.classList.toggle('show');

    // Small rotate animation
    languageToggle.style.transform = 'rotate(180deg)';
    setTimeout(() => {
        languageToggle.style.transform = 'rotate(0deg)';
    }, 300);
});

// Handle language selection
languageMenu.querySelectorAll('li').forEach(item => {
    item.addEventListener('click', () => {
        const selectedLang = item.getAttribute('data-lang');
        setLanguage(selectedLang);
        languageMenu.classList.remove('show');
    });
});

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    if (!languageSelector.contains(e.target)) {
        languageMenu.classList.remove('show');
    }
});

// Apply selected language
function setLanguage(lang) {
    const languages = {
        en: 'EN',
        zh: '中文',
        jp: '日本語',
        kr: '한국어'
    };

    languageLabel.textContent = languages[lang] || 'EN';
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;

    console.log(`Language switched to: ${languages[lang]} (${lang})`);
}

// ===========================
// Mobile Menu Toggle
// ===========================
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');
const menuIcon = mobileMenuBtn.querySelector('.menu-icon');
const closeIcon = mobileMenuBtn.querySelector('.close-icon');

mobileMenuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('active');
    
    if (mobileMenu.classList.contains('active')) {
        menuIcon.style.display = 'none';
        closeIcon.style.display = 'block';
    } else {
        menuIcon.style.display = 'block';
        closeIcon.style.display = 'none';
    }
});

// Close mobile menu when clicking on a link
const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
mobileNavLinks.forEach(link => {
    link.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
        menuIcon.style.display = 'block';
        closeIcon.style.display = 'none';
    });
});

// ===========================
// Smooth Scrolling for Navigation Links
// ===========================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ===========================
// Header Scroll Effect
// ===========================
let lastScroll = 0;
const header = document.querySelector('.header');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

// ===========================
// Market Filter Functionality
// ===========================
const marketTabs = document.querySelectorAll('.market-tab');
const cryptoRows = document.querySelectorAll('.crypto-row[data-filter]');

marketTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const filter = tab.getAttribute('data-market-filter');
        
        // Update active tab
        marketTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Filter crypto rows
        cryptoRows.forEach(row => {
            const rowFilters = row.getAttribute('data-filter').split(' ');
            
            if (filter === 'popular' || rowFilters.includes(filter)) {
                row.style.display = 'grid';
                // Add animation
                row.style.animation = 'none';
                setTimeout(() => {
                    row.style.animation = 'fadeInUp 0.5s ease-out';
                }, 10);
            } else {
                row.style.display = 'none';
            }
        });
        
        // Update summary stats based on filter
        updateSummaryStats(filter);
        
        // Add haptic feedback
        tab.style.transform = 'scale(0.95)';
        setTimeout(() => {
            tab.style.transform = '';
        }, 100);
        
        console.log(`Market filter: ${filter}`);
    });
});

// ===========================
// Update Summary Stats
// ===========================
function updateSummaryStats(filter) {
    const gainersCount = document.getElementById('gainersCount');
    const losersCount = document.getElementById('losersCount');
    const neutralCount = document.getElementById('neutralCount');
    
    let gainers = 0;
    let losers = 0;
    let neutral = 0;
    
    cryptoRows.forEach(row => {
        if (row.style.display !== 'none') {
            const changeElement = row.querySelector('.crypto-change');
            if (changeElement) {
                if (changeElement.classList.contains('positive')) {
                    gainers++;
                } else if (changeElement.classList.contains('negative')) {
                    losers++;
                } else {
                    neutral++;
                }
            }
        }
    });
    
    if (gainersCount) gainersCount.textContent = gainers;
    if (losersCount) losersCount.textContent = losers;
    if (neutralCount) neutralCount.textContent = neutral;
}

// ===========================
// Crypto Price Animation (Simulated real-time updates)
// ===========================
function updateCryptoPrices() {
    const cryptoRows = document.querySelectorAll('.crypto-row[data-crypto]');
    
    cryptoRows.forEach(row => {
        const priceElement = row.querySelector('.crypto-price');
        const changeElement = row.querySelector('.crypto-change');
        
        if (priceElement && changeElement && row.style.display !== 'none') {
            // Get current price
            const currentPrice = parseFloat(priceElement.getAttribute('data-price'));
            
            // Simulate small price changes (-0.5% to +0.5%)
            const randomChange = (Math.random() - 0.5) * 1;
            const newPrice = currentPrice * (1 + randomChange / 100);
            
            // Update price
            const formattedPrice = newPrice < 1 
                ? `$${newPrice.toFixed(4)}` 
                : `$${newPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            
            priceElement.textContent = formattedPrice;
            priceElement.setAttribute('data-price', newPrice.toFixed(4));
            
            // Add flash animation
            priceElement.style.transition = 'color 0.3s ease';
            priceElement.style.color = randomChange > 0 ? '#00d4aa' : '#ff4757';
            
            setTimeout(() => {
                priceElement.style.color = '';
            }, 300);
            
            // Update change percentage
            const currentChange = parseFloat(changeElement.getAttribute('data-change'));
            const newChange = currentChange + (randomChange * 0.1);
            const formattedChange = (newChange >= 0 ? '+' : '') + newChange.toFixed(1) + '%';
            
            const arrow = changeElement.querySelector('.change-arrow');
            if (arrow) {
                arrow.textContent = newChange >= 0 ? '▲' : '▼';
            }
            
            const textNode = Array.from(changeElement.childNodes).find(node => node.nodeType === 3);
            if (textNode) {
                textNode.textContent = ' ' + formattedChange;
            }
            
            changeElement.setAttribute('data-change', newChange.toFixed(1));
            changeElement.classList.remove('positive', 'negative');
            changeElement.classList.add(newChange >= 0 ? 'positive' : 'negative');
        }
    });
    
    // Update market cap and volume
    updateMarketStats();
}

// ===========================
// Update Market Statistics
// ===========================
function updateMarketStats() {
    const marketCapElement = document.querySelector('.market-cap-value');
    const marketVolumeElement = document.querySelector('.market-volume-value');
    
    if (marketCapElement && marketVolumeElement) {
        // Simulate small changes in market cap and volume
        const capChange = (Math.random() - 0.5) * 0.02;
        const volumeChange = (Math.random() - 0.5) * 0.05;
        
        // Parse current values
        const currentCap = parseFloat(marketCapElement.textContent.replace('$', '').replace('T', ''));
        const currentVolume = parseFloat(marketVolumeElement.textContent.replace('$', '').replace('B', ''));
        
        // Calculate new values
        const newCap = currentCap * (1 + capChange);
        const newVolume = currentVolume * (1 + volumeChange);
        
        // Update display
        marketCapElement.textContent = `$${newCap.toFixed(2)}T`;
        marketVolumeElement.textContent = `$${newVolume.toFixed(0)}B`;
    }
}

// Update prices every 5 seconds (simulated)
setInterval(updateCryptoPrices, 5000);

// ===========================
// Buy Button Functionality
// ===========================
const buyButtons = document.querySelectorAll('.btn-trade');
buyButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        const row = e.target.closest('.crypto-row');
        const cryptoSymbol = row.querySelector('.crypto-symbol').textContent;
        const cryptoPrice = row.querySelector('.crypto-price').textContent;
        
        // Add click animation
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = '';
        }, 100);
        
        alert(`Trade ${cryptoSymbol}\nCurrent Price: ${cryptoPrice}\n\nThis will redirect to the trading page.`);
    });
});

// ===========================
// Email Input Validation
// ===========================
const emailInput = document.querySelector('.email-input');
const getStartedBtn = document.querySelector('.hero-cta .btn-gradient');

if (getStartedBtn && emailInput) {
    getStartedBtn.addEventListener('click', () => {
        const email = emailInput.value.trim();
        
        if (email === '') {
            alert('Please enter your email address');
            emailInput.focus();
            return;
        }
        
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Please enter a valid email address');
            emailInput.focus();
            return;
        }
        
        alert(`Thank you for your interest!\nWe'll send registration details to: ${email}`);
        emailInput.value = '';
    });
    
    // Allow Enter key to submit
    emailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            getStartedBtn.click();
        }
    });
}

// ===========================
// Intersection Observer for Fade-in Animation
// ===========================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animation
const animatedElements = document.querySelectorAll('.trust-card, .trading-card-mockup, .payout-content, .features-content, .dashboard-img');
animatedElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// ===========================
// View More Prices Link
// ===========================
const viewMoreLink = document.querySelector('.view-more-link');
if (viewMoreLink) {
    viewMoreLink.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Loading more cryptocurrency prices...\n\nThis will display additional trading pairs and markets.');
    });
}

// ===========================
// News Feed Functionality
// ===========================
const newsTabs = document.querySelectorAll('.news-tab');
const newsItems = document.querySelectorAll('.news-item');
const newsEmpty = document.getElementById('newsEmpty');
const newsGrid = document.getElementById('newsGrid');

newsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const category = tab.getAttribute('data-category');
        
        // Update active state
        newsTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Filter news
        filterNews(category);
        
        // Add haptic feedback
        tab.style.transform = 'scale(0.95)';
        setTimeout(() => {
            tab.style.transform = '';
        }, 100);
    });
});

function filterNews(category) {
    let visibleCount = 0;

    newsItems.forEach((item, index) => {
        const itemCategory = item.getAttribute('data-category');
        
        if (category === 'all' || itemCategory === category) {
            item.style.display = 'flex';
            // Reset and replay animation
            item.style.animation = 'none';
            setTimeout(() => {
                item.style.animation = `fadeInUp 0.6s ease-out ${index * 0.1}s forwards`;
            }, 10);
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });

    // Show empty state if no news found
    if (visibleCount === 0) {
        newsEmpty.style.display = 'block';
        newsGrid.style.display = 'none';
    } else {
        newsEmpty.style.display = 'none';
        newsGrid.style.display = 'grid';
    }
}

// Add Click Handlers to News Items
const newsLinks = document.querySelectorAll('.news-link');
newsLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const newsItem = link.closest('.news-item');
        const newsTitle = newsItem.querySelector('.news-title').textContent;
        
        alert(`📰 Opening Article\n\n${newsTitle}\n\nThis would normally open the full article page.`);
    });
});

// ===========================
// Newsletter Subscription
// ===========================
const newsletterInput = document.querySelector('.newsletter-input');
const subscribeBtn = document.querySelector('.newsletter-form .btn-gradient');

if (subscribeBtn && newsletterInput) {
    subscribeBtn.addEventListener('click', () => {
        const email = newsletterInput.value.trim();
        
        if (email === '') {
            alert('⚠️ Please enter your email address');
            newsletterInput.focus();
            return;
        }
        
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('⚠️ Please enter a valid email address');
            newsletterInput.focus();
            return;
        }
        
        alert(`✅ Thank you for subscribing!\n\nWe'll send daily market insights to:\n${email}`);
        newsletterInput.value = '';
        
        // Add success animation
        subscribeBtn.textContent = 'Subscribed! ✓';
        subscribeBtn.style.background = 'linear-gradient(135deg, #00d4aa, #00f5cc)';
        
        setTimeout(() => {
            subscribeBtn.textContent = 'Subscribe';
            subscribeBtn.style.background = '';
        }, 3000);
    });
    
    // Allow Enter key to submit
    newsletterInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            subscribeBtn.click();
        }
    });
}

// ===========================
// Log In and Sign Up Button Handlers
// ===========================
const authButtons = document.querySelectorAll('.btn-secondary, .btn-gradient');
authButtons.forEach(button => {
    if (button.textContent === 'Log In') {
        button.addEventListener('click', (e) => {
            if (!button.closest('.hero-cta') && !button.closest('.faq-cta-buttons')) {
                e.preventDefault();
                window.location.href = '/login.html';
            }
        });
    } else if (button.textContent === 'Sign Up' && !button.closest('.hero-cta')) {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/register.html';
        });
    }
});

// ===========================
// Prevent default behavior for footer links
// ===========================
const footerLinks = document.querySelectorAll('.footer-column a');
footerLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const linkText = link.textContent;
        alert(`Navigating to ${linkText} page...`);
    });
});

// ===========================
// Stats Counter Animation
// ===========================
const statObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statValues = entry.target.querySelectorAll('.stat-value');
            statValues.forEach(stat => {
                const text = stat.textContent;
                const match = text.match(/[\d.]+/);
                if (match) {
                    const value = parseFloat(match[0]);
                    const suffix = text.replace(/[\d.]+/, '');
                    
                    let current = 0;
                    const increment = value / 100;
                    const timer = setInterval(() => {
                        current += increment;
                        if (current >= value) {
                            stat.textContent = value + suffix;
                            clearInterval(timer);
                        } else {
                            stat.textContent = current.toFixed(1) + suffix;
                        }
                    }, 20);
                }
            });
            statObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const statsBanner = document.querySelector('.stats-banner');
if (statsBanner) {
    statObserver.observe(statsBanner);
}

// ===========================
// Add ripple effect to buttons
// ===========================
function createRipple(event) {
    const button = event.currentTarget;
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
    circle.style.top = `${event.clientY - button.offsetTop - radius}px`;
    circle.classList.add('ripple');
    circle.style.position = 'absolute';
    circle.style.borderRadius = '50%';
    circle.style.background = 'rgba(255, 255, 255, 0.5)';
    circle.style.transform = 'scale(0)';
    circle.style.animation = 'ripple 0.6s ease-out';

    const ripple = button.getElementsByClassName('ripple')[0];
    if (ripple) {
        ripple.remove();
    }

    button.style.position = 'relative';
    button.style.overflow = 'hidden';
    button.appendChild(circle);

    setTimeout(() => circle.remove(), 600);
}

// Add ripple animation to CSS dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Add ripple to all buttons
const buttons = document.querySelectorAll('.btn, .btn-trade, .market-tab, .news-tab');
buttons.forEach(button => {
    button.addEventListener('click', createRipple);
});

// ===========================
// Console welcome message
// ===========================
console.log('%c🚀 FPMarkets Dashboard', 'font-size: 20px; font-weight: bold; color: #FDDB92;');
console.log('%cWelcome to the crypto trading platform!', 'font-size: 14px; color: #00d4aa;');
console.log('%cBuilt with modern web technologies', 'font-size: 12px; color: #a0a0b8;');


// ===========================
// Initialize all features on page load
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard initialized successfully!');
    
    // Add loaded class to body for any CSS transitions
    body.classList.add('loaded');
    
    // Trading card hover effect
    const tradingCard = document.querySelector('.trading-card-mockup');
    if (tradingCard) {
        tradingCard.addEventListener('mouseenter', () => {
            tradingCard.style.transform = 'translateY(-10px) rotateY(5deg)';
        });
        
        tradingCard.addEventListener('mouseleave', () => {
            tradingCard.style.transform = 'translateY(0) rotateY(0)';
        });
    }
    
    // Dashboard image hover effect
    const dashboardImg = document.querySelector('.dashboard-img');
    if (dashboardImg) {
        dashboardImg.addEventListener('mouseenter', () => {
            dashboardImg.style.transform = 'scale(1.05)';
        });
        
        dashboardImg.addEventListener('mouseleave', () => {
            dashboardImg.style.transform = 'scale(1)';
        });
    }
    
    // Payment icon hover animation
    const paymentIcons = document.querySelectorAll('.payment-icon');
    paymentIcons.forEach(icon => {
        icon.addEventListener('mouseenter', () => {
            icon.style.transform = 'translateY(-4px) scale(1.05)';
        });
        
        icon.addEventListener('mouseleave', () => {
            icon.style.transform = 'translateY(0) scale(1)';
        });
    });
});
// ===========================
// FAQ Accordion Functionality
// ===========================

document.addEventListener('DOMContentLoaded', () => {
    // Get all FAQ items
    const faqItems = document.querySelectorAll('.faq-item');
    const faqQuestions = document.querySelectorAll('.faq-question');

    // Add click event to each FAQ question
    faqQuestions.forEach((question, index) => {
        question.addEventListener('click', () => {
            const faqItem = question.closest('.faq-item');
            const isActive = faqItem.classList.contains('active');

            // Close all other FAQ items (optional - remove if you want multiple open)
            faqItems.forEach(item => {
                if (item !== faqItem) {
                    item.classList.remove('active');
                    const btn = item.querySelector('.faq-question');
                    btn.setAttribute('aria-expanded', 'false');
                }
            });

            // Toggle current FAQ item
            if (isActive) {
                faqItem.classList.remove('active');
                question.setAttribute('aria-expanded', 'false');
            } else {
                faqItem.classList.add('active');
                question.setAttribute('aria-expanded', 'true');
            }
        });

        // Add keyboard accessibility
        question.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                question.click();
            }
        });
    });

    // ===========================
    // Smooth Scroll Animation
    // ===========================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Animate FAQ items on scroll
    faqItems.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        item.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
        observer.observe(item);
    });

    // ===========================
    // CTA Button Handlers
    // ===========================
    const contactSupportBtn = document.querySelector('.faq-cta-buttons .btn-gradient');
    const helpCenterBtn = document.querySelector('.faq-cta-buttons .btn-secondary');

    if (contactSupportBtn) {
        contactSupportBtn.addEventListener('click', () => {
            alert('Opening Live Chat...\n\nYou can also email us at support@fpmarkets.com');
            // In production, this would open a live chat widget or redirect to support page
            // window.location.href = '/support/contact';
        });
    }

    if (helpCenterBtn) {
        helpCenterBtn.addEventListener('click', () => {
            alert('Redirecting to Help Center...\n\nYou\'ll find comprehensive guides and tutorials there.');
            // In production, this would redirect to the help center
            // window.location.href = '/help-center';
        });
    }

    // ===========================
    // Search Functionality (Optional Enhancement)
    // ===========================
    // You can add a search bar to filter FAQs
    function filterFAQs(searchTerm) {
        const lowerCaseSearch = searchTerm.toLowerCase();
        
        faqItems.forEach(item => {
            const question = item.querySelector('.question-text').textContent.toLowerCase();
            const answer = item.querySelector('.answer-content').textContent.toLowerCase();
            
            if (question.includes(lowerCaseSearch) || answer.includes(lowerCaseSearch)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    // ===========================
    // Analytics Tracking (Optional)
    // ===========================
    faqQuestions.forEach((question) => {
        question.addEventListener('click', () => {
            const faqItem = question.closest('.faq-item');
            const questionText = question.querySelector('.question-text').textContent;
            const answer = faqItem.querySelector('.faq-answer'); // ✅ define it here

            console.log('FAQ Clicked:', questionText);
            console.log('Expanding:', question.textContent, 'Height:', answer.scrollHeight);

            // In production, you would track this with analytics
            // trackEvent('FAQ', 'Click', questionText);
        });
    });

    // ===========================
    // Auto-expand from URL hash (Optional)
    // ===========================
    // If URL has #faq-1, auto-expand that FAQ item
    function checkURLHash() {
        const hash = window.location.hash;
        if (hash.startsWith('#faq-')) {
            const index = parseInt(hash.replace('#faq-', '')) - 1;
            if (faqItems[index]) {
                faqItems[index].classList.add('active');
                faqItems[index].querySelector('.faq-question').setAttribute('aria-expanded', 'true');
                
                // Scroll to the FAQ item
                setTimeout(() => {
                    faqItems[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        }
    }

    checkURLHash();

    // Listen for hash changes
    window.addEventListener('hashchange', checkURLHash);

    // ===========================
    // Add ripple effect to buttons
    // ===========================
    function createRipple(event) {
        const button = event.currentTarget;
        const circle = document.createElement('span');
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;

        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
        circle.style.top = `${event.clientY - button.offsetTop - radius}px`;
        circle.classList.add('ripple');
        circle.style.position = 'absolute';
        circle.style.borderRadius = '50%';
        circle.style.background = 'rgba(255, 255, 255, 0.5)';
        circle.style.transform = 'scale(0)';
        circle.style.animation = 'ripple 0.6s ease-out';

        const ripple = button.getElementsByClassName('ripple')[0];
        if (ripple) {
            ripple.remove();
        }

        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.appendChild(circle);

        setTimeout(() => circle.remove(), 600);
    }

    // Add ripple to all buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('click', createRipple);
    });

    // Add ripple animation to CSS dynamically
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // ===========================
    // Console Message
    // ===========================
    console.log('%c💬 FAQ Section Loaded', 'font-size: 16px; font-weight: bold; color: #FDDB92;');
    console.log('%cTotal FAQ items: ' + faqItems.length, 'font-size: 12px; color: #00d4aa;');
});

// ===========================
// Export functions for use in main dashboard (Optional)
// ===========================
window.FAQModule = {
    openFAQ: (index) => {
        const faqItems = document.querySelectorAll('.faq-item');
        if (faqItems[index]) {
            faqItems[index].classList.add('active');
            faqItems[index].querySelector('.faq-question').setAttribute('aria-expanded', 'true');
            faqItems[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },
    closeFAQ: (index) => {
        const faqItems = document.querySelectorAll('.faq-item');
        if (faqItems[index]) {
            faqItems[index].classList.remove('active');
            faqItems[index].querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        }
    },
    closeAllFAQs: () => {
        const faqItems = document.querySelectorAll('.faq-item');
        faqItems.forEach(item => {
            item.classList.remove('active');
            item.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        });
    }
};
// ===========================
// News Feed Widget - JavaScript with Mock Data
// ===========================

document.addEventListener('DOMContentLoaded', () => {
    // ===========================
    // Mock News Data
    // ===========================
    const mockNewsData = [
        {
            id: '1',
            title: 'Bitcoin Surges Past $54K as Institutional Adoption Accelerates',
            excerpt: 'Major financial institutions continue to embrace cryptocurrency as Bitcoin reaches new quarterly highs amid growing market confidence and regulatory clarity.',
            source: 'CoinDesk',
            timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
            category: 'crypto',
            imageUrl: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&q=80',
            articleUrl: '#bitcoin-surge',
            isFeatured: true
        },
        {
            id: '2',
            title: 'Ethereum ETF Approval Expected to Drive Market Growth',
            excerpt: 'Analysts predict significant market impact following anticipated regulatory approval for spot Ethereum ETFs in the coming months.',
            source: 'Bloomberg',
            timestamp: new Date(Date.now() - 4 * 3600000).toISOString(), // 4 hours ago
            category: 'markets',
            imageUrl: null,
            articleUrl: '#ethereum-etf',
            isFeatured: false
        },
        {
            id: '3',
            title: 'DeFi Protocol Launches Revolutionary Yield Strategy',
            excerpt: 'New decentralized finance platform introduces innovative approach to maximizing returns while minimizing risk exposure for investors.',
            source: 'The Block',
            timestamp: new Date(Date.now() - 5 * 3600000).toISOString(), // 5 hours ago
            category: 'crypto',
            imageUrl: null,
            articleUrl: '#defi-yield',
            isFeatured: false
        },
        {
            id: '4',
            title: 'SEC Announces New Framework for Digital Asset Regulation',
            excerpt: 'Regulatory body unveils comprehensive guidelines aimed at providing clarity for cryptocurrency market participants and exchanges.',
            source: 'Reuters',
            timestamp: new Date(Date.now() - 6 * 3600000).toISOString(), // 6 hours ago
            category: 'regulation',
            imageUrl: null,
            articleUrl: '#sec-framework',
            isFeatured: false
        },
        {
            id: '5',
            title: 'Layer 2 Solutions Show 300% Growth in Transaction Volume',
            excerpt: 'Scaling solutions continue to gain traction as users seek lower fees and faster transaction speeds on blockchain networks.',
            source: 'CryptoSlate',
            timestamp: new Date(Date.now() - 8 * 3600000).toISOString(), // 8 hours ago
            category: 'technology',
            imageUrl: null,
            articleUrl: '#layer2-growth',
            isFeatured: false
        },
        {
            id: '6',
            title: 'Major Exchange Launches Zero-Fee Trading for Select Pairs',
            excerpt: 'Leading cryptocurrency platform introduces competitive pricing structure to attract new traders and increase market liquidity.',
            source: 'Decrypt',
            timestamp: new Date(Date.now() - 10 * 3600000).toISOString(), // 10 hours ago
            category: 'crypto',
            imageUrl: null,
            articleUrl: '#zero-fee-trading',
            isFeatured: false
        },
        {
            id: '7',
            title: 'NFT Marketplace Sees Record Trading Volume This Quarter',
            excerpt: 'Digital collectibles continue to attract mainstream attention with major brands entering the NFT space.',
            source: 'CoinTelegraph',
            timestamp: new Date(Date.now() - 12 * 3600000).toISOString(), // 12 hours ago
            category: 'crypto',
            imageUrl: null,
            articleUrl: '#nft-volume',
            isFeatured: false
        },
        {
            id: '8',
            title: 'Global Stock Markets Rally on Positive Economic Data',
            excerpt: 'Major indices post gains as investors respond favorably to better-than-expected employment and inflation figures.',
            source: 'CNBC',
            timestamp: new Date(Date.now() - 14 * 3600000).toISOString(), // 14 hours ago
            category: 'markets',
            imageUrl: null,
            articleUrl: '#stock-rally',
            isFeatured: false
        },
        {
            id: '9',
            title: 'Central Bank Digital Currencies Gain Momentum Worldwide',
            excerpt: 'Multiple countries advance CBDC pilot programs as digital payment infrastructure evolves globally.',
            source: 'Financial Times',
            timestamp: new Date(Date.now() - 16 * 3600000).toISOString(), // 16 hours ago
            category: 'regulation',
            imageUrl: null,
            articleUrl: '#cbdc-momentum',
            isFeatured: false
        },
        {
            id: '10',
            title: 'Blockchain Technology Adoption Grows in Supply Chain Industry',
            excerpt: 'Fortune 500 companies implement distributed ledger solutions to improve transparency and efficiency.',
            source: 'Forbes',
            timestamp: new Date(Date.now() - 18 * 3600000).toISOString(), // 18 hours ago
            category: 'technology',
            imageUrl: null,
            articleUrl: '#blockchain-supply',
            isFeatured: false
        }
    ];

    // ===========================
    // State Management
    // ===========================
    const state = {
        currentCategory: 'all',
        allNews: mockNewsData,
        filteredNews: mockNewsData
    };

    // ===========================
    // DOM Elements
    // ===========================
    const elements = {
        newsGrid: document.getElementById('newsGrid'),
        newsEmpty: document.getElementById('newsEmpty'),
        newsTabs: document.querySelectorAll('.news-tab'),
        newsletterInput: document.querySelector('.newsletter-input'),
        subscribeBtn: document.querySelector('.newsletter-form .btn-gradient'),
        viewAllBtn: document.querySelector('.view-all-btn')
    };

    // ===========================
    // Initialize News Display
    // ===========================
    function initializeNews() {
        // News items are already in HTML, just add click handlers
        addNewsClickHandlers();
        console.log('%c📰 News Feed Initialized', 'font-size: 16px; font-weight: bold; color: #FDDB92;');
        console.log(`%cLoaded ${mockNewsData.length} news articles`, 'font-size: 12px; color: #00d4aa;');
    }

    // ===========================
    // Category Filter Functionality
    // ===========================
    elements.newsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const category = tab.getAttribute('data-category');
            
            // Update active state
            elements.newsTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update state
            state.currentCategory = category;
            
            // Filter news
            filterNews(category);
            
            // Add haptic feedback
            tab.style.transform = 'scale(0.95)';
            setTimeout(() => {
                tab.style.transform = '';
            }, 100);
            
            console.log(`Category filtered: ${category}`);
        });
    });

    // ===========================
    // Filter News by Category
    // ===========================
    function filterNews(category) {
        const newsItems = document.querySelectorAll('.news-item');
        let visibleCount = 0;

        newsItems.forEach((item, index) => {
            const itemCategory = item.getAttribute('data-category');
            
            if (category === 'all' || itemCategory === category) {
                item.style.display = 'flex';
                // Reset and replay animation
                item.style.animation = 'none';
                setTimeout(() => {
                    item.style.animation = `fadeInUp 0.6s ease-out ${index * 0.1}s forwards`;
                }, 10);
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });

        // Show empty state if no news found
        if (visibleCount === 0) {
            elements.newsEmpty.style.display = 'block';
            elements.newsGrid.style.display = 'none';
        } else {
            elements.newsEmpty.style.display = 'none';
            elements.newsGrid.style.display = 'grid';
        }

        // Update filtered news in state
        state.filteredNews = category === 'all' 
            ? state.allNews 
            : state.allNews.filter(news => news.category === category);
    }

    // ===========================
    // Add Click Handlers to News Items
    // ===========================
    function addNewsClickHandlers() {
        const newsLinks = document.querySelectorAll('.news-link');
        
        newsLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const newsItem = link.closest('.news-item');
                const newsTitle = newsItem.querySelector('.news-title').textContent;
                
                // Add click animation
                newsItem.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    newsItem.style.transform = '';
                }, 200);
                
                console.log(`News clicked: ${newsTitle}`);
                alert(`📰 Opening Article\n\n${newsTitle}\n\nThis would normally open the full article page.`);
            });
        });

        // Add hover effect to news items
        const newsItems = document.querySelectorAll('.news-item');
        newsItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.transition = 'all 0.3s ease';
            });
        });
    }

    // ===========================
    // Newsletter Subscription
    // ===========================
    if (elements.subscribeBtn && elements.newsletterInput) {
        elements.subscribeBtn.addEventListener('click', () => {
            const email = elements.newsletterInput.value.trim();
            
            if (email === '') {
                alert('⚠️ Please enter your email address');
                elements.newsletterInput.focus();
                return;
            }
            
            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                alert('⚠️ Please enter a valid email address');
                elements.newsletterInput.focus();
                return;
            }
            
            // Show success message
            alert(`✅ Thank you for subscribing!\n\nWe'll send daily market insights to:\n${email}`);
            elements.newsletterInput.value = '';
            
            // Add success animation
            elements.subscribeBtn.textContent = 'Subscribed! ✓';
            elements.subscribeBtn.style.background = 'linear-gradient(135deg, #00d4aa, #00f5cc)';
            
            setTimeout(() => {
                elements.subscribeBtn.textContent = 'Subscribe';
                elements.subscribeBtn.style.background = '';
            }, 3000);
            
            console.log(`Newsletter subscription: ${email}`);
        });
        
        // Allow Enter key to submit
        elements.newsletterInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                elements.subscribeBtn.click();
            }
        });

        // Input focus effect
        elements.newsletterInput.addEventListener('focus', () => {
            elements.newsletterInput.style.transform = 'scale(1.02)';
        });

        elements.newsletterInput.addEventListener('blur', () => {
            elements.newsletterInput.style.transform = 'scale(1)';
        });
    }

    // ===========================
    // View All News Button
    // ===========================
    if (elements.viewAllBtn) {
        elements.viewAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Redirecting to full news page');
            alert('📰 Redirecting to News Page...\n\nYou will see all available news articles and archives.');
            
            // In production, redirect to news page:
            // window.location.href = 'news.html';
        });
    }

    // ===========================
    // Format Time Ago Helper
    // ===========================
    function formatTimeAgo(timestamp) {
        const now = new Date();
        const past = new Date(timestamp);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        return past.toLocaleDateString();
    }

    // ===========================
    // Simulated Live Updates
    // ===========================
    function simulateLiveUpdate() {
        // Update timestamps periodically
        const timeElements = document.querySelectorAll('.news-time');
        timeElements.forEach((el, index) => {
            if (mockNewsData[index]) {
                const timeText = formatTimeAgo(mockNewsData[index].timestamp);
                const textNode = el.childNodes[el.childNodes.length - 1];
                if (textNode) {
                    textNode.textContent = timeText;
                }
            }
        });
    }

    // Update times every minute
    setInterval(simulateLiveUpdate, 60000);

    // ===========================
    // Scroll Animations
    // ===========================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe news footer
    const newsFooter = document.querySelector('.news-footer');
    if (newsFooter) {
        newsFooter.style.opacity = '0';
        newsFooter.style.transform = 'translateY(20px)';
        newsFooter.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(newsFooter);
    }

    // ===========================
    // Ripple Effect on Buttons
    // ===========================
    function createRipple(event) {
        const button = event.currentTarget;
        const circle = document.createElement('span');
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;

        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
        circle.style.top = `${event.clientY - button.offsetTop - radius}px`;
        circle.classList.add('ripple');
        circle.style.position = 'absolute';
        circle.style.borderRadius = '50%';
        circle.style.background = 'rgba(255, 255, 255, 0.5)';
        circle.style.transform = 'scale(0)';
        circle.style.animation = 'ripple 0.6s ease-out';

        const ripple = button.getElementsByClassName('ripple')[0];
        if (ripple) {
            ripple.remove();
        }

        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.appendChild(circle);

        setTimeout(() => circle.remove(), 600);
    }

    // Add ripple to all buttons
    const buttons = document.querySelectorAll('.btn, .news-tab');
    buttons.forEach(button => {
        button.addEventListener('click', createRipple);
    });

    // Add ripple animation to CSS dynamically
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // ===========================
    // Keyboard Navigation
    // ===========================
    document.addEventListener('keydown', (e) => {
        // Press 'N' to focus on news section
        if (e.key === 'n' || e.key === 'N') {
            if (!e.target.matches('input, textarea')) {
                const newsSection = document.querySelector('.news-section');
                if (newsSection) {
                    newsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        }

        // Press 'S' to focus newsletter input
        if (e.key === 's' || e.key === 'S') {
            if (!e.target.matches('input, textarea')) {
                if (elements.newsletterInput) {
                    elements.newsletterInput.focus();
                    elements.newsletterInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    });

    // ===========================
    // Export Module Functions
    // ===========================
    window.NewsWidget = {
        filterNews,
        getCurrentCategory: () => state.currentCategory,
        getNewsData: () => state.allNews,
        getFilteredNews: () => state.filteredNews,
        formatTimeAgo
    };

    // ===========================
    // Initialize Everything
    // ===========================
    initializeNews();
    
    console.log('%c✨ News Widget Ready', 'font-size: 12px; color: #a855f7;');
    console.log('%cKeyboard shortcuts: Press "N" to scroll to news, "S" to subscribe', 'font-size: 10px; color: #a0a0b8;');
});