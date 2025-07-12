document.addEventListener('DOMContentLoaded', () => {
  // UI elements
  const gameModeSelect = document.getElementById('game-mode');
  const viewCountInput = document.getElementById('view-count');
  const viewCountValue = document.getElementById('view-count-value');
  const startButton = document.getElementById('start-button');
  const modeCards = document.querySelectorAll('.mode-card');
  const resetButton = document.getElementById('reset-button');
  const gameCards = document.querySelectorAll('.game-card');

  let selectedGame = null;
  let selectedMode = null;

  function updateStartButtonState() {
    if (selectedGame && selectedMode) {
      startButton.disabled = false;
      startButton.style.display = 'block';
    } else {
      startButton.disabled = true;
      startButton.style.display = 'none';
    }
  }

  // Game card selection logic
  gameCards.forEach(card => {
    if (!card.classList.contains('coming-soon')) {
      card.addEventListener('click', () => {
        gameCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        selectedGame = card.dataset.game;
        saveAllSettings();
        updateStartButtonState();
      });
    }
  });

  // Mode card selection logic
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      modeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      gameModeSelect.value = card.dataset.mode;
      selectedMode = card.dataset.mode;
      saveAllSettings();
      updateStartButtonState();
    });
  });

  // Function to save all settings
  function saveAllSettings() {
    try {
      const allSettings = {
        gameMode: selectedMode,
        game: selectedGame,
        viewCount: parseInt(viewCountInput.value)
      };
      localStorage.setItem('userSettings', JSON.stringify(allSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  // Load saved settings on startup
  function loadSavedSettings() {
    try {
      const savedSettings = localStorage.getItem('userSettings');
      // Always start with nothing selected
      gameCards.forEach(c => c.classList.remove('active'));
      modeCards.forEach(c => c.classList.remove('active'));
      selectedGame = null;
      selectedMode = null;
      // Only restore view count if present
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.viewCount) {
          viewCountInput.value = settings.viewCount;
          viewCountValue.textContent = settings.viewCount;
        }
      }
      updateStartButtonState();
    } catch (error) {
      console.error('Error loading settings:', error);
      gameCards.forEach(c => c.classList.remove('active'));
      modeCards.forEach(c => c.classList.remove('active'));
      selectedGame = null;
      selectedMode = null;
      updateStartButtonState();
    }
  }
  
  // Add event listener for the reset button
  resetButton.addEventListener('click', () => {
    viewCountInput.value = 1;
    viewCountValue.textContent = 1;
    saveAllSettings();
  });

  // Update the view count display
  viewCountInput.addEventListener('input', () => {
    viewCountValue.textContent = viewCountInput.value;
    // Save the settings after a short delay
    clearTimeout(window.saveTimeout);
    window.saveTimeout = setTimeout(() => {
      saveAllSettings();
    }, 500);
  });
  
  // Start the session when the button is clicked
  startButton.addEventListener('click', () => {
    if (!selectedGame || !selectedMode) return;
    const config = {
      mode: selectedMode,
      game: selectedGame,
      viewCount: parseInt(viewCountInput.value)
    };
    
    // Animate the button to show the click
    startButton.classList.add('clicked');
    
    // Send config to the main process
    window.electronAPI.startSession(config);
    
    // Reset the button animation after a delay
    setTimeout(() => {
      startButton.classList.remove('clicked');
    }, 300);
  });

  // Initialize settings with saved or default values
  loadSavedSettings();
  updateStartButtonState();
}); 