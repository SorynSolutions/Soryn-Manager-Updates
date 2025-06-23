document.addEventListener('DOMContentLoaded', () => {
  // UI elements
  const syncScrollToggle = document.getElementById('sync-scroll-toggle');
  const backBtn = document.getElementById('back-btn');
  const viewCountDisplay = document.getElementById('view-count-display');
  const macroBtn = document.getElementById('macro-btn');
  const macroStatus = document.getElementById('macro-status');

  // Application state
  let syncEnabled = true;
  let macroEnabled = false;
  
  // Update the view counter when receiving information
  window.electronAPI.onUpdateViewCount((event, count) => {
    viewCountDisplay.textContent = `Views: ${count}`;
  });
  
  // Enable/disable scroll sync
  syncScrollToggle.addEventListener('click', () => {
    syncEnabled = !syncEnabled;
    
    if (syncEnabled) {
      syncScrollToggle.textContent = 'Disable Sync';
      syncScrollToggle.classList.remove('disabled');
    } else {
      syncScrollToggle.textContent = 'Enable Sync';
      syncScrollToggle.classList.add('disabled');
    }
    
    // Send the sync state to the main process
    // (this feature should be added to the preload API)
  });
  
  // Handle macro button
  macroBtn.addEventListener('click', () => {
    macroEnabled = !macroEnabled;
    
    // Update the UI
    if (macroEnabled) {
      macroBtn.classList.add('active');
      macroStatus.classList.add('active');
      macroStatus.textContent = 'ON';
    } else {
      macroBtn.classList.remove('active');
      macroStatus.classList.remove('active');
      macroStatus.textContent = 'OFF';
    }
    
    // Send the command to the main process
    window.electronAPI.toggleMacro(macroEnabled);
  });
  
  // Listen for macro status changes
  window.electronAPI.onMacroStatusChange((event, status) => {
    macroEnabled = status.enabled;
    
    // Update the UI
    if (macroEnabled) {
      macroBtn.classList.add('active');
      macroStatus.classList.add('active');
      macroStatus.textContent = 'ON';
    } else {
      macroBtn.classList.remove('active');
      macroStatus.classList.remove('active');
      macroStatus.textContent = 'OFF';
    }
  });
  
  // Return to the selection window
  backBtn.addEventListener('click', () => {
    // Close the current window - the selection window will reappear
    window.close();
  });
}); 