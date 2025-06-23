document.addEventListener('DOMContentLoaded', () => {
  // UI elements
  const gameModeSelect = document.getElementById('game-mode');
  const viewCountInput = document.getElementById('view-count');
  const viewCountValue = document.getElementById('view-count-value');
  const startButton = document.getElementById('start-button');
  const modeCards = document.querySelectorAll('.mode-card');
  const resetButton = document.getElementById('reset-button');

  // Function to save all settings
  function saveAllSettings() {
    try {
      const allSettings = {
        gameMode: gameModeSelect.value,
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
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        
        // Apply saved view count
        if (settings.viewCount) {
          viewCountInput.value = settings.viewCount;
          viewCountValue.textContent = settings.viewCount;
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }
  
  // Add event listener for the reset button
  resetButton.addEventListener('click', () => {
    viewCountInput.value = 1;
    viewCountValue.textContent = 1;
    saveAllSettings();
  });

  // Add event handlers for the cards
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      // Remove the active class from all cards
      modeCards.forEach(c => c.classList.remove('active'));
      // Add the active class to the clicked card
      card.classList.add('active');
      // Update the select value
      gameModeSelect.value = card.dataset.mode;
      // Show the start button
      startButton.style.display = 'block';
      // Save the settings
      saveAllSettings();
    });
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
    const config = {
      mode: gameModeSelect.value,
      viewCount: parseInt(viewCountInput.value)
    };
    
    // Animate the button to show the click
    startButton.classList.add('clicked');
    
    // Send only the basic config to the main process
    window.electronAPI.startSession(config);
    
    // Reset the button animation after a delay
    setTimeout(() => {
      startButton.classList.remove('clicked');
    }, 300);
  });

  // Initialize settings with saved or default values
  loadSavedSettings();
}); 