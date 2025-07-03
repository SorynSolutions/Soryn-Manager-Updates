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
      this.toggleRandomMovements();
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
        view.webContents.executeJavaScript(`
          (function() {
            try {
              // Press R for 100ms to reload
              window.pressKey('r');
              setTimeout(() => {
                window.releaseKey('r');
                console.log('Macro 1 executed successfully');
              }, 100);
            } catch (error) {
              console.error('Error executing macro 1:', error);
            }
          })();
        `).catch(err => console.error('Failed to execute macro1:', err));
      }
    });
  }

  /**
   * Macro 2: Abandon and Next (Escape, Tab x2, Enter)
   */
  executeAbandonNext(views) {
    views.forEach(view => {
      if (view.webContents) {
        view.webContents.executeJavaScript(`
          (function() {
            try {
              // Sequence: Escape, Tab x2, Enter
              console.log('Start of macro 2 sequence');
              window.pressKey('Escape');
              setTimeout(() => {
                window.releaseKey('Escape');
                console.log('Escape released');
                
                setTimeout(() => {
                  window.pressKey('Tab');
                  setTimeout(() => {
                    window.releaseKey('Tab');
                    console.log('First Tab released');
                    
                    setTimeout(() => {
                      window.pressKey('Tab');
                      setTimeout(() => {
                        window.releaseKey('Tab');
                        console.log('Second Tab released');
                        
                        setTimeout(() => {
                          window.pressKey('Enter');
                          setTimeout(() => {
                            window.releaseKey('Enter');
                            console.log('Enter released, sequence finished');
                          }, 100);
                        }, 200);
                      }, 100);
                    }, 200);
                  }, 100);
                }, 500);
              }, 100);
            } catch (error) {
              console.error('Error executing macro 2:', error);
            }
          })();
        `).catch(err => console.error('Failed to execute macro2:', err));
      }
    });
  }

  /**
   * Macro 3: Fullscreen (F11)
   */
  executeFullscreen(views) {
    views.forEach(view => {
      if (view.webContents) {
        view.webContents.executeJavaScript(`
          (function() {
            try {
              // F11 to toggle fullscreen
              console.log('Executing Fullscreen macro (F11)');
              window.pressKey('F11');
              setTimeout(() => {
                window.releaseKey('F11');
                console.log('F11 released, macro 3 finished');
              }, 100);
            } catch (error) {
              console.error('Error executing macro 3:', error);
            }
          })();
        `).catch(err => console.error('Failed to execute macro3:', err));
      }
    });
  }

  /**
   * Macro 4: Random Movements (Toggle)
   */
  toggleRandomMovements() {
    // Toggle the macro state
    this.randomMovementActive = !this.randomMovementActive;
    
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
      this.stopRandomMovements();
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
        const script = `
          (function() {
            try {
              const element = document.documentElement || document.body;
              
              // Simulate spacebar press
              const downEvent = document.createEvent('HTMLEvents');
              downEvent.initEvent('keydown', true, true);
              downEvent.key = ' ';
              downEvent.code = 'Space';
              downEvent.keyCode = 32;
              element.dispatchEvent(downEvent);
              
              // Release after 100ms
              setTimeout(() => {
                const upEvent = document.createEvent('HTMLEvents');
                upEvent.initEvent('keyup', true, true);
                upEvent.key = ' ';
                upEvent.code = 'Space';
                upEvent.keyCode = 32;
                element.dispatchEvent(upEvent);
              }, 100);
              
              return "Simple jump executed";
            } catch(error) {
              return "Jump error: " + error.message;
            }
          })();
        `;
        
        view.webContents.executeJavaScript(script)
          .then(result => console.log(`View ${view.viewNumber}: ${result}`))
          .catch(err => {
            console.error(`Jump error in view ${view.viewNumber}:`, err);
            // Try the direct approach in case of failure
            this.executeDirectMovement(view, [' '], 100);
          });
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
   * Utility: Get a random integer between min and max (inclusive)
   */
  getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Utility: Get a random float between min and max
   */
  getRandomFloat(min, max) {
    return Math.random() * (max - min) + min;
  }

  /**
   * Utility: Shuffle an array (Fisher-Yates)
   */
  shuffleArray(array) {
    let arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Humanized random movement (QWERTY, with random delays and durations)
   */
  executeRandomMovement() {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }

    // QWERTY directions
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
      // 1. Randomly shuffle directions and pick one
      let shuffled = this.shuffleArray(directions);
      let chosen = shuffled[0];

      // 2. Occasionally skip or repeat a key (simulate human error)
      if (Math.random() < 0.1) {
        // 10% chance to skip a movement
        chosen = [shuffled[1][0]];
      } else if (Math.random() < 0.1) {
        // 10% chance to repeat last direction
        if (this.centralMovementController.lastDirection) {
          chosen = this.centralMovementController.lastDirection;
        }
      }
      this.centralMovementController.lastDirection = chosen;

      // 3. Randomize key hold duration (300–900ms)
      const pressDuration = this.getRandomInt(300, 900);

      // 4. Execute the movement on all synchronized views
      const synchronizedViews = this.mainWindow.getAllSynchronizedViews();
      synchronizedViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          const script = `
            (function() {
              try {
                const simulateKeyEvent = (type, key) => {
                  const element = document.documentElement || document.body;
                  const event = document.createEvent('HTMLEvents');
                  event.initEvent(type, true, true);
                  event.key = key;
                  event.code = key === ' ' ? 'Space' :
                                key === 'Shift' ? 'ShiftLeft' :
                                'Key' + (key === 'w' ? 'W' :
                                          key === 'a' ? 'A' :
                                          key === 's' ? 'S' :
                                          key === 'd' ? 'D' : key.toUpperCase());
                  event.keyCode = key === ' ' ? 32 :
                                  key === 'Shift' ? 16 :
                                  key.charCodeAt(0);
                  event.shiftKey = key === 'Shift' || keys.includes('Shift');
                  element.dispatchEvent(event);
                };
                // Press the keys
                const keys = ${JSON.stringify(chosen)};
                keys.forEach(key => simulateKeyEvent('keydown', key));
                // Release after the delay
                setTimeout(() => {
                  keys.forEach(key => simulateKeyEvent('keyup', key));
                }, ${pressDuration});
                return "Humanized movement executed";
              } catch (error) {
                return "Error: " + error.message;
              }
            })();
          `;
          view.webContents.executeJavaScript(script)
            .then(result => console.log(`View ${view.viewNumber}: ${result}`))
            .catch(err => {
              console.error(`Error in view ${view.viewNumber}:`, err);
              this.executeDirectMovement(view, chosen, pressDuration);
            });
        }
      });

      // 5. Schedule the next movement with a random delay (1.2–3.5s)
      const nextDelay = this.getRandomInt(1200, 3500);
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
   * Execute a direct movement (fallback)
   */
  executeDirectMovement(view, keys, duration) {
    if (!view || !view.webContents || view.webContents.isDestroyed()) return;
    
    console.log(`Fallback: Direct execution for view ${view.viewNumber}`);
    
    try {
      // Try to inject code directly into the page
      view.webContents.insertCSS(`
        @keyframes pressed { from {opacity: 0.8;} to {opacity: 1;} }
        body:after {
          content: "Active movement";
          position: fixed;
          bottom: 10px;
          right: 10px;
          background: rgba(0,255,0,0.5);
          padding: 5px;
          z-index: 9999;
          animation: pressed 0.5s infinite alternate;
        }
      `).then(() => {
        // Simulate a click in the center to activate focus
        const bounds = view.getBounds();
        view.webContents.sendInputEvent({
          type: 'mouseDown',
          x: Math.floor(bounds.width / 2),
          y: Math.floor(bounds.height / 2),
          button: 'left',
          clickCount: 1
        });
        
        setTimeout(() => {
          view.webContents.sendInputEvent({
            type: 'mouseUp',
            x: Math.floor(bounds.width / 2),
            y: Math.floor(bounds.height / 2),
            button: 'left',
            clickCount: 1
          });
          
          // AZERTY mapping for fallback
          const keyMapping = {
            'z': 'w',
            'q': 'a',
            's': 's',
            'd': 'd',
            'Shift': 'Shift'
          };
          
          // Send keyboard events directly via IPC
          keys.forEach(key => {
            const mappedKey = keyMapping[key] || key;
            this.mainWindow.mainWebContents.send('simulate-keypress', {
              viewId: view.viewNumber,
              key: mappedKey,
              state: 'down'
            });
          });
          
          setTimeout(() => {
            keys.forEach(key => {
              const mappedKey = keyMapping[key] || key;
              this.mainWindow.mainWebContents.send('simulate-keypress', {
                viewId: view.viewNumber,
                key: mappedKey,
                state: 'up'
              });
            });
          }, duration);
        }, 100);
      }).catch(err => console.error('CSS injection error:', err));
    } catch (error) {
      console.error(`Error during direct movement (view ${view.viewNumber}):`, error);
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
        view.webContents.executeJavaScript(`
          (function() {
            try {
              console.log('Auto Drop: Pressing Space (host)');
              window.pressKey(' ');
              setTimeout(() => {
                window.releaseKey(' ');
                console.log('Auto Drop: Released Space (host)');
              }, 100);
              return "Auto Drop executed on host";
            } catch (error) {
              console.error('Error executing Auto Drop on host:', error);
              return "Error: " + error.message;
            }
          })();
        `).catch(err => console.error('Failed to execute Auto Drop on host:', err));
      }
    });
    
    // After 0.9 seconds (900ms), execute Space on players
    setTimeout(() => {
      playerViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(`
            (function() {
              try {
                console.log('Auto Drop: Pressing Space (player)');
                window.pressKey(' ');
                setTimeout(() => {
                  window.releaseKey(' ');
                  console.log('Auto Drop: Released Space (player)');
                }, 100);
                return "Auto Drop executed on player";
              } catch (error) {
                console.error('Error executing Auto Drop on player:', error);
                return "Error: " + error.message;
              }
            })();
          `).catch(err => console.error('Failed to execute Auto Drop on player:', err));
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
            if (view.webContents && !view.webContents.isDestroyed()) {
              view.webContents.executeJavaScript(`
                (function() {
                  try {
                    console.log('AFK Host: Pressing ${currentKey}');
                    window.pressKey('${currentKey}');
                    setTimeout(() => {
                      window.releaseKey('${currentKey}');
                      console.log('AFK Host: Released ${currentKey}');
                    }, 1500); // Increased from 1000ms to 1500ms hold
                    return "AFK Host: movement executed on key ${currentKey}";
                  } catch (error) {
                    console.error('Error executing AFK Host:', error);
                    return "Error: " + error.message;
                  }
                })();
              `).catch(err => console.error(`Failed to execute AFK Host movement for key ${currentKey}:`, err));
            }
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
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(`
            (function() {
              try {
                // Release all possible keys
                ['z', 'q', 's', 'd'].forEach(key => {
                  window.releaseKey(key);
                });
                console.log('AFK Host: All keys released');
                return "AFK Host: stopped";
              } catch (error) {
                console.error('Error stopping AFK Host:', error);
                return "Error: " + error.message;
              }
            })();
          `).catch(err => console.error('Failed to stop AFK Host:', err));
        }
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
              if (view.webContents && !view.webContents.isDestroyed()) {
                view.webContents.executeJavaScript(`
                  (function() {
                    try {
                      console.log('AFK Player Replay: Pressing ${currentKey}');
                      window.pressKey('${currentKey}');
                      setTimeout(() => {
                        window.releaseKey('${currentKey}');
                        console.log('AFK Player Replay: Released ${currentKey}');
                      }, 1100); // Increased from 600ms to 1100ms hold
                      return "AFK Player Replay: movement executed on key ${currentKey}";
                    } catch (error) {
                      console.error('Error executing AFK Player Replay:', error);
                      return "Error: " + error.message;
                    }
                  })();
                `).catch(err => console.error(`Failed to execute AFK Player replay movement for key ${currentKey}:`, err));
              }
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
            if (view.webContents && !view.webContents.isDestroyed()) {
              view.webContents.executeJavaScript(`
                (function() {
                  try {
                    console.log('AFK Player: Pressing ${randomKey}');
                    window.pressKey('${randomKey}');
                    setTimeout(() => {
                      window.releaseKey('${randomKey}');
                      console.log('AFK Player: Released ${randomKey}');
                    }, 1100); // Increased from 600ms to 1100ms hold
                    return "AFK Player: movement executed on key ${randomKey}";
                  } catch (error) {
                    console.error('Error executing AFK Player:', error);
                    return "Error: " + error.message;
                  }
                })();
              `).catch(err => console.error(`Failed to execute AFK Player movement for key ${randomKey}:`, err));
            }
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
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(`
            (function() {
              try {
                // Release all possible keys
                ['z', 'q', 's', 'd'].forEach(key => {
                  window.releaseKey(key);
                });
                console.log('AFK Player: All keys released');
                return "AFK Player: stopped";
              } catch (error) {
                console.error('Error stopping AFK Player:', error);
                return "Error: " + error.message;
              }
            })();
          `).catch(err => console.error('Failed to stop AFK Player:', err));
        }
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
              
              view.webContents.executeJavaScript(`
                (function() {
                  try {
                    console.log('AFK Host+Player: Pressing V (player)');
                    window.pressKey('v');
                    setTimeout(() => {
                      window.releaseKey('v');
                      console.log('AFK Host+Player: Released V (player)');
                    }, 600); // Increased from 100ms to 600ms hold
                    return "AFK Host+Player: V press executed";
                  } catch (error) {
                    console.error('Error executing V press:', error);
                    return "Error: " + error.message;
                  }
                })();
              `).catch(err => console.error('Failed to execute V key press on player:', err));
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
              if (view.webContents && !view.webContents.isDestroyed()) {
                view.webContents.executeJavaScript(`
                  (function() {
                    try {
                      console.log('AFK Host and Player: Pressing ${currentKey}');
                      window.pressKey('${currentKey}');
                      setTimeout(() => {
                        window.releaseKey('${currentKey}');
                        console.log('AFK Host and Player: Released ${currentKey}');
                      }, 1500); // Increased from 1000ms to 1500ms hold
                      return "AFK Host and Player: movement executed on key ${currentKey}";
                    } catch (error) {
                      console.error('Error executing AFK Host and Player:', error);
                      return "Error: " + error.message;
                    }
                  })();
                `).catch(err => console.error(`Failed to execute AFK Host and Player movement for key ${currentKey}:`, err));
              }
            });
            
            playerViews.forEach(view => {
              if (view.webContents && !view.webContents.isDestroyed()) {
                view.webContents.executeJavaScript(`
                  (function() {
                    try {
                      console.log('AFK Host and Player: Pressing ${currentKey}');
                      window.pressKey('${currentKey}');
                      setTimeout(() => {
                        window.releaseKey('${currentKey}');
                        console.log('AFK Host and Player: Released ${currentKey}');
                      }, 1500); // Increased from 1000ms to 1500ms hold
                      return "AFK Host and Player: movement executed on key ${currentKey}";
                    } catch (error) {
                      console.error('Error executing AFK Host and Player:', error);
                      return "Error: " + error.message;
                    }
                  })();
                `).catch(err => console.error(`Failed to execute AFK Host and Player movement for key ${currentKey}:`, err));
              }
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
            if (view.webContents && !view.webContents.isDestroyed()) {
              view.webContents.executeJavaScript(`
                (function() {
                  try {
                    // Release all possible keys
                    ['z', 'q', 's', 'd', 'v'].forEach(key => {
                      window.releaseKey(key);
                    });
                    return "AFK Host and Player: keys released for complete restart";
                  } catch (error) {
                    console.error('Error releasing keys:', error);
                    return "Error: " + error.message;
                  }
                })();
              `).catch(err => console.error('Failed to release keys:', err));
            }
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
          if (view.webContents && !view.webContents.isDestroyed()) {
            view.webContents.executeJavaScript(`
              (function() {
                try {
                  // Release all possible keys
                  ['z', 'q', 's', 'd', 'v'].forEach(key => {
                    window.releaseKey(key);
                  });
                  return "AFK Host and Player: keys released for restart";
                } catch (error) {
                  console.error('Error releasing keys:', error);
                  return "Error: " + error.message;
                }
              })();
            `).catch(err => console.error('Failed to release keys:', err));
          }
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
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(`
            (function() {
              try {
                // Release all possible keys
                ['z', 'q', 's', 'd', 'v'].forEach(key => {
                  window.releaseKey(key);
                });
                console.log('AFK Host and Player: All keys released');
                return "AFK Host and Player: stopped";
              } catch (error) {
                console.error('Error stopping AFK Host and Player:', error);
                return "Error: " + error.message;
              }
            })();
          `).catch(err => console.error('Failed to stop AFK Host and Player:', err));
        }
      });
    }
  }
}

module.exports = MacroManager; 