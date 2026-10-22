/**
 * ============================================================================
 * Operating Systems Project: Semaphore Implementation & Process Synchronization
 * File: simulator.js
 * Description: Real wait()/signal() logic with FIFO queue data structures,
 *              Process State Machine, Race Condition simulation,
 *              and Producer-Consumer Bounded Buffer model.
 * ============================================================================
 */

// Global State
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initCodeViewer();
  initSemaphoreSimulator();
  initProducerConsumer();
  initAuthorDetails();
});

/* ============================================================================
   1. Navbar & Mobile Menu Interaction
   ============================================================================ */
function initNavbar() {
  const toggleBtn = document.getElementById('mobileToggle');
  const navLinks = document.getElementById('navLinks');

  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
    });

    // Close mobile menu on link click
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
      });
    });
  }

  // Active navigation tracking on scroll
  const sections = document.querySelectorAll('section[id]');
  window.addEventListener('scroll', () => {
    const scrollY = window.pageYOffset;
    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 120;
      const sectionId = current.getAttribute('id');
      const navItem = document.querySelector(`.nav-links a[href*="${sectionId}"]`);
      if (navItem) {
        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
          navItem.classList.add('active');
        } else {
          navItem.classList.remove('active');
        }
      }
    });
  });
}

/* ============================================================================
   2. Code Viewer & Clipboard Helper
   ============================================================================ */
function initCodeViewer() {
  const tabs = document.querySelectorAll('.code-tab-btn');
  const panes = document.querySelectorAll('.code-pane');
  const copyBtn = document.getElementById('copyCodeBtn');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetLang = tab.getAttribute('data-lang');
      
      // Update tab active state
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update panes
      panes.forEach(pane => {
        if (pane.id === `code-${targetLang}`) {
          pane.classList.add('active');
        } else {
          pane.classList.remove('active');
        }
      });
    });
  });

  // Copy code button
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const activePane = document.querySelector('.code-pane.active pre');
      if (activePane) {
        const textToCopy = activePane.innerText;
        navigator.clipboard.writeText(textToCopy).then(() => {
          showToast('Code copied to clipboard!');
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Copied!
          `;
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              Copy Code
            `;
          }, 2000);
        }).catch(err => {
          showToast('Could not copy code: ' + err);
        });
      }
    });
  }
}

// Toast notification helper
function showToast(message) {
  let toast = document.getElementById('toastNotice');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastNotice';
    toast.className = 'toast-notice';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
    <span>${message}</span>
  `;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

/* ============================================================================
   3. Real Operating System Semaphore Class & Data Structures
   ============================================================================ */
class BlockingSemaphore {
  /**
   * Constructs a Semaphore with an initial integer value and wait queue.
   * @param {number} initialValue - Initial permits available (1 for binary mutex)
   * @param {string} name - Label for identification
   */
  constructor(initialValue = 1, name = "S") {
    this.name = name;
    this.initialValue = initialValue;
    this.value = initialValue;
    this.queue = []; // Real FIFO queue of blocked processes
  }

  /**
   * Classical wait() / P() / proberen operation
   * Decrements the semaphore value.
   * If value < 0 (or <= 0 depending on convention, here Dijkstra's blocking definition where
   * negative value represents the count of waiting processes in queue).
   * @param {Process} process - Process calling wait
   * @returns {boolean} true if granted immediate entry, false if blocked
   */
  wait(process) {
    this.value--;
    if (this.value < 0) {
      // Resource is unavailable, block the process and append to wait queue
      this.queue.push(process);
      return false; // Process is blocked
    }
    return true; // Process acquired permit immediately
  }

  /**
   * Classical signal() / V() / verhogen operation
   * Increments the semaphore value.
   * If value <= 0, wakes up a blocked process from the queue.
   * @returns {Process|null} The unblocked process or null
   */
  signal() {
    this.value++;
    if (this.value <= 0 && this.queue.length > 0) {
      // Wake up the next process from the waiting FIFO queue
      const wokenProcess = this.queue.shift();
      return wokenProcess;
    }
    return null;
  }

  reset(newValue = null) {
    this.value = newValue !== null ? newValue : this.initialValue;
    this.queue = [];
  }
}

/* Process Representation */
class SimProcess {
  constructor(id, name, color, burstTime = 3) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.burstTime = burstTime;
    this.remainingBurst = burstTime;
    this.state = 'READY'; // 'READY' | 'WAITING' | 'RUNNING' | 'FINISHED'
    this.stepCount = 0;
    this.hasRun = false;
  }

  reset() {
    this.state = 'READY';
    this.remainingBurst = this.burstTime;
    this.stepCount = 0;
    this.hasRun = false;
  }
}

/* ============================================================================
   4. Live Simulator Engine & Controller
   ============================================================================ */
function initSemaphoreSimulator() {
  // Elements
  const playBtn = document.getElementById('simPlayBtn');
  const pauseBtn = document.getElementById('simPauseBtn');
  const stepBtn = document.getElementById('simStepBtn');
  const resetBtn = document.getElementById('simResetBtn');
  const speedSlider = document.getElementById('simSpeedSlider');
  const speedDisplay = document.getElementById('simSpeedDisplay');
  const semToggle = document.getElementById('semToggle');
  const semToggleBadge = document.getElementById('semToggleBadge');
  const semTypeSelect = document.getElementById('semTypeSelect');

  // Display fields
  const semValueDisplay = document.getElementById('semValueDisplay');
  const semQueueCount = document.getElementById('semQueueCount');
  const semQueueContainer = document.getElementById('semQueueContainer');
  const readyListContainer = document.getElementById('readyProcessList');
  const criticalSectionArena = document.getElementById('criticalSectionArena');
  const criticalVault = document.getElementById('criticalSectionVault');
  const vaultStatusText = document.getElementById('vaultStatusText');
  const logTerminal = document.getElementById('eventLogTerminal');
  const clearLogBtn = document.getElementById('clearLogBtn');
  const sharedCounterVal = document.getElementById('sharedCounterVal');
  const raceAlertBox = document.getElementById('raceAlertBox');
  const raceCountDisplay = document.getElementById('raceCountDisplay');

  // Simulation State
  let isRunning = false;
  let timerId = null;
  let tickSpeed = parseInt(speedSlider ? speedSlider.value : 1000, 10);
  let semaphoreEnabled = true;
  let semaphoreType = 'binary'; // 'binary' (1) or 'counting' (2)
  let sharedResourceCounter = 0;
  let raceCollisionCount = 0;
  let simClock = 0; // Discrete simulation clock

  // Instantiate Process Pool
  const processColors = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb923c'];
  let processes = [
    new SimProcess(1, 'P1', processColors[0], 3),
    new SimProcess(2, 'P2', processColors[1], 4),
    new SimProcess(3, 'P3', processColors[2], 3),
    new SimProcess(4, 'P4', processColors[3], 3),
    new SimProcess(5, 'P5', processColors[4], 2)
  ];

  // Primary Semaphore instance
  let sem = new BlockingSemaphore(1, "Mutex");

  // Format timestamp helper
  function getTimeStr() {
    const mins = Math.floor(simClock / 60).toString().padStart(2, '0');
    const secs = (simClock % 60).toString().padStart(2, '0');
    return `[${mins}:${secs}]`;
  }

  // Append Event Log
  function addLog(message, type = 'info') {
    if (!logTerminal) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="log-time">${getTimeStr()}</span> ${message}`;
    logTerminal.insertBefore(entry, logTerminal.firstChild);
  }

  // Update DOM View from Model
  function render() {
    // 1. Update Semaphore Value display
    if (semValueDisplay) {
      if (!semaphoreEnabled) {
        semValueDisplay.textContent = 'BYPASS';
        semValueDisplay.className = 'sem-metric-value zero';
      } else {
        semValueDisplay.textContent = sem.value;
        if (sem.value > 0) {
          semValueDisplay.className = 'sem-metric-value';
        } else if (sem.value === 0) {
          semValueDisplay.className = 'sem-metric-value zero';
        } else {
          semValueDisplay.className = 'sem-metric-value negative';
        }
      }
    }

    if (semQueueCount) {
      semQueueCount.textContent = sem.queue.length;
    }

    // 2. Render Waiting Queue Box
    if (semQueueContainer) {
      semQueueContainer.innerHTML = '';
      if (sem.queue.length === 0) {
        semQueueContainer.innerHTML = `<div class="queue-empty-msg">Queue is empty (no blocked processes)</div>`;
      } else {
        sem.queue.forEach((proc, index) => {
          const chip = document.createElement('div');
          chip.className = 'queue-chip';
          chip.innerHTML = `
            <span>#${index + 1}</span>
            <strong style="color: ${proc.color};">${proc.name}</strong>
          `;
          semQueueContainer.appendChild(chip);
        });
      }
    }

    // 3. Render Ready / Process Pool list
    if (readyListContainer) {
      readyListContainer.innerHTML = '';
      processes.forEach(proc => {
        const item = document.createElement('div');
        item.className = 'process-card';
        item.innerHTML = `
          <div class="proc-meta">
            <div class="proc-avatar" style="background: ${proc.color};">${proc.name}</div>
            <div>
              <div class="proc-name">${proc.name}</div>
              <div class="proc-burst">Burst: ${proc.remainingBurst}/${proc.burstTime} ticks</div>
            </div>
          </div>
          <span class="state-badge ${proc.state.toLowerCase()}">${proc.state}</span>
        `;
        readyListContainer.appendChild(item);
      });
    }

    // 4. Render Critical Section Vault
    const runningProcesses = processes.filter(p => p.state === 'RUNNING');
    const maxAllowedInCS = (!semaphoreEnabled) ? 1 : (semaphoreType === 'counting' ? 2 : 1);
    const isConflict = (!semaphoreEnabled && runningProcesses.length > 1) || (runningProcesses.length > maxAllowedInCS);

    if (criticalSectionArena) {
      criticalSectionArena.innerHTML = '';
      if (runningProcesses.length === 0) {
        criticalSectionArena.innerHTML = `
          <div class="cs-empty-placeholder">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <span>Critical Section is Idle (Resource Free)</span>
          </div>
        `;
      } else {
        runningProcesses.forEach(proc => {
          const node = document.createElement('div');
          node.className = `cs-process-active ${isConflict ? 'conflict' : ''}`;
          node.innerHTML = `
            <div class="proc-avatar" style="background: ${proc.color};">${proc.name}</div>
            <div>
              <div style="font-weight: 700; color: #fff;">${proc.name} Executing</div>
              <div style="font-size: 0.75rem; color: #cbd5e1;">Remaining: ${proc.remainingBurst} ticks</div>
            </div>
          `;
          criticalSectionArena.appendChild(node);
        });
      }
    }

    // Check race condition status
    if (isConflict) {
      // RACE CONDITION DETECTED!
      if (criticalVault) criticalVault.classList.add('race-condition-active');
      if (vaultStatusText) {
        vaultStatusText.textContent = `CRITICAL HAZARD: ${runningProcesses.length} Concurrent In CS!`;
        vaultStatusText.className = 'vault-status-indicator danger';
      }
      if (raceAlertBox) raceAlertBox.style.display = 'block';
    } else {
      if (criticalVault) criticalVault.classList.remove('race-condition-active');
      if (vaultStatusText) {
        vaultStatusText.textContent = runningProcesses.length > 0 ? `${runningProcesses.length} Process${runningProcesses.length > 1 ? 'es' : ''} Active` : 'Idle';
        vaultStatusText.className = 'vault-status-indicator';
      }
      if (raceAlertBox) raceAlertBox.style.display = 'none';
    }

    // 5. Update Shared Counter
    if (sharedCounterVal) {
      sharedCounterVal.textContent = sharedResourceCounter;
      if (runningProcesses.length > 1) {
        sharedCounterVal.className = 'counter-value-glow corrupted';
      } else {
        sharedCounterVal.className = 'counter-value-glow';
      }
    }

    if (raceCountDisplay) {
      raceCountDisplay.textContent = raceCollisionCount;
    }
  }

  /**
   * Execute one atomic simulation step / clock tick
   */
  function simulationStep() {
    simClock++;

    // 1. Check if any running process is done executing its critical section
    const currentRunning = processes.filter(p => p.state === 'RUNNING');

    // Decrement burst time for currently running processes
    currentRunning.forEach(proc => {
      proc.remainingBurst--;

      if (!semaphoreEnabled && currentRunning.length > 1) {
        // Race condition data corruption anomaly!
        // Two processes concurrently increment shared memory without mutual exclusion
        raceCollisionCount++;
        // Data race: lost updates simulate corrupted value
        sharedResourceCounter += 1;
        addLog(`<strong>RACE HAZARD:</strong> ${proc.name} concurrently modifies shared data! Lost update / corruption hazard.`, 'race');
      } else {
        // Safe execution in critical section
        sharedResourceCounter += 1;
      }

      // Check if process finished its burst in critical section
      if (proc.remainingBurst <= 0) {
        proc.state = 'FINISHED';
        addLog(`<strong>${proc.name}</strong> completed critical section and exits.`, 'enter');

        if (semaphoreEnabled) {
          // Signal the semaphore
          const oldVal = sem.value;
          const wokenProc = sem.signal();
          addLog(`<strong>${proc.name}</strong> calls <code>signal(S)</code>. Value: ${oldVal} &rarr; ${sem.value}`, 'signal');

          if (wokenProc) {
            wokenProc.state = 'RUNNING';
            addLog(`Semaphore wakes up <strong>${wokenProc.name}</strong> from wait queue &rarr; ENTERS Critical Section`, 'enter');
          }
        }
      }
    });

    // 2. Select next READY process to request entry to Critical Section
    const readyProcs = processes.filter(p => p.state === 'READY');

    if (readyProcs.length > 0) {
      // Pick the next ready process
      const candidate = readyProcs[0];

      if (semaphoreEnabled) {
        // Run real wait() logic
        const oldVal = sem.value;
        const acquired = sem.wait(candidate);

        addLog(`<strong>${candidate.name}</strong> calls <code>wait(S)</code>. Value: ${oldVal} &rarr; ${sem.value}`, 'wait');

        if (acquired) {
          candidate.state = 'RUNNING';
          addLog(`Permit granted! <strong>${candidate.name}</strong> ENTERS Critical Section.`, 'enter');
        } else {
          candidate.state = 'WAITING';
          addLog(`Permit denied (value < 0). <strong>${candidate.name}</strong> is BLOCKED & placed in FIFO wait queue.`, 'wait');
        }
      } else {
        // SEMAPHORE BYPASSED (Demonstrating Race Condition)
        candidate.state = 'RUNNING';
        addLog(`<em>[MUTEX DISABLED]</em> <strong>${candidate.name}</strong> enters Critical Section without synchronization check!`, 'race');
      }
    }

    // 3. Check if all processes have completed
    const allDone = processes.every(p => p.state === 'FINISHED');
    if (allDone) {
      pauseSimulation();
      addLog(`All processes have completed execution! Simulation complete.`, 'enter');
    }

    render();
  }

  function startSimulation() {
    const allDone = processes.every(p => p.state === 'FINISHED');
    if (allDone) {
      resetSimulation();
    }
    if (isRunning) return;
    isRunning = true;
    if (playBtn) playBtn.disabled = true;
    if (pauseBtn) pauseBtn.disabled = false;

    // Run tick loop
    timerId = setInterval(() => {
      simulationStep();
    }, tickSpeed);
  }

  function pauseSimulation() {
    isRunning = false;
    if (timerId) clearInterval(timerId);
    timerId = null;
    if (playBtn) playBtn.disabled = false;
    if (pauseBtn) pauseBtn.disabled = true;
  }

  function resetSimulation() {
    pauseSimulation();
    simClock = 0;
    sharedResourceCounter = 0;
    raceCollisionCount = 0;

    const initialPermits = semaphoreType === 'counting' ? 2 : 1;
    sem = new BlockingSemaphore(initialPermits, "Mutex");

    // Reset processes
    processes.forEach(p => p.reset());

    if (logTerminal) {
      logTerminal.innerHTML = '';
    }
    addLog(`Simulation reset. Mode: <strong>${semaphoreType.toUpperCase()}</strong> (${initialPermits} permits). Semaphore: <strong>${semaphoreEnabled ? 'ON' : 'OFF'}</strong>.`, 'info');

    render();
  }

  // Event Listeners for Controls
  if (playBtn) playBtn.addEventListener('click', startSimulation);
  if (pauseBtn) pauseBtn.addEventListener('click', pauseSimulation);
  if (stepBtn) stepBtn.addEventListener('click', () => {
    const allDone = processes.every(p => p.state === 'FINISHED');
    if (allDone) {
      resetSimulation();
    }
    pauseSimulation();
    simulationStep();
  });
  if (resetBtn) resetBtn.addEventListener('click', resetSimulation);

  // Speed Slider
  if (speedSlider) {
    speedSlider.addEventListener('input', (e) => {
      tickSpeed = parseInt(e.target.value, 10);
      if (speedDisplay) speedDisplay.textContent = `${(tickSpeed / 1000).toFixed(1)}s`;
      if (isRunning) {
        clearInterval(timerId);
        timerId = setInterval(simulationStep, tickSpeed);
      }
    });
  }

  // Semaphore ON / OFF Toggle (Race Condition Trigger)
  if (semToggle) {
    semToggle.addEventListener('change', (e) => {
      semaphoreEnabled = e.target.checked;
      if (semToggleBadge) {
        semToggleBadge.textContent = semaphoreEnabled ? 'MUTEX ON' : 'MUTEX OFF';
        semToggleBadge.className = semaphoreEnabled ? 'toggle-status-badge on' : 'toggle-status-badge off';
      }
      addLog(`Synchronization Semaphore has been switched <strong>${semaphoreEnabled ? 'ON (Protected)' : 'OFF (RACE CONDITION RISK!)'}</strong>`, semaphoreEnabled ? 'info' : 'race');
      render();
    });
  }

  // Semaphore Type Selector
  if (semTypeSelect) {
    semTypeSelect.addEventListener('change', (e) => {
      semaphoreType = e.target.value;
      resetSimulation();
    });
  }

  // Clear Log
  if (clearLogBtn) {
    clearLogBtn.addEventListener('click', () => {
      if (logTerminal) logTerminal.innerHTML = '';
      addLog(`Log cleared.`, 'info');
    });
  }

  // Initial Boot
  resetSimulation();
}

/* ============================================================================
   5. Producer - Consumer Bounded Buffer Engine
   ============================================================================ */
function initProducerConsumer() {
  const BUFFER_CAPACITY = 5;
  let buffer = []; // Array storing current items

  // Semaphores for the classic bounded-buffer solution:
  // mutex: binary semaphore providing mutual exclusion for buffer access
  // empty: counting semaphore counting unoccupied slots (initial = N)
  // full:  counting semaphore counting filled slots (initial = 0)
  const mutexSem = new BlockingSemaphore(1, "mutex");
  const emptySem = new BlockingSemaphore(BUFFER_CAPACITY, "empty");
  const fullSem = new BlockingSemaphore(0, "full");

  // DOM Elements
  const btnProduce = document.getElementById('pcProduceBtn');
  const btnConsume = document.getElementById('pcConsumeBtn');
  const valMutex = document.getElementById('pcMutexVal');
  const valEmpty = document.getElementById('pcEmptyVal');
  const valFull = document.getElementById('pcFullVal');
  const slotsContainer = document.getElementById('pcBufferSlots');
  const pcStatusMessage = document.getElementById('pcStatusMsg');

  // Food / Item icons for visual delight
  const itemIcons = ['📦', '⚙️', '💎', '🔑', '🔋', '🚀', '💿', '🍎'];

  function updateDisplay() {
    // 1. Update Semaphores values
    if (valMutex) valMutex.textContent = mutexSem.value;
    if (valEmpty) valEmpty.textContent = emptySem.value;
    if (valFull) valFull.textContent = fullSem.value;

    // 2. Render Buffer Slots
    if (slotsContainer) {
      slotsContainer.innerHTML = '';
      for (let i = 0; i < BUFFER_CAPACITY; i++) {
        const slot = document.createElement('div');
        slot.className = 'buffer-slot';
        slot.innerHTML = `<span class="slot-index">[${i}]</span>`;

        if (i < buffer.length) {
          slot.classList.add('filled');
          slot.innerHTML += `<span class="slot-item-icon">${buffer[i]}</span>`;
        } else {
          slot.innerHTML += `<span style="color: rgba(255,255,255,0.1); font-size: 1.2rem;">&empty;</span>`;
        }
        slotsContainer.appendChild(slot);
      }
    }

    // 3. Button states
    if (btnProduce) btnProduce.disabled = buffer.length >= BUFFER_CAPACITY;
    if (btnConsume) btnConsume.disabled = buffer.length === 0;
  }

  /**
   * Classical Producer Execution:
   * wait(empty);
   * wait(mutex);
   * // add item to buffer
   * signal(mutex);
   * signal(full);
   */
  function produceItem() {
    if (emptySem.value <= 0) {
      if (pcStatusMessage) {
        pcStatusMessage.textContent = 'Buffer is FULL! wait(empty) blocks the Producer.';
        pcStatusMessage.style.color = '#ef4444';
      }
      return;
    }

    // Execute standard sequence
    emptySem.value--; // wait(empty)
    mutexSem.value--; // wait(mutex)

    const randomIcon = itemIcons[Math.floor(Math.random() * itemIcons.length)];
    buffer.push(randomIcon);

    mutexSem.value++; // signal(mutex)
    fullSem.value++;  // signal(full)

    if (pcStatusMessage) {
      pcStatusMessage.textContent = `Producer produced ${randomIcon}. empty: ${emptySem.value}, full: ${fullSem.value}.`;
      pcStatusMessage.style.color = '#38bdf8';
    }

    updateDisplay();
  }

  /**
   * Classical Consumer Execution:
   * wait(full);
   * wait(mutex);
   * // remove item from buffer
   * signal(mutex);
   * signal(empty);
   */
  function consumeItem() {
    if (fullSem.value <= 0 || buffer.length === 0) {
      if (pcStatusMessage) {
        pcStatusMessage.textContent = 'Buffer is EMPTY! wait(full) blocks the Consumer.';
        pcStatusMessage.style.color = '#fbbf24';
      }
      return;
    }

    // Execute standard sequence
    fullSem.value--;  // wait(full)
    mutexSem.value--; // wait(mutex)

    const removedItem = buffer.shift();

    mutexSem.value++;  // signal(mutex)
    emptySem.value++; // signal(empty)

    if (pcStatusMessage) {
      pcStatusMessage.textContent = `Consumer consumed ${removedItem}. empty: ${emptySem.value}, full: ${fullSem.value}.`;
      pcStatusMessage.style.color = '#10b981';
    }

    updateDisplay();
  }

  if (btnProduce) btnProduce.addEventListener('click', produceItem);
  if (btnConsume) btnConsume.addEventListener('click', consumeItem);

  updateDisplay();
}

/* ============================================================================
   6. Author Details: In-Place Editing, LocalStorage Persistence & Validation
   ============================================================================ */
function initAuthorDetails() {
  const STORAGE_KEY = 'os_semaphore_project_author';

  // Default Fallback Placeholders
  const DEFAULTS = {
    name: "[Your Name / Student Name]",
    roll: "[Roll No: CS-202X-XXX]",
    dept: "B.Tech / B.E. Computer Science & Engineering",
    college: "[Department of Computer Science & Engineering, College / University Placeholder]"
  };

  // Display Elements
  const valName = document.getElementById('authorNameVal');
  const valRoll = document.getElementById('authorRollVal');
  const valDept = document.getElementById('authorDeptVal');
  const valCollege = document.getElementById('authorCollegeVal');
  const avatarEl = document.getElementById('authorAvatar');
  const headerTitle = document.getElementById('authorHeaderTitle');

  // Input Elements
  const inputName = document.getElementById('authorNameInput');
  const inputRoll = document.getElementById('authorRollInput');
  const inputDept = document.getElementById('authorDeptInput');
  const inputCollege = document.getElementById('authorCollegeInput');

  // Action Buttons & Containers
  const editBtn = document.getElementById('editAuthorBtn');
  const resetBtn = document.getElementById('resetAuthorBtn');
  const saveBtn = document.getElementById('saveAuthorBtn');
  const cancelBtn = document.getElementById('cancelAuthorBtn');
  const editControls = document.getElementById('authorEditControls');
  const headerActions = document.getElementById('authorHeaderActions');
  const errorBanner = document.getElementById('authorErrorBanner');
  const errorText = document.getElementById('authorErrorText');
  const hintText = document.getElementById('authorHintText');
  const nameStar = document.getElementById('nameStar');
  const rollStar = document.getElementById('rollStar');

  if (!valName || !inputName || !editBtn) return;

  // Read saved data from localStorage safely
  function loadAuthorData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : DEFAULTS.name,
          roll: typeof parsed.roll === 'string' && parsed.roll.trim() ? parsed.roll.trim() : DEFAULTS.roll,
          dept: typeof parsed.dept === 'string' && parsed.dept.trim() ? parsed.dept.trim() : DEFAULTS.dept,
          college: typeof parsed.college === 'string' && parsed.college.trim() ? parsed.college.trim() : DEFAULTS.college
        };
      }
    } catch (e) {
      console.warn('localStorage access failed or disabled:', e);
    }
    return { ...DEFAULTS };
  }

  // Render text data into the card (using textContent to prevent HTML injection)
  function renderAuthorData(data) {
    valName.textContent = data.name;
    valRoll.textContent = data.roll;
    valDept.textContent = data.dept;
    valCollege.textContent = data.college;

    // Update Avatar initials if customized
    if (data.name !== DEFAULTS.name) {
      const parts = data.name.trim().split(/\s+/);
      let initials = 'OS';
      if (parts.length >= 2) {
        initials = (parts[0][0] + parts[1][0]).toUpperCase();
      } else if (parts.length === 1 && parts[0].length > 0) {
        initials = parts[0].substring(0, 2).toUpperCase();
      }
      if (avatarEl) avatarEl.textContent = initials;
      if (headerTitle) headerTitle.textContent = data.name;
    } else {
      if (avatarEl) avatarEl.textContent = 'OS';
      if (headerTitle) headerTitle.textContent = 'Student Submitter';
    }
  }

  // Enter Edit Mode: Display inputs pre-filled with current values
  function openEditMode() {
    // Pre-fill inputs with current displayed text (omit placeholder bracket strings if not customized)
    inputName.value = valName.textContent === DEFAULTS.name ? '' : valName.textContent;
    inputRoll.value = valRoll.textContent === DEFAULTS.roll ? '' : valRoll.textContent;
    inputDept.value = valDept.textContent === DEFAULTS.dept ? '' : valDept.textContent;
    inputCollege.value = valCollege.textContent === DEFAULTS.college ? '' : valCollege.textContent;

    // Hide display values and show inputs
    [valName, valRoll, valDept, valCollege].forEach(el => el.style.display = 'none');
    [inputName, inputRoll, inputDept, inputCollege].forEach(el => {
      el.style.display = 'block';
      el.classList.remove('input-error');
    });

    if (nameStar) nameStar.style.display = 'inline';
    if (rollStar) rollStar.style.display = 'inline';
    if (errorBanner) errorBanner.style.display = 'none';
    if (editControls) editControls.style.display = 'flex';
    if (headerActions) headerActions.style.display = 'none';
    if (hintText) hintText.textContent = 'Fields marked with * are required. Click Save Details when finished.';

    // Focus first input field
    inputName.focus();
  }

  // Cancel / Close Edit Mode
  function closeEditMode() {
    [valName, valRoll, valDept, valCollege].forEach(el => el.style.display = 'block');
    [inputName, inputRoll, inputDept, inputCollege].forEach(el => {
      el.style.display = 'none';
      el.classList.remove('input-error');
    });

    if (nameStar) nameStar.style.display = 'none';
    if (rollStar) rollStar.style.display = 'none';
    if (errorBanner) errorBanner.style.display = 'none';
    if (editControls) editControls.style.display = 'none';
    if (headerActions) headerActions.style.display = 'flex';
    if (hintText) hintText.textContent = 'Click Edit Details to update your information.';
  }

  // Save changes to localStorage and update card view
  function saveAuthorDetails() {
    const rawName = inputName.value.trim();
    const rawRoll = inputRoll.value.trim();
    const rawDept = inputDept.value.trim();
    const rawCollege = inputCollege.value.trim();

    // Validation: Name and Roll Number must not be empty
    let hasError = false;
    let errorMsg = '';

    inputName.classList.remove('input-error');
    inputRoll.classList.remove('input-error');

    if (!rawName && !rawRoll) {
      hasError = true;
      errorMsg = 'Student Name and Roll Number are required.';
      inputName.classList.add('input-error');
      inputRoll.classList.add('input-error');
      inputName.focus();
    } else if (!rawName) {
      hasError = true;
      errorMsg = 'Student Name cannot be empty.';
      inputName.classList.add('input-error');
      inputName.focus();
    } else if (!rawRoll) {
      hasError = true;
      errorMsg = 'Roll Number / Student ID cannot be empty.';
      inputRoll.classList.add('input-error');
      inputRoll.focus();
    }

    if (hasError) {
      if (errorBanner && errorText) {
        errorText.textContent = errorMsg;
        errorBanner.style.display = 'flex';
      }
      return;
    }

    const updatedData = {
      name: rawName,
      roll: rawRoll,
      dept: rawDept || DEFAULTS.dept,
      college: rawCollege || DEFAULTS.college
    };

    // Save in browser localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }

    // Safely update display (escaped via textContent)
    renderAuthorData(updatedData);
    closeEditMode();

    if (typeof showToast === 'function') {
      showToast('Author details saved successfully!');
    }
  }

  // Reset details to default placeholders
  function resetAuthorDetails() {
    if (confirm('Reset student details back to the default placeholders?')) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.error('Failed to clear localStorage:', e);
      }

      renderAuthorData(DEFAULTS);
      closeEditMode();

      if (typeof showToast === 'function') {
        showToast('Details reset to default placeholders.');
      }
    }
  }

  // Event Listeners
  editBtn.addEventListener('click', openEditMode);
  cancelBtn.addEventListener('click', closeEditMode);
  saveBtn.addEventListener('click', saveAuthorDetails);
  resetBtn.addEventListener('click', resetAuthorDetails);

  // Keyboard accessibility: Enter to save, Escape to cancel
  [inputName, inputRoll, inputDept, inputCollege].forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveAuthorDetails();
      } else if (e.key === 'Escape') {
        closeEditMode();
      }
    });
  });

  // Initial load on page ready
  const currentData = loadAuthorData();
  renderAuthorData(currentData);
}
