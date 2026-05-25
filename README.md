# AI Based Deepfake Detection

An interactive forensic tool to analyze video, images, audio, and text offline and online using local machine learning models and server-side semantic analysis. Built with a React + Vite frontend, an Express backend, and integrated with the Google GenAI and NVIDIA Inference APIs.

## 🚀 Features

- **Dashboard Layout:** A clean, sidebar-navigated workspace for switching between different analytical modules.
- **Text Analysis:** Evaluate documents, text metadata, or threat-based contexts using semantic intelligence.
- **Vision Analysis:** Perform structural forensic checks on uploaded images.
- **Video Analysis:** Run complex multi-frame and contextual lookups on video data payloads.
- **Audio Analysis:** Process voice or recorded clips for audio-based forensics.
- **Autonomous Assistant:** Interact with an integrated AI agent capable of synthesizing observations across multi-modal forensics.

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS (v4), React Router DOM (v7), Recharts, Lucide React, Motion (Framer Motion).
- **Backend:** Express, Node.js, TypeScript via `tsx`.
- **AI/ML Integrations:** - `@google/genai` (Server-side Gemini processing)
  - `openai` SDK (Configured for NVIDIA Integrate API endpoints)
  - `@xenova/transformers` (In-browser/local lightweight ML processing)
- **Bundler/Compiler:** Esbuild & Vite.

## 📁 Project Structure

```text
├── src/
│   ├── layouts/
│   │   └── DashboardLayout.tsx      # Sidebar and main frame skeleton
│   ├── pages/
│   │   ├── Dashboard.tsx            # Main overview metrics and landing
│   │   ├── TextAnalysis.tsx         # Text & document analysis panel
│   │   ├── VisionAnalysis.tsx       # Structural image forensics
│   │   ├── VideoAnalysis.tsx        # Video parsing and context tracking
│   │   ├── AudioAnalysis.tsx        # Voice/Sound frequency & content analysis
│   │   └── AutonomousAssistant.tsx  # Interactive AI-forensic assistant
│   └── lib/
│       └── nvidiaApi.ts             # Helper handlers for multi-modal URIs
├── App.tsx                          # React client routing definitions
├── server.ts                        # Express server entrypoint & API middleware
├── vite.config.ts                   # Custom Vite bundler adjustments
├── package.json                     # System scripts & project dependencies
└── .env                             # Environment credential definitions

```

## ⚙️ Prerequisites

Ensure you have the following installed on your local environment:

* **Node.js:** `v18.x` or higher
* **npm** or **yarn**

## 🔧 Installation & Setup

1. **Clone the repository and navigate to the root directory:**
```bash
cd forensic-video-image-analyzer

```


2. **Install project dependencies:**
```bash
npm install

```


3. **Configure Environment Variables:**
Duplicate the `.env.example` file and rename it to `.env`:
```bash
cp .env.example .env

```


Open `.env` and fill in your respective API credentials:
```env
GEMINI_API_KEY="YOUR_ACTUAL_GEMINI_API_KEY"
NVIDIA_OPENAI_API_KEY="YOUR_NVIDIA_INTEGRATE_API_KEY"
NVIDIA_OPENAI_BASE_URL="[https://integrate.api.nvidia.com/v1](https://integrate.api.nvidia.com/v1)"
APP_URL="http://localhost:3000"

```



## 🖥️ Running the Application

### Development Mode

Runs both the backend Express router and the Vite client compilation with hot reloading natively managed via `tsx`:

```bash
npm run dev

```

Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) in your web browser. (If port `3000` is occupied, the backend automatically increments and safely binds to the next available port).

### Production Build

To test the fully optimized bundles running out of a production static server layout:

1. **Build the production assets:**
```bash
npm run build

```


*This compiles the client-side SPA into the `/dist` directory and bundles `server.ts` into a CommonJS server format using `esbuild`.*
2. **Start the production server:**
```bash
npm run start

```



### Other Scripts

* **Preview Production Assets:** `npm run preview`
* **Lint Codebase:** `npm run lint`
* **Clean Dist Artifacts:** `npm run clean`

## 🔒 Permissions & Security

As detailed in `metadata.json`, this application safely requests client-side browser capabilities for:

* `camera` (Optional real-time image capture for quick forensics)
* `microphone` (Optional real-time audio sample verification)

*Note: Large media structures (up to 200MB payloads) are securely managed on the Express routing middleware layers inside `server.ts` to allow direct in-memory handling of high-resolution base64 video/audio streams.*

```

```