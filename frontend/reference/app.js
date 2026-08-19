/* ==========================================================================
   RETRO WAVE ARCADE - MAIN APPLICATION CONTROLLER
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Element References
  const themeSelect = document.getElementById('themeSelect');
  const crtToggle = document.getElementById('crtToggle');
  const crtOverlay = document.getElementById('crtOverlay');
  const crtScreen = document.getElementById('crtScreen');
  
  const playBtn = document.getElementById('playAudioBtn');
  const nextBtn = document.getElementById('nextAudioBtn');
  const muteBtn = document.getElementById('muteAudioBtn');
  const currentTrackLabel = document.getElementById('currentTrackLabel');
  
  const tabSpace = document.getElementById('tabSpace');
  const tabSnake = document.getElementById('tabSnake');

  const stickyInput = document.getElementById('stickyInput');
  const addStickyBtn = document.getElementById('addStickyBtn');
  const stickyWall = document.getElementById('stickyWall');

  const digitalClock = document.getElementById('digitalClock');

  /* ------------------------------------------------------------------------
     1. THEME SELECTION & CRT CONTROLS
     ------------------------------------------------------------------------ */
  const themeRadios = document.querySelectorAll('#color-scheme input[name="theme-radio"]');

  const applyTheme = (themeName) => {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('retro_theme', themeName);
    
    if (themeSelect) themeSelect.value = themeName;
    
    const targetRadio = document.querySelector(`#color-scheme input[value="${themeName}"]`);
    if (targetRadio) targetRadio.checked = true;

    if (window.retroAudio) window.retroAudio.playUiBeep(880, 0.05);
  };

  if (themeRadios.length > 0) {
    themeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          applyTheme(e.target.value);
        }
      });
    });
  }

  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      applyTheme(e.target.value);
    });
  }

  // Theme Popover Menu Toggle
  const themeModalBtn = document.getElementById('themeModalBtn');
  const themePopoverMenu = document.getElementById('themePopoverMenu');

  if (themeModalBtn && themePopoverMenu) {
    themeModalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = themePopoverMenu.classList.toggle('active');
      themeModalBtn.classList.toggle('active', isActive);
      if (window.retroAudio) window.retroAudio.playUiBeep(isActive ? 960 : 480, 0.05);
    });

    document.addEventListener('click', (e) => {
      if (!themePopoverMenu.contains(e.target) && !themeModalBtn.contains(e.target)) {
        themePopoverMenu.classList.remove('active');
        themeModalBtn.classList.remove('active');
      }
    });
  }

  // Load saved theme on startup
  const savedTheme = localStorage.getItem('retro_theme') || 'synthwave';
  applyTheme(savedTheme);

  if (crtToggle && crtOverlay && crtScreen) {
    crtToggle.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      crtOverlay.style.display = isEnabled ? 'block' : 'none';
      if (isEnabled) {
        crtScreen.classList.add('crt-curved');
      } else {
        crtScreen.classList.remove('crt-curved');
      }
      localStorage.setItem('retro_crt', isEnabled ? 'true' : 'false');
      if (window.retroAudio) window.retroAudio.playUiBeep(440, 0.05);
    });

    const savedCrt = localStorage.getItem('retro_crt');
    if (savedCrt === 'false') {
      crtToggle.checked = false;
      crtOverlay.style.display = 'none';
      crtScreen.classList.remove('crt-curved');
    }
  }

  /* ------------------------------------------------------------------------
     2. AUDIO SYNTH PLAYER BOOMBOX
     ------------------------------------------------------------------------ */
  if (playBtn && window.retroAudio) {
    playBtn.addEventListener('click', () => {
      const playing = window.retroAudio.togglePlay();
      playBtn.innerText = playing ? 'PAUSE' : 'PLAY';
      playBtn.style.background = playing ? 'var(--accent-pink)' : 'var(--btn-bg)';
    });
  }

  if (nextBtn && window.retroAudio) {
    nextBtn.addEventListener('click', () => {
      const trackName = window.retroAudio.nextTrack();
      if (currentTrackLabel) currentTrackLabel.innerText = trackName;
      window.retroAudio.playUiBeep(1200, 0.08);
    });
  }

  if (muteBtn && window.retroAudio) {
    muteBtn.addEventListener('click', () => {
      window.retroAudio.muted = !window.retroAudio.muted;
      muteBtn.innerText = window.retroAudio.muted ? 'UNMUTE' : 'MUTE';
    });
  }

  // Spectrum Bar Animation Callback
  window.updateSpectrumBars = () => {
    const bars = document.querySelectorAll('.spectrum-bar');
    bars.forEach(bar => {
      const randomHeight = Math.floor(Math.random() * 85) + 15;
      bar.style.height = `${randomHeight}%`;
    });
  };

  /* ------------------------------------------------------------------------
     3. ARCADE TAB SWITCHING
     ------------------------------------------------------------------------ */
  if (tabSpace && tabSnake) {
    tabSpace.addEventListener('click', () => {
      tabSpace.classList.add('active');
      tabSnake.classList.remove('active');
      if (window.arcadeInstance) window.arcadeInstance.setGame('space');
      if (window.retroAudio) window.retroAudio.playUiBeep(520, 0.05);
    });

    tabSnake.addEventListener('click', () => {
      tabSnake.classList.add('active');
      tabSpace.classList.remove('active');
      if (window.arcadeInstance) window.arcadeInstance.setGame('snake');
      if (window.retroAudio) window.retroAudio.playUiBeep(520, 0.05);
    });
  }

  /* ------------------------------------------------------------------------
     4. STICKY NOTES & GUESTBOOK WIDGET
     ------------------------------------------------------------------------ */
  const defaultNotes = [
    "Welcome to the Retro Arcade! Press Play to start chiptunes!",
    "High score challenge: Can you beat 1,000 pts in Space Defender?",
    "Retro wave visuals inspired by 1984 arcade culture!"
  ];

  const loadStickyNotes = () => {
    const saved = localStorage.getItem('retro_sticky_notes');
    return saved ? JSON.parse(saved) : defaultNotes;
  };

  const renderStickyNotes = () => {
    if (!stickyWall) return;
    const notes = loadStickyNotes();
    stickyWall.innerHTML = '';
    notes.forEach((text, index) => {
      const noteEl = document.createElement('div');
      noteEl.className = 'sticky-note';
      noteEl.innerHTML = `
        <span class="delete-btn" data-index="${index}">&times;</span>
        <p>${escapeHtml(text)}</p>
      `;
      stickyWall.appendChild(noteEl);
    });

    // Attach delete listeners
    document.querySelectorAll('.sticky-note .delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        const notes = loadStickyNotes();
        notes.splice(idx, 1);
        localStorage.setItem('retro_sticky_notes', JSON.stringify(notes));
        renderStickyNotes();
        if (window.retroAudio) window.retroAudio.playUiBeep(300, 0.05);
      });
    });
  };

  if (addStickyBtn && stickyInput) {
    addStickyBtn.addEventListener('click', () => {
      const val = stickyInput.value.trim();
      if (val) {
        const notes = loadStickyNotes();
        notes.unshift(val);
        localStorage.setItem('retro_sticky_notes', JSON.stringify(notes));
        stickyInput.value = '';
        renderStickyNotes();
        if (window.retroAudio) window.retroAudio.playUiBeep(700, 0.08);
      }
    });
  }

  renderStickyNotes();

  /* ------------------------------------------------------------------------
     5. DIGITAL CLOCK & MOCK SYSTEM STATS
     ------------------------------------------------------------------------ */
  const updateClock = () => {
    if (!digitalClock) return;
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    digitalClock.innerText = `${hrs}:${mins}:${secs}`;
  };
  setInterval(updateClock, 1000);
  updateClock();

  // Random CPU / Memory load meter jitter for retro OS vibe
  setInterval(() => {
    const cpuBar = document.getElementById('cpuBar');
    const memBar = document.getElementById('memBar');
    if (cpuBar) cpuBar.style.width = `${Math.floor(Math.random() * 40) + 30}%`;
    if (memBar) memBar.style.width = `${Math.floor(Math.random() * 20) + 55}%`;
  }, 2500);
});

// Helper XSS Escape
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
