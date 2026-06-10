# Dupoin Futures Indonesia - Official Lucky Draw Platform

A premium, casino-style interactive **Spin Wheel** lucky draw web application tailored for **Dupoin Futures Indonesia**, featuring a hardware-accelerated 2-slide carousel, real-time inventory count integration, an automated participant draw queue, and synthesized sound effects.

## 🌟 Live Demo
Host this project easily on **Vercel**, **Netlify**, or **GitHub Pages** by simply deploying the directory.

## ✨ Features
1. **Draw Arena (Slide 1)**:
   * **Luxurious Canvas Wheel**: Clean rendering with radial lighting, concentric gold borders, speed-synced LED marquee chasing lights, and realistic physics easing.
   * **Participant Queue ("Antrian Draw")**: Paste participant columns directly from Microsoft Excel or text files. The queue auto-fills the active player and advances after each draw.
   * **Shuffle Controls**: Shuffle the wheel segments or the queue with rapid card-ruffling synthesizer sounds.
   * **Real-time Stock Filter**: Toggle "Remove if stock 0" to instantly show or hide out-of-stock items on the wheel in real-time.
   * **Celebration & Confetti**: Interactive modal with custom-drawn canvas particle confetti and Web Audio API major arpeggio fanfare sound.
   * **Draw History**: View chronological logs of winners with corresponding participant names and download as CSV.

2. **Inventory Room (Slide 2)**:
   * **Master Inventory List**: Inline stock replenishing/deducting controllers, item edit modal, and item removal.
   * **Bulk Importer**: Import items individually or load a comma-separated list of items with their initial stock levels.

3. **Responsive Geometry**:
   * Desktop layout locks elements to viewport heights to prevent vertical scrollbars on standard displays.
   * Wheel uses height-derived responsive scaling to maintain a perfect square aspect ratio (no squashing).
   * Automatically switches to a fluid, scrollable layout on tablets and mobile screens.

## 🛠️ Technology Stack
- **Structure**: Vanilla HTML5 (semantic markers)
- **Styling**: Modern CSS3 (CSS Custom Properties, Glassmorphic overlays, flex grids)
- **Engine Logic**: Vanilla JavaScript (ES6+, Custom Canvas rendering, Fisher-Yates array shuffler)
- **Audio synthesis**: Web Audio API (Synthesizers for ticks, ruffles, and fanfares; completely offline, zero static audio files)
- **Confetti**: Canvas Confetti System (Math-derived vectors and gravity physics)

## 🚀 How to Run Locally
1. Clone this repository:
   ```bash
   git clone https://github.com/farhan-cen/spinwheel.git
   ```
2. Double-click `index.html` to open it directly in any web browser, or serve it via a local environment like XAMPP Apache:
   ```
   http://localhost/spinwheel/
   ```
