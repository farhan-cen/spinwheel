/* ==========================================================================
   SPIN WHEEL - INVENTORY LUCKY DRAW ENGINE
   ========================================================================== */

// --- Default Item List with Initial Stocks ---
const DEFAULT_ITEMS = [
    { name: "Jackpot $10,000", stock: 1 },
    { name: "Luxury Trip to Vegas", stock: 1 },
    { name: "VIP Dinner Voucher", stock: 5 },
    { name: "Golden Ticket", stock: 10 },
    { name: "Royale Gift Card", stock: 15 }
];

// --- Application State ---
let items = [];
let winnersHistory = [];
let participantQueue = []; // Participant Queue array
let draggedIndex = null; // Dragged item state for queue list reordering
let isSpinning = false;
let soundEnabled = true;

// Wheel Angle & Physics variables
let currentAngle = 0; // Cumulative angle of the wheel
let spinDuration = 6000; // Spin duration in milliseconds

// Web Audio API State
let audioCtx = null;

// Confetti Particle System State
let confettiParticles = [];
let confettiAnimationId = null;

// Marquee Bulb State
let marqueePhase = 0;

// --- Initialize Application ---
document.addEventListener("DOMContentLoaded", () => {
    loadState();
    if (items.length === 0) {
        items = JSON.parse(JSON.stringify(DEFAULT_ITEMS));
        saveState();
    }
    
    // Bind UI Event Listeners
    initEventListeners();
    
    // Initial Render
    renderItemsList();
    renderWinnersHistory();
    renderQueueList(); // Render participant queue
    updateCounts();
    
    // Setup Canvas and draw initial static wheel
    setupCanvas();
    drawWheel();
    
    // Start marquee bulb pulse loop for idle state
    setInterval(() => {
        marqueePhase = (marqueePhase + 1) % 3;
        if (!isSpinning) {
            drawWheel(); // redraw to pulse bulbs when static
        }
    }, 300);

    // --- Login Gate Authentication ---
    const loginOverlay = document.getElementById("loginOverlay");
    const loginForm = document.getElementById("loginForm");
    const loginUsernameInput = document.getElementById("loginUsername");
    const loginPasswordInput = document.getElementById("loginPassword");
    const loginErrorMsg = document.getElementById("loginErrorMsg");
    const loginCard = document.querySelector(".login-card");

    const checkAuth = () => {
        const isAuth = sessionStorage.getItem("spinwheel_auth") === "true";
        if (isAuth) {
            loginOverlay.classList.add("hidden");
        } else {
            loginOverlay.classList.remove("hidden");
        }
    };

    checkAuth();

    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const username = loginUsernameInput.value.trim();
            const password = loginPasswordInput.value.trim();

            if (username === "admin" && password === "dupi123") {
                sessionStorage.setItem("spinwheel_auth", "true");
                loginOverlay.classList.add("hidden");
                loginErrorMsg.classList.add("hidden");
                loginUsernameInput.value = "";
                loginPasswordInput.value = "";
            } else {
                loginErrorMsg.classList.remove("hidden");
                loginCard.classList.remove("shake");
                void loginCard.offsetWidth; // Force reflow
                loginCard.classList.add("shake");
                loginPasswordInput.value = "";
            }
        });
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            sessionStorage.removeItem("spinwheel_auth");
            checkAuth();
        });
    }
});

// --- State Management Helpers ---
async function saveState() {
    localStorage.setItem("spinwheel_items_v2", JSON.stringify(items));
    localStorage.setItem("spinwheel_history", JSON.stringify(winnersHistory));
    localStorage.setItem("spinwheel_queue", JSON.stringify(participantQueue));
    localStorage.setItem("spinwheel_sound", JSON.stringify(soundEnabled));
    localStorage.setItem("spinwheel_remove_on_zero", JSON.stringify(document.getElementById("removeWinnerToggle").checked));
if (window.saveToFirebase) {
    window.saveToFirebase({
        items,
        winnersHistory,
        participantQueue,
        soundEnabled,
        updatedAt: Date.now()
    });
}
}

function loadState() {
    try {
        const savedItems = localStorage.getItem("spinwheel_items_v2");
        if (savedItems) items = JSON.parse(savedItems);

        const savedHistory = localStorage.getItem("spinwheel_history");
        if (savedHistory) winnersHistory = JSON.parse(savedHistory);

        const savedQueue = localStorage.getItem("spinwheel_queue");
        if (savedQueue) participantQueue = JSON.parse(savedQueue);

        const savedSound = localStorage.getItem("spinwheel_sound");
        if (savedSound !== null) {
            soundEnabled = JSON.parse(savedSound);
            updateSoundIcon();
        }

        const savedRemoveOnZero = localStorage.getItem("spinwheel_remove_on_zero");
        if (savedRemoveOnZero !== null) {
            document.getElementById("removeWinnerToggle").checked = JSON.parse(savedRemoveOnZero);
        }
    } catch (e) {
        console.error("Failed to load local storage state:", e);
    }
}

// Helper to filter active items (with stock > 0 if option is checked) and track original indices
function getActiveItems() {
    const shouldRemoveOnZero = document.getElementById("removeWinnerToggle").checked;
    return items
        .map((item, idx) => ({ ...item, originalIndex: idx }))
        .filter(item => shouldRemoveOnZero ? item.stock > 0 : true);
}

// --- Audio Engine (Web Audio API Synthesizer) ---
function ensureAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
}

function playTickSound() {
    if (!soundEnabled) return;
    ensureAudioContext();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.04);
    
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.05);
}

function playCelebrationSound() {
    if (!soundEnabled) return;
    ensureAudioContext();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    
    // Beautiful ascending major arpeggio chime effect
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5, E5, G5, C6
    notes.forEach((freq, idx) => {
        const time = now + idx * 0.12;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.03, time + 0.4);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.12, time + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.6);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(time);
        osc.stop(time + 0.65);
    });
}

// Satisfying rapid card-ruffle click sequence for shuffling
function playShuffleSound() {
    if (!soundEnabled) return;
    ensureAudioContext();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    
    for (let i = 0; i < 6; i++) {
        const time = now + i * 0.04;
        const freq = 220 + i * 85;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);
        
        gain.gain.setValueAtTime(0.05, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(time);
        osc.stop(time + 0.04);
    }
}

function updateSoundIcon() {
    const soundOn = document.getElementById("soundOnIcon");
    const soundOff = document.getElementById("soundOffIcon");
    if (soundEnabled) {
        soundOn.classList.remove("hidden");
        soundOff.classList.add("hidden");
    } else {
        soundOn.classList.add("hidden");
        soundOff.classList.remove("hidden");
    }
}

// --- Wheel Canvas Drawing ---
let canvas, ctx;
function setupCanvas() {
    canvas = document.getElementById("wheelCanvas");
    ctx = canvas.getContext("2d");
}

function drawWheel() {
    if (!canvas || !ctx) return;
    
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 35; // margin for marquee lights rim
    
    ctx.clearRect(0, 0, size, size);
    
    const activeItems = getActiveItems();
    const numSlices = activeItems.length;
    
    if (numSlices === 0) {
        // Draw empty wheel state (all items out of stock)
        ctx.save();
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, 2 * Math.PI);
        ctx.fillStyle = "#161b2c";
        ctx.fill();
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 4;
        ctx.stroke();
        
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 24px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("OUT OF STOCK", center, center - 15);
        
        ctx.fillStyle = "#64748b";
        ctx.font = "16px Outfit, sans-serif";
        ctx.fillText("Add items or replenish stock to spin", center, center + 20);
        ctx.restore();
        
        drawOuterMarqueeRing(center, radius + 15, 0);
        return;
    }
    
    const sliceAngle = (2 * Math.PI) / numSlices;
    
    // Draw Slices
    for (let i = 0; i < numSlices; i++) {
        const startAngle = i * sliceAngle + currentAngle;
        const endAngle = startAngle + sliceAngle;
        
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.arc(center, center, radius, startAngle, endAngle);
        ctx.closePath();
        
        // Premium cyclic HSL color palette
        const hue = (i * 360 / numSlices) % 360;
        ctx.fillStyle = `hsl(${hue}, 70%, 42%)`;
        ctx.fill();
        
        // Slice border divider
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    }
    
    // Draw Slice Text
    for (let i = 0; i < numSlices; i++) {
        const startAngle = i * sliceAngle + currentAngle;
        const midAngle = startAngle + sliceAngle / 2;
        
        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(midAngle);
        
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        
        const widthAtRadius = 2 * (radius * 0.7) * Math.sin(sliceAngle / 2);
        
        // Cap font size between 10px and 26px
        let fontSize = Math.min(26, Math.floor(widthAtRadius * 0.78));
        if (fontSize < 10) fontSize = 10;
        
        ctx.font = `bold ${fontSize}px Outfit, sans-serif`;
        
        // Truncate text if it overflows slice length
        let name = activeItems[i].name;
        const maxTextWidth = radius * 0.65;
        
        let measuredWidth = ctx.measureText(name).width;
        if (measuredWidth > maxTextWidth) {
            while (measuredWidth > maxTextWidth && name.length > 3) {
                name = name.slice(0, -1);
                measuredWidth = ctx.measureText(name + "...").width;
            }
            name = name + "...";
        }
        
        // Draw shadow under text
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        
        ctx.fillText(name, radius - 30, 0);
        ctx.restore();
    }
    
    // Draw Concentric Metallic Gold Ring Borders (Canvas Layering)
    // 1. Thick Gold Outer Band
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius - 2, 0, 2 * Math.PI);
    ctx.strokeStyle = "#ffe259";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = "#ffa751";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    
    // 2. Thick Gold Center Hub Ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, 48, 0, 2 * Math.PI);
    ctx.strokeStyle = "#ffe259";
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
    
    // Draw Center Ring Rim Accent (canvas side)
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, 46, 0, 2 * Math.PI);
    ctx.fillStyle = "#090c15";
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    
    // Draw Glowing Marquee Lights on Outer Ring
    drawOuterMarqueeRing(center, radius + 15, currentAngle);
}

// Draw casino-style speed-synchronized chasing lights (clockwise marquee chase)
function drawOuterMarqueeRing(center, ringRadius, angleOffset) {
    const numBulbs = 24;
    const bulbAngle = (2 * Math.PI) / numBulbs;
    
    // Derive chasing phase directly from wheel speed or oscillations
    let phase = 0;
    if (isSpinning) {
        // Light chase speeds up and slows down organically in lockstep with the wheel
        phase = Math.floor(currentAngle * 7) % 3;
    } else {
        phase = marqueePhase; // updated by idle interval timer
    }
    
    ctx.save();
    for (let i = 0; i < numBulbs; i++) {
        // Lights position is slightly offset matching wheel rotation speed
        const angle = i * bulbAngle + (angleOffset * 0.15);
        const bulbX = center + ringRadius * Math.cos(angle);
        const bulbY = center + ringRadius * Math.sin(angle);
        
        ctx.beginPath();
        ctx.arc(bulbX, bulbY, 6, 0, 2 * Math.PI); // Slightly larger bulb
        
        // 3-Phase running lights sequence
        const bulbState = (i + phase) % 3;
        
        if (bulbState === 0) {
            // Bright lit neon yellow bulb
            ctx.fillStyle = "#fef08a"; 
            ctx.shadowColor = "#f59e0b";
            ctx.shadowBlur = 10;
        } else if (bulbState === 1) {
            // Mid-lit orange bulb
            ctx.fillStyle = "#d97706";
            ctx.shadowBlur = 0;
        } else {
            // Dark off bulb
            ctx.fillStyle = "#451a03";
            ctx.shadowBlur = 0;
        }
        ctx.fill();
        ctx.strokeStyle = "#1d1402";
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    ctx.restore();
}

// --- Physics-based Easing and Spin Engine ---
function spinWheel() {
    const activeItems = getActiveItems();
    if (isSpinning || activeItems.length === 0) return;
    
    ensureAudioContext();
    isSpinning = true;
    disableButtons(true);
    
    // Pick the winner randomly and fairly BEFORE the spin starts
    const winnerActiveIndex = Math.floor(Math.random() * activeItems.length);
    const sliceAngle = (2 * Math.PI) / activeItems.length;
    
    // Formula for target stop angle (align with 12 o'clock pointer)
    const baseStopAngle = 1.5 * Math.PI - (winnerActiveIndex + 0.5) * sliceAngle;
    
    // Add multiple full rotations (e.g., 6 to 9) to make the spin exciting
    const minRotations = 6;
    const extraRotations = Math.floor(Math.random() * 4);
    const totalRotations = minRotations + extraRotations;
    
    // Add a random offset within the segment so it doesn't land perfectly centered
    const randomOffsetInsideSegment = (Math.random() - 0.5) * sliceAngle * 0.70;
    
    const startAngle = currentAngle % (2 * Math.PI);
    const targetAngle = startAngle + (totalRotations * 2 * Math.PI) + baseStopAngle + randomOffsetInsideSegment;
    
    const startTime = performance.now();
    
    // Custom Spin Easing Curve (Fast acceleration, long friction deceleration crawl)
    // f(x) = 1 - (1 - x^2)^3
    const spinEase = x => 1 - Math.pow(1 - x * x, 3);
    
    let lastSegmentIndex = -1;
    
    function animateSpin(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / spinDuration, 1);
        
        // Update cumulative angle using custom easing
        const easedProgress = spinEase(progress);
        currentAngle = startAngle + (targetAngle - startAngle) * easedProgress;
        
        // Sound and Pointer ticking checks
        const pointerPosAngle = 1.5 * Math.PI;
        const relativeAngle = (pointerPosAngle - currentAngle) % (2 * Math.PI);
        const normAngle = relativeAngle < 0 ? relativeAngle + (2 * Math.PI) : relativeAngle;
        const currentSegmentIndex = Math.floor(normAngle / sliceAngle) % activeItems.length;
        
        if (currentSegmentIndex !== lastSegmentIndex) {
            triggerPointerTickVisual();
            playTickSound();
            lastSegmentIndex = currentSegmentIndex;
        }
        
        // Redraw wheel canvas
        drawWheel();
        
        if (progress < 1) {
            requestAnimationFrame(animateSpin);
        } else {
            // Spin Finished
            isSpinning = false;
            disableButtons(false);
            
            // Land on winner
            const finalActiveWinnerIndex = getWinnerIndexFromAngle();
            handleWinnerDrawn(finalActiveWinnerIndex);
        }
    }
    
    requestAnimationFrame(animateSpin);
}

// Triggers the ticking clapper animation on the pointer
function triggerPointerTickVisual() {
    const pointer = document.getElementById("wheelPointer");
    pointer.classList.remove("ticking");
    void pointer.offsetWidth; // Force CSS reflow
    pointer.classList.add("ticking");
}

// Calculate the active index under pointer (at 12 o'clock)
function getWinnerIndexFromAngle() {
    const activeItems = getActiveItems();
    const numSlices = activeItems.length;
    const sliceAngle = (2 * Math.PI) / numSlices;
    const pointerAngle = 1.5 * Math.PI;
    
    const relativeAngle = (pointerAngle - currentAngle) % (2 * Math.PI);
    const normAngle = relativeAngle < 0 ? relativeAngle + (2 * Math.PI) : relativeAngle;
    
    return Math.floor(normAngle / sliceAngle) % numSlices;
}

// Disable/Enable spin elements to prevent double clicks
function disableButtons(disable) {
    document.getElementById("spinBtn").disabled = disable;
    document.getElementById("shuffleBtn").disabled = disable;
    document.getElementById("bulkImportBtn").disabled = disable;
    document.getElementById("resetParticipantsBtn").disabled = disable;
    document.getElementById("newParticipantInput").disabled = disable;
    document.getElementById("newStockInput").disabled = disable;
    document.querySelector("#addParticipantForm button").disabled = disable;
}

// Handle landed item: decrement stock and open modal
function handleWinnerDrawn(activeWinnerIndex) {
    // Snapshot state before any mutations for "Cancel Draw" rollback
    const itemsSnapshot = JSON.parse(JSON.stringify(items));
    const historySnapshot = JSON.parse(JSON.stringify(winnersHistory));
    const queueSnapshot = JSON.parse(JSON.stringify(participantQueue));

    const activeItems = getActiveItems();
    const winningActiveItem = activeItems[activeWinnerIndex];
    const originalIndex = winningActiveItem.originalIndex;
    
    // Read Recipient Name from input
    const recipientInput = document.getElementById("recipientNameInput");
    const recipientName = recipientInput.value.trim() || "Anonymous";
    
    // Decrement stock immediately in the master array
    items[originalIndex].stock = Math.max(0, items[originalIndex].stock - 1);
    
    // Auto-remove logic: If the toggle is checked AND stock reached 0, completely delete the item from array
    const shouldRemoveOnZero = document.getElementById("removeWinnerToggle").checked;
    let isCompletelyDeleted = false;
    
    if (shouldRemoveOnZero && items[originalIndex].stock === 0) {
        items.splice(originalIndex, 1);
        isCompletelyDeleted = true;
    }
    
    // Save to local storage
    saveState();
    
    // Update Draw History Log
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    winnersHistory.unshift({ name: winningActiveItem.name, recipient: recipientName, time: timestamp });
    saveState();
    
    // Refresh UIs
    renderItemsList();
    renderWinnersHistory();
    updateCounts();
    drawWheel();
    
    // Display Modal Popup
    const modal = document.getElementById("winnerCelebrationModal");
    const nameDisplay = document.getElementById("winnerNameDisplay");
    const recipientDisplay = document.getElementById("recipientWinnerName");
    const stockDisplay = document.getElementById("winnerStockDisplay");
    
    recipientDisplay.textContent = recipientName;
    nameDisplay.textContent = winningActiveItem.name;
    
    if (isCompletelyDeleted) {
        stockDisplay.textContent = "0 (Removed from list)";
        stockDisplay.className = "stock-display-val zero";
    } else {
        const remainingStock = items[originalIndex] ? items[originalIndex].stock : 0;
        stockDisplay.textContent = remainingStock;
        stockDisplay.className = `stock-display-val ${remainingStock === 0 ? 'zero' : ''}`;
    }
    
    modal.classList.add("open");
    
    // Confetti cannons & Web Audio celebration
    playCelebrationSound();
    initConfetti();
    
    const keepBtn = document.getElementById("winnerKeepBtn");
    const cancelBtn = document.getElementById("winnerCancelBtn");
    
    // Choice button handlers
    const handleClose = () => {
        modal.classList.remove("open");
        stopConfetti();
        
        // Shift queue if active
        if (participantQueue.length > 0) {
            participantQueue.shift();
            saveState();
            renderQueueList();
        } else {
            // Clear recipient name input for the next draw
            recipientInput.value = "";
        }
        
        // Clean handlers
        keepBtn.onclick = null;
        cancelBtn.onclick = null;
    };
    
    keepBtn.onclick = () => handleClose();
    
    cancelBtn.onclick = () => {
        // Rollback state from snapshots
        items = itemsSnapshot;
        winnersHistory = historySnapshot;
        participantQueue = queueSnapshot;
        
        saveState();
        
        // Refresh UIs
        renderItemsList();
        renderWinnersHistory();
        renderQueueList();
        updateCounts();
        drawWheel();
        
        modal.classList.remove("open");
        stopConfetti();
        
        // Clean handlers
        keepBtn.onclick = null;
        cancelBtn.onclick = null;
    };
}

// --- Fisher-Yates Item Randomizer ---
function shuffleWheelItems() {
    if (isSpinning || items.length === 0) return;
    
    // Card ruffle audio feedback
    playShuffleSound();
    
    // Shuffle the master array
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    
    saveState();
    renderItemsList();
    drawWheel();
}

// --- Custom Confetti Particle System ---
let isSpawningConfetti = false;
let confettiSpawnTimer = null;

function initConfetti() {
    const canvas = document.getElementById("confettiCanvas");
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    
    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    
    confettiParticles = [];
    const colors = ["#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#10b981", "#3b82f6", "#ffffff"];
    
    const addCannonBlast = (startX, startY, angleDeg, isInitial = false) => {
        const count = isInitial ? 90 : 4; // Dense initial blast, smaller continuous stream
        const angleRad = angleDeg * Math.PI / 180;
        
        for (let i = 0; i < count; i++) {
            const speed = isInitial ? (16 + Math.random() * 26) : (10 + Math.random() * 18);
            const spreadAngle = angleRad + (Math.random() - 0.5) * 0.45;
            
            confettiParticles.push({
                x: startX,
                y: startY,
                size: 6 + Math.random() * 10,
                color: colors[Math.floor(Math.random() * colors.length)],
                shape: Math.random() > 0.5 ? "circle" : "square",
                vx: Math.cos(spreadAngle) * speed,
                vy: Math.sin(spreadAngle) * speed,
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10,
                opacity: 1,
                gravity: 0.32,
                friction: 0.96
            });
        }
    };
    
    // Initial blast
    addCannonBlast(-20, canvas.height + 20, -55, true);
    addCannonBlast(canvas.width + 20, canvas.height + 20, -125, true);
    
    // Set up continuous spawning for 5 seconds
    isSpawningConfetti = true;
    if (confettiSpawnTimer) clearInterval(confettiSpawnTimer);
    
    confettiSpawnTimer = setInterval(() => {
        if (isSpawningConfetti) {
            // Left cannon stream
            addCannonBlast(-20, canvas.height + 20, -50, false);
            // Right cannon stream
            addCannonBlast(canvas.width + 20, canvas.height + 20, -130, false);
            
            // Shower from top center
            for (let i = 0; i < 2; i++) {
                confettiParticles.push({
                    x: Math.random() * canvas.width,
                    y: -10,
                    size: 5 + Math.random() * 8,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    shape: Math.random() > 0.5 ? "circle" : "square",
                    vx: (Math.random() - 0.5) * 4,
                    vy: 2 + Math.random() * 5,
                    rotation: Math.random() * 360,
                    rotationSpeed: (Math.random() - 0.5) * 8,
                    opacity: 1,
                    gravity: 0.25,
                    friction: 0.98
                });
            }
        }
    }, 100);
    
    // Stop spawning after 5 seconds (5000ms)
    setTimeout(() => {
        isSpawningConfetti = false;
        if (confettiSpawnTimer) {
            clearInterval(confettiSpawnTimer);
            confettiSpawnTimer = null;
        }
    }, 5000);
    
    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let active = false;
        
        for (let i = 0; i < confettiParticles.length; i++) {
            const p = confettiParticles[i];
            
            p.vx *= p.friction;
            p.vy *= p.friction;
            p.vy += p.gravity;
            
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;
            
            // Slow fade out after falling down a bit
            if (p.vy > 0.5) {
                p.opacity -= 0.007; // Slower fade out
            }
            
            if (p.opacity > 0 && p.y < canvas.height && p.x > -50 && p.x < canvas.width + 50) {
                active = true;
                
                ctx.save();
                ctx.globalAlpha = p.opacity;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation * Math.PI / 180);
                ctx.fillStyle = p.color;
                
                if (p.shape === "circle") {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size / 2, 0, 2 * Math.PI);
                    ctx.fill();
                } else {
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                }
                ctx.restore();
            }
        }
        
        // Keep animating if there are active particles or we are still spawning
        if (active || isSpawningConfetti) {
            confettiAnimationId = requestAnimationFrame(animateParticles);
        }
    }
    
    if (confettiAnimationId) cancelAnimationFrame(confettiAnimationId);
    animateParticles();
}

function stopConfetti() {
    isSpawningConfetti = false;
    if (confettiSpawnTimer) {
        clearInterval(confettiSpawnTimer);
        confettiSpawnTimer = null;
    }
    if (confettiAnimationId) {
        cancelAnimationFrame(confettiAnimationId);
        confettiAnimationId = null;
    }
    const canvas = document.getElementById("confettiCanvas");
    if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// --- Items List Render & Operations ---
function renderItemsList() {
    const list = document.getElementById("participantsList");
    const emptyState = document.getElementById("emptyListMessage");
    
    if (!list) return;
    
    list.innerHTML = "";
    
    if (items.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    } else {
        emptyState.classList.add("hidden");
    }
    
    items.forEach((item, index) => {
        const li = document.createElement("li");
        
        if (item.stock === 0) {
            li.classList.add("low-stock");
        }
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "item-name";
        nameSpan.textContent = item.name;
        
        const stockWrapper = document.createElement("div");
        stockWrapper.className = "stock-control-wrapper";
        
        const minusBtn = document.createElement("button");
        minusBtn.className = "stock-adj-btn";
        minusBtn.textContent = "-";
        minusBtn.title = "Deduct Stock";
        minusBtn.onclick = () => adjustStock(index, -1);
        
        const stockVal = document.createElement("span");
        stockVal.className = `stock-display-val ${item.stock === 0 ? 'zero' : ''}`;
        stockVal.textContent = item.stock;
        
        const plusBtn = document.createElement("button");
        plusBtn.className = "stock-adj-btn";
        plusBtn.textContent = "+";
        plusBtn.title = "Replenish Stock";
        plusBtn.onclick = () => adjustStock(index, 1);
        
        stockWrapper.appendChild(minusBtn);
        stockWrapper.appendChild(stockVal);
        stockWrapper.appendChild(plusBtn);
        
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "item-actions";
        
        const editBtn = document.createElement("button");
        editBtn.className = "action-btn edit-btn";
        editBtn.title = "Edit Item";
        editBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
        `;
        editBtn.onclick = () => openEditModal(index);
        
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "action-btn delete-btn";
        deleteBtn.title = "Delete Item";
        deleteBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        `;
        deleteBtn.onclick = () => deleteItem(index);
        
        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);
        
        li.appendChild(nameSpan);
        li.appendChild(stockWrapper);
        li.appendChild(actionsDiv);
        
        list.appendChild(li);
    });
}

function adjustStock(index, delta) {
    if (isSpinning) return;
    
    const newStock = items[index].stock + delta;
    if (newStock >= 0 && newStock <= 9999) {
        items[index].stock = newStock;
        
        const shouldRemoveOnZero = document.getElementById("removeWinnerToggle").checked;
        if (shouldRemoveOnZero && newStock === 0) {
            items.splice(index, 1);
        }
        
        saveState();
        renderItemsList();
        updateCounts();
        drawWheel();
    }
}

function deleteItem(index) {
    if (isSpinning) return;
    items.splice(index, 1);
    saveState();
    renderItemsList();
    updateCounts();
    drawWheel();
}

// Draw History logs
function renderWinnersHistory() {
    const list = document.getElementById("historyList");
    const emptyState = document.getElementById("emptyHistoryMessage");
    
    if (!list) return;
    
    list.innerHTML = "";
    
    if (winnersHistory.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    } else {
        emptyState.classList.add("hidden");
    }
    
    winnersHistory.forEach((item, index) => {
        const li = document.createElement("li");
        
        const infoDiv = document.createElement("div");
        infoDiv.className = "winner-info";
        
        const titleSpan = document.createElement("span");
        titleSpan.className = "winner-title";
        titleSpan.textContent = item.name;
        
        const recipientSpan = document.createElement("span");
        recipientSpan.className = "winner-recipient";
        recipientSpan.style.fontSize = "0.8rem";
        recipientSpan.style.color = "var(--gold-primary)";
        recipientSpan.style.marginTop = "0.15rem";
        recipientSpan.textContent = `Drawn by: ${item.recipient || "Anonymous"}`;
        
        const timeSpan = document.createElement("span");
        timeSpan.className = "winner-time";
        timeSpan.textContent = item.time;
        
        infoDiv.appendChild(titleSpan);
        infoDiv.appendChild(recipientSpan);
        infoDiv.appendChild(timeSpan);
        
        const badge = document.createElement("span");
        badge.className = "winner-badge";
        badge.textContent = `#${winnersHistory.length - index}`;
        
        li.appendChild(infoDiv);
        li.appendChild(badge);
        
        list.appendChild(li);
    });
}
// --- Participant Queue Render & Operations ---
function renderQueueList() {
    const list = document.getElementById("queueList");
    const emptyState = document.getElementById("emptyQueueMessage");
    const countSpan = document.getElementById("queueCount");
    const recipientInput = document.getElementById("recipientNameInput");
    
    if (!list) return;
    
    list.innerHTML = "";
    
    const count = participantQueue.length;
    countSpan.textContent = count;
    
    if (count === 0) {
        emptyState.classList.remove("hidden");
        recipientInput.value = "";
        recipientInput.readOnly = false;
        return;
    } else {
        emptyState.classList.add("hidden");
        recipientInput.value = participantQueue[0];
        recipientInput.readOnly = false; // Keep editable so user can modify directly
    }
    
    participantQueue.forEach((name, index) => {
        const li = document.createElement("li");
        li.className = "queue-item";
        li.draggable = true; // Enable Drag and Drop
        
        if (index === 0) {
            li.classList.add("queue-active");
        }
        
        // HTML5 Drag & Drop Event Listeners
        li.addEventListener("dragstart", (e) => {
            if (isSpinning) {
                e.preventDefault();
                return;
            }
            draggedIndex = index;
            li.classList.add("dragging");
            list.classList.add("dragging-active");
            e.dataTransfer.effectAllowed = "move";
        });
        
        li.addEventListener("dragover", (e) => {
            if (draggedIndex !== index) {
                e.preventDefault();
                const rect = li.getBoundingClientRect();
                const relY = e.clientY - rect.top;
                if (relY < rect.height / 2) {
                    li.classList.add("drag-over-top");
                    li.classList.remove("drag-over-bottom");
                } else {
                    li.classList.add("drag-over-bottom");
                    li.classList.remove("drag-over-top");
                }
            }
        });
        
        li.addEventListener("dragleave", () => {
            li.classList.remove("drag-over-top", "drag-over-bottom");
        });
        
        li.addEventListener("drop", (e) => {
            e.preventDefault();
            li.classList.remove("drag-over-top", "drag-over-bottom");
            if (draggedIndex !== null && draggedIndex !== index) {
                const rect = li.getBoundingClientRect();
                const relY = e.clientY - rect.top;
                const insertAfter = relY >= rect.height / 2;
                
                const draggedItem = participantQueue[draggedIndex];
                const targetItem = participantQueue[index];
                
                // Remove the dragged item
                participantQueue.splice(draggedIndex, 1);
                
                // Find where target item is now
                const newTargetIndex = participantQueue.indexOf(targetItem);
                
                // Calculate target insertion index
                const finalIndex = insertAfter ? newTargetIndex + 1 : newTargetIndex;
                participantQueue.splice(finalIndex, 0, draggedItem);
                
                saveState();
                renderQueueList();
            }
        });
        
        li.addEventListener("dragend", () => {
            li.classList.remove("dragging");
            list.classList.remove("dragging-active");
            draggedIndex = null;
            document.querySelectorAll(".queue-item").forEach(item => {
                item.classList.remove("drag-over-top", "drag-over-bottom");
            });
        });
        
        const badge = document.createElement("span");
        badge.className = "queue-index-badge";
        badge.textContent = index + 1;
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "queue-name";
        nameSpan.textContent = name;
        if (index === 0) {
            nameSpan.textContent += " (Active)";
        }
        
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "item-actions";
        
        // Edit Button
        const editBtn = document.createElement("button");
        editBtn.className = "action-btn edit-btn";
        editBtn.title = "Edit Participant Name";
        editBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
        `;
        editBtn.onclick = (e) => {
            e.stopPropagation(); // Stop drag event from firing
            const newName = prompt("Edit Participant Name:", name);
            if (newName !== null) {
                const trimmed = newName.trim();
                if (trimmed) {
                    participantQueue[index] = trimmed;
                    saveState();
                    renderQueueList();
                }
            }
        };
        
        // Move / Position Edit Button
        const posBtn = document.createElement("button");
        posBtn.className = "action-btn pos-btn";
        posBtn.title = "Change Position Urutan";
        posBtn.style.color = "var(--gold-primary)";
        posBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="8 17 12 21 16 17"></polyline>
                <polyline points="8 7 12 3 16 7"></polyline>
                <line x1="12" y1="3" x2="12" y2="21"></line>
            </svg>
        `;
        posBtn.onclick = (e) => {
            e.stopPropagation(); // Stop drag event from firing
            const posStr = prompt(`Enter new position for "${name}" (1 to ${participantQueue.length}):`, index + 1);
            if (posStr !== null) {
                const newPos = parseInt(posStr);
                if (!isNaN(newPos) && newPos >= 1 && newPos <= participantQueue.length) {
                    const targetIndex = newPos - 1;
                    if (targetIndex !== index) {
                        const item = participantQueue[index];
                        participantQueue.splice(index, 1);
                        participantQueue.splice(targetIndex, 0, item);
                        saveState();
                        renderQueueList();
                    }
                } else {
                    alert(`Invalid position! Please enter a number between 1 and ${participantQueue.length}.`);
                }
            }
        };
        
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "action-btn delete-btn";
        deleteBtn.title = "Remove from Queue";
        deleteBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        `;
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); // Stop drag event from firing
            removeFromQueue(index);
        };
        
        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(posBtn);
        actionsDiv.appendChild(deleteBtn);
        
        li.appendChild(badge);
        li.appendChild(nameSpan);
        li.appendChild(actionsDiv);
        
        list.appendChild(li);
    });
}

function removeFromQueue(index) {
    if (isSpinning) return;
    participantQueue.splice(index, 1);
    saveState();
    renderQueueList();
}

function shuffleQueue() {
    if (isSpinning || participantQueue.length === 0) return;
    playShuffleSound();
    for (let i = participantQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [participantQueue[i], participantQueue[j]] = [participantQueue[j], participantQueue[i]];
    }
    saveState();
    renderQueueList();
}

function updateCounts() {
    const count = items.length;
    const partCount = document.getElementById("participantCount");
    if (partCount) partCount.textContent = count;
    const mobilePartCount = document.getElementById("mobilePartCount");
    if (mobilePartCount) mobilePartCount.textContent = count;
}

// --- CSV Exporter ---
function exportHistoryToCsv() {
    if (winnersHistory.length === 0) {
        alert("No draw history to export!");
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Index,Item Name,Participant Name,Draw Timestamp\n";
    
    winnersHistory.forEach((item, index) => {
        const idx = winnersHistory.length - index;
        const escapedItemName = item.name.replace(/"/g, '""');
        const escapedRecipientName = (item.recipient || "Anonymous").replace(/"/g, '""');
        csvContent += `${idx},"${escapedItemName}","${escapedRecipientName}","${item.time}"\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SpinWheel_Draw_History_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
}

// --- Modals Management ---
function openModal(modalId) {
    document.getElementById(modalId).classList.add("open");
}

// Unified modal close
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove("open");
}

function openEditModal(index) {
    document.getElementById("editParticipantIndex").value = index;
    document.getElementById("editParticipantInput").value = items[index].name;
    document.getElementById("editStockInput").value = items[index].stock;
    openModal("editModal");
}

// --- Event Listeners Handler ---
function initEventListeners() {
    // Spin Controls
    document.getElementById("spinBtn").addEventListener("click", () => {
        spinWheel();
    });
    
    // Shuffle Controls
    document.getElementById("shuffleBtn").addEventListener("click", () => {
        shuffleWheelItems();
    });
    
    // Sound Toggle
    document.getElementById("soundToggleBtn").addEventListener("click", () => {
        soundEnabled = !soundEnabled;
        updateSoundIcon();
        saveState();
        ensureAudioContext();
    });
    
    // Add Item Form submit
    document.getElementById("addParticipantForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const nameInput = document.getElementById("newParticipantInput");
        const stockInput = document.getElementById("newStockInput");
        
        const name = nameInput.value.trim();
        const stock = parseInt(stockInput.value);
        
        if (name && !isNaN(stock)) {
            if (items.length >= 100) {
                alert("Maximum limit of 100 items reached!");
                return;
            }
            items.push({ name, stock: Math.max(0, stock) });
            nameInput.value = "";
            stockInput.value = "5";
            
            saveState();
            renderItemsList();
            updateCounts();
            drawWheel();
        }
    });
    
    // Reset List
    document.getElementById("resetParticipantsBtn").addEventListener("click", () => {
        if (confirm("Are you sure you want to reset the item list back to default configuration?")) {
            items = JSON.parse(JSON.stringify(DEFAULT_ITEMS));
            saveState();
            renderItemsList();
            updateCounts();
            drawWheel();
        }
    });
    
    // Duration Slider
    const durationSlider = document.getElementById("durationSlider");
    const durationValue = document.getElementById("durationValue");
    durationSlider.addEventListener("input", (e) => {
        const val = e.target.value;
        spinDuration = val * 1000;
        durationValue.textContent = `${val}s`;
    });
    
    // CSV Export
    document.getElementById("exportCsvBtn").addEventListener("click", exportHistoryToCsv);
    
    // Clear History
    document.getElementById("clearHistoryBtn").addEventListener("click", () => {
        if (confirm("Are you sure you want to clear the draw history?")) {
            winnersHistory = [];
            saveState();
            renderWinnersHistory();
        }
    });
    
    // Bulk Import Open
    const bulkImportBtn = document.getElementById("bulkImportBtn");
    bulkImportBtn.addEventListener("click", () => {
        const listText = items.map(item => `${item.name}, ${item.stock}`).join("\n");
        document.getElementById("bulkNamesTextarea").value = listText;
        updateTextareaLineCount();
        openModal("bulkImportModal");
    });
    
    // Textarea Line Count tracking
    const textarea = document.getElementById("bulkNamesTextarea");
    textarea.addEventListener("input", updateTextareaLineCount);
    
    function updateTextareaLineCount() {
        const text = textarea.value;
        const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        document.getElementById("textareaLineCount").textContent = lines.length;
    }
    
    // Submit Bulk Import
    document.getElementById("importSubmitBtn").addEventListener("click", () => {
        const text = textarea.value;
        const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        
        if (lines.length > 100) {
            alert("Maximum limit is 100 items! Please reduce your list.");
            return;
        }
        
        const importedItems = [];
        lines.forEach(line => {
            if (line.includes(",")) {
                const parts = line.split(",");
                const name = parts[0].trim();
                let stock = parseInt(parts[1].trim());
                if (isNaN(stock) || stock < 0) stock = 5;
                
                if (name) {
                    importedItems.push({ name, stock });
                }
            } else {
                importedItems.push({ name: line, stock: 5 });
            }
        });
        
        items = importedItems;
        saveState();
        renderItemsList();
        updateCounts();
        drawWheel();
        closeModal("bulkImportModal");
    });
    
    // Save Edit Item Modal Form
    document.getElementById("editForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const index = parseInt(document.getElementById("editParticipantIndex").value);
        const name = document.getElementById("editParticipantInput").value.trim();
        const stock = parseInt(document.getElementById("editStockInput").value);
        
        if (name && !isNaN(stock)) {
            items[index].name = name;
            items[index].stock = Math.max(0, stock);
            
            const shouldRemoveOnZero = document.getElementById("removeWinnerToggle").checked;
            if (shouldRemoveOnZero && items[index].stock === 0) {
                items.splice(index, 1);
            }
            
            saveState();
            renderItemsList();
            drawWheel();
            updateCounts();
            closeModal("editModal");
        }
    });

    // Real-time stock toggle update
    document.getElementById("removeWinnerToggle").addEventListener("change", () => {
        saveState();
        renderItemsList();
        drawWheel();
        updateCounts();
    });

    // Real-time update from "Draw for Participant" input field into Queue
    const recipientInput = document.getElementById("recipientNameInput");
    recipientInput.addEventListener("input", () => {
        const val = recipientInput.value.trim();
        if (participantQueue.length > 0) {
            participantQueue[0] = val; // update first element of queue
            saveState();
            
            // Dynamically update the first queue item name text in DOM directly to avoid losing focus
            const activeQueueName = document.querySelector("#queueList .queue-active .queue-name");
            if (activeQueueName) {
                activeQueueName.textContent = (val || "Active Player") + " (Active)";
            }
        }
    });

    // Interactive Aurora Parallax effect on mousemove
    document.addEventListener("mousemove", (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 45; // Max 45px translation
        const y = (e.clientY / window.innerHeight - 0.5) * 45;
        document.documentElement.style.setProperty('--bg-tilt-x', `${x}px`);
        document.documentElement.style.setProperty('--bg-tilt-y', `${y}px`);
    });

    // Participant Queue Import Open
    const importQueueBtn = document.getElementById("importQueueBtn");
    const queueTextarea = document.getElementById("queueNamesTextarea");
    
    function updateQueueTextareaCount() {
        const text = queueTextarea.value;
        const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        document.getElementById("textareaQueueCount").textContent = lines.length;
    }

    importQueueBtn.addEventListener("click", () => {
        const queueText = participantQueue.join("\n");
        queueTextarea.value = queueText;
        updateQueueTextareaCount();
        openModal("queueImportModal");
    });
    
    // Textarea Line Count tracking for Queue
    queueTextarea.addEventListener("input", updateQueueTextareaCount);
    
    // Submit Queue Import
    document.getElementById("queueImportSubmitBtn").addEventListener("click", () => {
        const text = queueTextarea.value;
        const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        
        participantQueue = lines;
        saveState();
        renderQueueList();
        closeModal("queueImportModal");
    });
    
    // Single Participant Queue Addition Form Submit
    document.getElementById("addQueueMemberForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const nameInput = document.getElementById("newQueueNameInput");
        const posInput = document.getElementById("newQueuePosInput");
        
        const name = nameInput.value.trim();
        const posVal = posInput.value.trim();
        
        if (name) {
            if (participantQueue.length >= 100) {
                alert("Participant Queue limit reached! Max 100 people.");
                return;
            }
            
            if (posVal) {
                const pos = parseInt(posVal);
                if (!isNaN(pos) && pos >= 1) {
                    const targetIndex = Math.min(pos - 1, participantQueue.length);
                    participantQueue.splice(targetIndex, 0, name);
                } else {
                    participantQueue.push(name);
                }
            } else {
                participantQueue.push(name);
            }
            
            // Clear inputs
            nameInput.value = "";
            posInput.value = "";
            
            saveState();
            renderQueueList();
        }
    });
    
    // Shuffle Queue
    document.getElementById("shuffleQueueBtn").addEventListener("click", () => {
        shuffleQueue();
    });
    
    // Clear Queue
    document.getElementById("clearQueueBtn").addEventListener("click", () => {
        if (confirm("Are you sure you want to clear the participant queue?")) {
            participantQueue = [];
            saveState();
            renderQueueList();
        }
    });
    
    // Cancel & Close buttons for modals
    document.querySelectorAll(".modal-close-btn, .modal-cancel-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const overlay = e.target.closest(".modal-overlay");
            if (overlay) overlay.classList.remove("open");
            stopConfetti(); 
        });
    });
    
    // Close modal by clicking outside
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                if (!overlay.classList.contains("winner-celebration-overlay")) {
                    overlay.classList.remove("open");
                }
            }
        });
    });
    
    // Carousel Slide Navigation Swapper (Draw Arena vs Manage Inventory)
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const currentBtn = e.currentTarget;
            const slideIndex = parseInt(currentBtn.getAttribute("data-slide"));
            const slidesContainer = document.getElementById("slidesContainer");
            
            // Toggle active button states
            document.querySelectorAll(".nav-tab-btn").forEach(b => b.classList.remove("active"));
            currentBtn.classList.add("active");
            
            // Translate the container to reveal targeted slide pane
            slidesContainer.style.transform = `translateX(-${slideIndex * 50}%)`;
            
            // Redraw wheel canvas if switching to the wheel slide arena to ensure bounds recalculate
            if (slideIndex === 0) {
                setTimeout(() => {
                    setupCanvas();
                    drawWheel();
                }, 120); 
            }
        });
    });
}
