/**
 * Macro management module for the application
 * Contains all available macros and management methods
 */

class MacroManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.randomMovementActive = false;
    this.centralMovementController = {
      isRunning: false,
      currentSequence: [],
      currentIndex: 0,
      lastDirection: null,
      recentMoves: [],
      timeoutIds: []
    };
    this.randomMovementTimeouts = [];
    this.randomMovementIntervalId = null;
    this.afkHostActive = false;
    this.afkHostTimeoutId = null;
    this.afkPlayerActive = false;
    this.afkPlayerTimeoutId = null;
    this.vKeyPressIntervalIds = [];
    this.mouseClickIntervalIds = [];
  }

  /**
   * Execute macros based on ID and game mode
   */
  executeMacro(macroId, gameMode) {
    if (!this.mainWindow) return;
    console.log(`Executing macro ${macroId} for mode ${gameMode}`);

    // Check if it's macro10 (sync panel)
    if (macroId === 'macro10') {
      this.mainWindow.openSyncPanel();
      return;
    }
    
    // Check if it's macro11 (macro panel)
    if (macroId === 'macro11') {
      this.mainWindow.openMacroPanel();
      return;
    }

    // For centralized movement macros that must run globally
    if (macroId === 'macro4') {
      this.toggleRandomMovements(true);
      return;
    }

    // For other macros, use synchronized views that are valid, visible or not
    // Collect all synchronized views (feature)
    const synchronizedViews = this.mainWindow.getAllSynchronizedViews();
    
    // If no view is synchronized, use all valid (not destroyed) views
    let targetViews = synchronizedViews.length > 0 
      ? synchronizedViews 
      : this.mainWindow.views.filter(view => view && view.webContents && !view.webContents.isDestroyed());
    
    console.log(`Executing macro ${macroId} on ${targetViews.length} views (synchronized: ${synchronizedViews.length > 0})`);

    // If after all there are no valid views, do nothing
    if (targetViews.length === 0) {
      console.warn("No valid view found to execute the macro.");
      return;
    }

    // Execute the appropriate macro on the target views
    switch (macroId) {
      case 'macro1':
        this.executeMultiSearch(targetViews);
        break;
      case 'macro2':
        this.executeAbandonNext(targetViews);
        break;
      case 'macro3':
        this.executeFullscreen(targetViews);
        break;
      case 'macro5':
        this.executeAutoDrop(targetViews);
        break;
      case 'macro6':
        this.toggleAfkHost(targetViews);
        break;
      case 'macro7':
        this.toggleAfkPlayer(targetViews);
        break;
      case 'macro8':
        this.toggleAfkHostAndPlayer(targetViews);
        break;
      default:
        console.log('Unrecognized macro:', macroId);
    }
  }

  /**
   * Macro 1: Multi-Search (Press R)
   */
  executeMultiSearch(views) {
    views.forEach(view => {
      if (view.webContents) {
        this.executeDirectMovementScript(view, 'r', 'press');
        setTimeout(() => {
          this.executeDirectMovementScript(view, 'r', 'release');
        }, 100);
      }
    });
  }

  /**
   * Macro 2: Abandon and Next (Escape, Tab x2, Enter)
   */
  executeAbandonNext(views) {
    views.forEach(view => {
      if (view.webContents) {
        this.executeDirectMovementScript(view, 'Escape', 'press');
        setTimeout(() => {
          this.executeDirectMovementScript(view, 'Escape', 'release');
          setTimeout(() => {
            this.executeDirectMovementScript(view, 'Tab', 'press');
            setTimeout(() => {
              this.executeDirectMovementScript(view, 'Tab', 'release');
              setTimeout(() => {
                this.executeDirectMovementScript(view, 'Tab', 'press');
                setTimeout(() => {
                  this.executeDirectMovementScript(view, 'Tab', 'release');
                  setTimeout(() => {
                    this.executeDirectMovementScript(view, 'Enter', 'press');
                    setTimeout(() => {
                      this.executeDirectMovementScript(view, 'Enter', 'release');
                    }, 100);
                  }, 200);
                }, 100);
              }, 200);
            }, 100);
          }, 500);
        }, 100);
      }
    });
  }

  /**
   * Macro 3: Fullscreen (F11)
   */
  executeFullscreen(views) {
    views.forEach(view => {
      if (view.webContents) {
        this.executeDirectMovementScript(view, 'F11', 'press');
        setTimeout(() => {
          this.executeDirectMovementScript(view, 'F11', 'release');
        }, 100);
      }
    });
  }

  /**
   * Macro 4: Random Movements (Toggle)
   */
  toggleRandomMovements(enable) {
    // Set the macro state based on the enable flag
    this.randomMovementActive = enable;
    
    // Update the visual status in the control bar
    this.mainWindow.updateControlBarMacroStatus(4, this.randomMovementActive);
    
    if (this.randomMovementActive) {
      console.log('Starting synchronized random movements');
      
      // Get all synchronized views
      const synchronizedViews = this.mainWindow.getAllSynchronizedViews();
      
      if (synchronizedViews.length === 0) {
        console.log('No synchronized view available - select views in the sync panel');
        // Reset state if no synchronized view
        this.randomMovementActive = false;
        this.mainWindow.updateControlBarMacroStatus(4, false);
        
        // Automatically open the sync panel if no view is synchronized
        this.mainWindow.openSyncPanel();
        return;
      }
      
      console.log(`Executing movements on ${synchronizedViews.length} synchronized views`);
      
      // Initialize the central controller
      this.centralMovementController = {
        isRunning: true,
        currentSequence: [],
        currentIndex: 0,
        lastDirection: null,
        recentMoves: [],
        timeoutIds: []
      };
      
      // Start the movement sequence
      this.startCentralMovementSequence();
    } else {
      console.log('Stopping random movements');
      this.stopAllSynchronizedMovements();
    }
  }

  /**
   * Stop all random movements
   */
  stopRandomMovements() {
    console.log('Stopping random movements');
    
    // Disable the macro flag
    this.randomMovementActive = false;
    
    // Stop all synchronized movements
    this.stopAllSynchronizedMovements();
    
    console.log('All random movements have been successfully stopped');
  }

  /**
   * Stop all synchronized movements
   */
  stopAllSynchronizedMovements() {
    console.log('Stopping all synchronized movements');
    
    // Stop the central controller
    this.centralMovementController.isRunning = false;
    
    // Clean up all central timeouts
    if (this.centralMovementController.timeoutIds.length > 0) {
      this.centralMovementController.timeoutIds.forEach(id => clearTimeout(id));
      this.centralMovementController.timeoutIds = [];
    }
    
    // Clean up other timeouts and intervals
    if (this.randomMovementTimeouts && this.randomMovementTimeouts.length > 0) {
      this.randomMovementTimeouts.forEach(id => clearTimeout(id));
      this.randomMovementTimeouts = [];
    }
    
    if (this.randomMovementIntervalId) {
      clearInterval(this.randomMovementIntervalId);
      this.randomMovementIntervalId = null;
    }
    
    // Reset the controller state
    this.centralMovementController.currentIndex = 0;
    this.centralMovementController.currentSequence = [];
    
    // Release all keys in each view
    this.mainWindow.views.forEach(view => this.mainWindow.releaseAllKeysInView(view));

    // Update the control bar
    this.mainWindow.updateControlBarMacroStatus(4, false);
  }

  /**
   * Start the central movement sequence
   */
  startCentralMovementSequence() {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    console.log('Starting central movement sequence');
    
    // Reset the controller state
    this.centralMovementController.currentIndex = 0;
    this.centralMovementController.lastDirection = null;
    this.centralMovementController.recentMoves = [];
    
    // Start with 3 jumps
    this.executeJumpSequence(0);
  }

  /**
   * Execute the initial jump sequence
   */
  executeJumpSequence(jumpIndex) {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    console.log(`Executing jump ${jumpIndex+1}/3`);
    
    // Get all synchronized views
    const synchronizedViews = this.mainWindow.getAllSynchronizedViews();
    
    // Execute the jump on all views with a simplified approach
    synchronizedViews.forEach(view => {
      if (view.webContents && !view.webContents.isDestroyed()) {
        this.executeDirectMovementScript(view, ' ', 'press');
        setTimeout(() => {
          this.executeDirectMovementScript(view, ' ', 'release');
        }, 100);
      }
    });
    
    // Continue with the next jump or move to movements
    if (jumpIndex < 2) {
      // Wait 200ms before the next jump
      const nextJumpId = setTimeout(() => {
        this.executeJumpSequence(jumpIndex + 1);
      }, 200);
      
      this.centralMovementController.timeoutIds.push(nextJumpId);
    } else {
      // Move to random movements after 3 jumps
      const startMovementsId = setTimeout(() => {
        this.executeRandomMovement();
      }, 800);
      
      this.centralMovementController.timeoutIds.push(startMovementsId);
    }
  }

  /**
   * Execute a random movement
   */
  executeRandomMovement() {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    // Possible directions (in QWERTY: WASD)
    const directions = [
      ['w'],      // Forward
      ['a'],      // Left
      ['s'],      // Backward
      ['d'],      // Right
      ['w', 'a'], // Diagonal forward-left
      ['w', 'd'], // Diagonal forward-right
      ['s', 'a'], // Diagonal backward-left
      ['s', 'd']  // Diagonal backward-right
    ];
    
    try {
      // 1. Choose a direction randomly
      let chosen = directions[Math.floor(Math.random() * directions.length)];
      
      // 2. Reduce the probability of replacing 'w' with 's' to only 20%
      if (chosen.includes('w') && !chosen.includes('s') && Math.random() < 0.2) {
        chosen = ['s'];
      }
      
      // Use QWERTY keys directly
      const mappedKeys = chosen;
      
      // Determine the movement duration (between 500ms and 1750ms)
      const pressDuration = 500 + Math.random() * 1250;
      
      // Execute the movement on all synchronized views
      console.log(`Executing movement: ${mappedKeys.join('+')} for ${pressDuration}ms`);
      
      const synchronizedViews = this.mainWindow.getAllSynchronizedViews();
      
      synchronizedViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          mappedKeys.forEach(key => {
            this.executeDirectMovementScript(view, key, 'press');
          });

          setTimeout(() => {
            mappedKeys.forEach(key => {
              this.executeDirectMovementScript(view, key, 'release');
            });
          }, pressDuration);
        }
      });
      
      // Schedule the next movement with a random delay
      const nextDelay = pressDuration + 1000 + Math.random() * 1250;
      
      const nextMovementId = setTimeout(() => {
        this.executeRandomMovement();
      }, nextDelay);
      
      this.centralMovementController.timeoutIds.push(nextMovementId);
      
    } catch (error) {
      console.error('Error in central random movement:', error);
      
      // In case of error, try to continue after a delay
      const errorRecoveryId = setTimeout(() => {
        this.executeRandomMovement();
      }, 2000);
      
      this.centralMovementController.timeoutIds.push(errorRecoveryId);
    }
  }

  /**
   * Macro 5: Auto Drop (Space on Hosts then Players)
   */
  executeAutoDrop(views) {
    if (!views || views.length === 0) return;
    
    console.log('Executing Auto Drop macro');
    
    // Separate views into hosts and players
    const hostViews = views.filter(view => view.viewType === 'host');
    const playerViews = views.filter(view => view.viewType === 'player');
    
    // Execute Space on hosts first
    hostViews.forEach(view => {
      if (view.webContents && !view.webContents.isDestroyed()) {
        this.executeDirectMovementScript(view, ' ', 'press');
        setTimeout(() => {
          this.executeDirectMovementScript(view, ' ', 'release');
        }, 100);
      }
    });
    
    // After 0.9 seconds (900ms), execute Space on players
    setTimeout(() => {
      playerViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          this.executeDirectMovementScript(view, ' ', 'press');
          setTimeout(() => {
            this.executeDirectMovementScript(view, ' ', 'release');
          }, 100);
        }
      });
    }, 900);
  }

  /**
   * Macro 6: AFK Host (Movement on Hosts)
   * Executes a sequence of ZQSD keys in order then DSQZ in reverse order
   * Each key is held for 1 second with a 2 second pause between each key
   */
  toggleAfkHost(views) {
    if (!views || views.length === 0) return;
    
    console.log('Toggling AFK Host macro');
    
    // Identify hosts
    const hostViews = views.filter(view => view.viewType === 'host');
    
    if (hostViews.length === 0) {
      console.log('No visible host to execute AFK Host macro');
      return;
    }
    
    // Check if the macro is already active
    this.afkHostActive = !this.afkHostActive;
    
    // Update the visual status
    this.mainWindow.updateControlBarMacroStatus(6, this.afkHostActive);
    
    if (this.afkHostActive) {
      console.log('Starting AFK movements on hosts');
      
      // Function to execute the key sequence
      const executeAfkMovement = () => {
        if (!this.afkHostActive) return;
        
        // Key sequence in order then in reverse
        const forwardKeys = ['z', 'q', 's', 'd'];
        const reverseKeys = ['d', 's', 'q', 'z'];
        const allKeys = [...forwardKeys, ...reverseKeys];
        
        const executeKeySequence = (keyIndex) => {
          if (keyIndex >= allKeys.length || !this.afkHostActive) return;
          
          const currentKey = allKeys[keyIndex];
          
          hostViews.forEach(view => {
            this.executeDirectMovementScript(view, currentKey, 'press');
            setTimeout(() => {
              this.executeDirectMovementScript(view, currentKey, 'release');
            }, 1500); // Increased from 1000ms to 1500ms hold
          });
          
          // Move to the next key after 1.6 seconds (reduced delay between keys)
          setTimeout(() => {
            executeKeySequence(keyIndex + 1);
          }, 1600);
        };
        
        // Start the key sequence
        executeKeySequence(0);
        
        // Schedule the next full sequence
        if (this.afkHostActive) {
          this.afkHostTimeoutId = setTimeout(executeAfkMovement, 1600);
        }
      };
      
      // Start the movements
      executeAfkMovement();
    } else {
      console.log('Stopping AFK movements on hosts');
      
      // Stop timeouts
      if (this.afkHostTimeoutId) {
        clearTimeout(this.afkHostTimeoutId);
        this.afkHostTimeoutId = null;
      }
      
      // Release all keys in host views
      hostViews.forEach(view => {
        ['z', 'q', 's', 'd'].forEach(key => {
          this.executeDirectMovementScript(view, key, 'release');
        });
      });
    }
  }

  /**
   * Macro 7: AFK Player (Movement on Players)
   * Executes random ZQSD keys for 0.6 seconds every 1 second
   * Records the last 4 movements and replays them in reverse order
   */
  toggleAfkPlayer(views) {
    if (!views || views.length === 0) return;
    
    console.log('Toggling AFK Player macro');
    
    // Identify players
    const playerViews = views.filter(view => view.viewType === 'player');
    
    if (playerViews.length === 0) {
      console.log('No visible player to execute AFK Player macro');
      return;
    }
    
    // Check if the macro is already active
    this.afkPlayerActive = !this.afkPlayerActive;
    
    // Update the visual status
    this.mainWindow.updateControlBarMacroStatus(7, this.afkPlayerActive);
    
    if (this.afkPlayerActive) {
      console.log('Starting AFK movements on players');
      
      // Initialize the array to record last moves
      let lastMoves = [];
      let isReplayingMoves = false;
      
      // Function to execute a movement
      const executeAfkMovement = () => {
        if (!this.afkPlayerActive) return;
        
        // Possible keys
        const possibleKeys = ['z', 'q', 's', 'd'];
        
        // If in replay mode, use recorded moves in reverse order
        if (isReplayingMoves && lastMoves.length > 0) {
          // Take moves in reverse order
          const movesToReplay = [...lastMoves].reverse();
          console.log('Replaying moves in reverse order:', movesToReplay);
          
          const replayMove = (index) => {
            if (index >= movesToReplay.length || !this.afkPlayerActive) {
              // End replay and return to normal mode
              isReplayingMoves = false;
              setTimeout(executeAfkMovement, 800); // Reduced delay between moves
              return;
            }
            
            const currentKey = movesToReplay[index];
            
            playerViews.forEach(view => {
              this.executeDirectMovementScript(view, currentKey, 'press');
              setTimeout(() => {
                this.executeDirectMovementScript(view, currentKey, 'release');
              }, 1100); // Increased from 600ms to 1100ms hold
            });
            
            // Move to the next move after 1.2 seconds (reduced delay between moves)
            setTimeout(() => {
              replayMove(index + 1);
            }, 1200);
          };
          
          // Start replaying moves
          replayMove(0);
          
        } else {
          // Normal mode: select a random key
          const randomKey = possibleKeys[Math.floor(Math.random() * possibleKeys.length)];
          
          // Record this move
          lastMoves.push(randomKey);
          // Keep only the last 4 moves
          if (lastMoves.length > 4) {
            lastMoves.shift();
          }
          
          console.log('AFK Player: Executing key', randomKey, '- Recorded moves:', lastMoves);
          
          playerViews.forEach(view => {
            this.executeDirectMovementScript(view, randomKey, 'press');
            setTimeout(() => {
              this.executeDirectMovementScript(view, randomKey, 'release');
            }, 1100); // Increased from 600ms to 1100ms hold
          });
          
          // If we have recorded 4 moves, switch to replay mode for the next cycle
          if (lastMoves.length === 4 && !isReplayingMoves) {
            isReplayingMoves = true;
          }
          
          // Schedule the next move after 1.2 seconds (reduced delay between moves)
          this.afkPlayerTimeoutId = setTimeout(executeAfkMovement, 1200);
        }
      };
      
      // Start the movements
      executeAfkMovement();
    } else {
      console.log('Stopping AFK movements on players');
      
      // Stop timeouts
      if (this.afkPlayerTimeoutId) {
        clearTimeout(this.afkPlayerTimeoutId);
        this.afkPlayerTimeoutId = null;
      }
      
      // Release all keys in player views
      playerViews.forEach(view => {
        ['z', 'q', 's', 'd'].forEach(key => {
          this.executeDirectMovementScript(view, key, 'release');
        });
      });
    }
  }

  /**
   * Macro 8: AFK Host and Player (Movement on Hosts and Players)
   * Executes a sequence of touches ZQSD in order then DSQZ in reverse order
   * Each touch is held for 1 second with a pause of 2 seconds between each touch
   * Press V every 3 seconds on players and automatically restarts every 60 seconds
   */
  toggleAfkHostAndPlayer(views) {
    if (!views || views.length === 0) return;
    
    console.log('Toggle de la macro AFK Host and Player');
    
    // Identify hosts and players
    const hostViews = views.filter(view => view.viewType === 'host');
    const playerViews = views.filter(view => view.viewType === 'player');
    
    if (hostViews.length === 0 && playerViews.length === 0) {
      console.log('Aucun host ou player visible pour exécuter la macro AFK Host and Player');
      return;
    }
    
    // Check if the macro is already active
    this.afkHostActive = !this.afkHostActive;
    this.afkPlayerActive = !this.afkPlayerActive;
    
    // Update the visual status
    this.mainWindow.updateControlBarMacroStatus(8, this.afkHostActive && this.afkPlayerActive);
    
    if (this.afkHostActive && this.afkPlayerActive) {
      console.log('Starting AFK movements on hosts and players');
      
      // Store interval IDs for later cleanup
      this.vKeyPressIntervalIds = [];
      this.autoCompleteRestartId = null;
      
      // Function to start macro functionality
      const startAfkFunctionality = () => {
        // Clean up existing intervals to avoid duplicates during restart
        this.cleanupIntervals();
        
        // Start periodic press on V key only for players
        playerViews.forEach(view => {
          if (view.webContents && !view.webContents.isDestroyed()) {
            const intervalId = setInterval(() => {
              if (!this.afkHostActive || !this.afkPlayerActive) return;
              
              this.executeDirectMovementScript(view, 'v', 'press');
              setTimeout(() => {
                this.executeDirectMovementScript(view, 'v', 'release');
              }, 600); // Increased from 100ms to 600ms hold
            }, 2000); // Reduced from 3000ms to 2000ms interval
            
            this.vKeyPressIntervalIds.push(intervalId);
          }
        });
        
        // Function to execute key sequence
        const executeAfkMovement = () => {
          if (!this.afkHostActive || !this.afkPlayerActive) return;
          
          // Key sequence in order then in reverse
          const forwardKeys = ['z', 'q', 's', 'd'];
          const reverseKeys = ['d', 's', 'q', 'z'];
          const allKeys = [...forwardKeys, ...reverseKeys];
          
          const executeKeySequence = (keyIndex) => {
            if (keyIndex >= allKeys.length || !this.afkHostActive || !this.afkPlayerActive) return;
            
            const currentKey = allKeys[keyIndex];
            
            hostViews.forEach(view => {
              this.executeDirectMovementScript(view, currentKey, 'press');
              setTimeout(() => {
                this.executeDirectMovementScript(view, currentKey, 'release');
              }, 1500); // Increased from 1000ms to 1500ms hold
            });
            
            playerViews.forEach(view => {
              this.executeDirectMovementScript(view, currentKey, 'press');
              setTimeout(() => {
                this.executeDirectMovementScript(view, currentKey, 'release');
              }, 1500); // Increased from 1000ms to 1500ms hold
            });
            
            // Move to the next key after 1.6 seconds (reduced delay between keys)
            setTimeout(() => {
              executeKeySequence(keyIndex + 1);
            }, 1600);
          };
          
          // Start key sequence
          executeKeySequence(0);
          
          // Schedule the next full sequence
          if (this.afkHostActive && this.afkPlayerActive) {
            this.afkHostTimeoutId = setTimeout(executeAfkMovement, 1600); // Reduced from 3000ms
          }
        };
        
        // Start the movements
        executeAfkMovement();
      };
      
      // Configure complete automatic restart every 60 seconds
      this.autoCompleteRestartId = setInterval(() => {
        if (this.afkHostActive && this.afkPlayerActive) {
          console.log('Complete automatic restart of AFK Host+Player macro (every 60 seconds)');
          
          // Stop all intervals and timers
          this.cleanupIntervals();
          
          // Reset flags to simulate complete deactivation
          const wasActive = this.afkHostActive && this.afkPlayerActive;
          this.afkHostActive = false;
          this.afkPlayerActive = false;
          
          // Release all keys in host and player views
          const allViews = [...hostViews, ...playerViews];
          allViews.forEach(view => {
            ['z', 'q', 's', 'd', 'v'].forEach(key => {
              this.executeDirectMovementScript(view, key, 'release');
            });
          });
          
          // Simulate complete restart after a short pause
          setTimeout(() => {
            if (wasActive) {
              // Reactivate flags
              this.afkHostActive = true;
              this.afkPlayerActive = true;
              
              // Update the visual status
              this.mainWindow.updateControlBarMacroStatus(8, true);
              
              console.log('Complete restart of AFK Host+Player macro');
              
              // Restart all functionality
              startAfkFunctionality();
            }
          }, 500); // Short pause to simulate user click
        }
      }, 60000); // Complete restart every 60 seconds
      
      // Method to clean up existing intervals and timeouts
      this.cleanupIntervals = () => {
        // Stop timeouts
        if (this.afkHostTimeoutId) {
          clearTimeout(this.afkHostTimeoutId);
          this.afkHostTimeoutId = null;
        }
        
        // Stop all V press intervals
        if (this.vKeyPressIntervalIds && this.vKeyPressIntervalIds.length > 0) {
          this.vKeyPressIntervalIds.forEach(intervalId => clearInterval(intervalId));
          this.vKeyPressIntervalIds = [];
        }
        
        // Release all keys in host and player views
        const allViews = [...hostViews, ...playerViews];
        allViews.forEach(view => {
          ['z', 'q', 's', 'd', 'v'].forEach(key => {
            this.executeDirectMovementScript(view, key, 'release');
          });
        });
      };
      
      // Start AFK functionality
      startAfkFunctionality();
      
    } else {
      console.log('Stopping AFK movements on hosts and players');
      
      // Stop timeouts
      if (this.afkHostTimeoutId) {
        clearTimeout(this.afkHostTimeoutId);
        this.afkHostTimeoutId = null;
      }
      
      // Stop complete automatic restart interval
      if (this.autoCompleteRestartId) {
        clearInterval(this.autoCompleteRestartId);
        this.autoCompleteRestartId = null;
      }
      
      // Stop all V press intervals
      if (this.vKeyPressIntervalIds && this.vKeyPressIntervalIds.length > 0) {
        this.vKeyPressIntervalIds.forEach(intervalId => clearInterval(intervalId));
        this.vKeyPressIntervalIds = [];
      }
      
      // Release all keys in host and player views
      const allViews = [...hostViews, ...playerViews];
      allViews.forEach(view => {
        ['z', 'q', 's', 'd', 'v'].forEach(key => {
          this.executeDirectMovementScript(view, key, 'release');
        });
      });
    }
  }

  executeDirectMovementScript(view, key, action) {
    const type = action === 'press' ? 'keyDown' : 'keyUp';
    
    let keyCode = key;
    if (key === ' ') {
      keyCode = 'Space';
    }
    
    if (view && view.webContents && !view.webContents.isDestroyed()) {
      view.webContents.focus();
      view.webContents.sendInputEvent({ type, keyCode });
    }
  }
}

module.exports = MacroManager; 