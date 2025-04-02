document.getElementById('start-game-btn').addEventListener('click', function() {
    alert('Game Started!');
});

document.addEventListener('DOMContentLoaded', function() {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const currentTheme = localStorage.getItem('theme');

    if (currentTheme) {
        document.body.classList.add(currentTheme);
        if (currentTheme === 'dark-mode') {
            darkModeToggle.textContent = '☀️'; // Sun icon for light mode
        } else {
            darkModeToggle.textContent = '🌙'; // Moon icon for dark mode
        }
    }

    darkModeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
        let theme = 'light-mode';
        if (document.body.classList.contains('dark-mode')) {
            theme = 'dark-mode';
            darkModeToggle.textContent = '☀️'; // Sun icon for light mode
        } else {
            darkModeToggle.textContent = '🌙'; // Moon icon for dark mode
        }
        localStorage.setItem('theme', theme);
    });
});