# LexSummarize ⚖️

> Professional legal court order summarization and judgment analysis tool optimized for Indian lawyers.

LexSummarize is a full-stack, visually rich application designed to help legal professionals instantly analyze and summarize complex, multi-page court orders, judgments, and legal petitions. Featuring an elite **Slate & Warm Gold** aesthetic inspired by traditional chamber decor, LexSummarize pairs state-of-the-art AI with robust client-side PDF parsing to save lawyers hours of manual reading.

---

## ✨ Key Features

- **📂 Hybrid Input Modes**
  - **PDF Parser**: Upload full multi-page court orders or PDFs. Parsing is done entirely client-side using `pdfjs-dist` to preserve confidentiality.
  - **Direct Text Input**: Paste raw, unformatted legal texts, petitions, or contracts directly.
- **🔍 Advanced AI Legal Analysis Models**
  - **Standard Court Order Summary**: Dissects Case Name, Jurisdiction, Parties, Advocates/Counsel, Key Facts, Primary Legal Issues, Court's Decision, and Next Steps/Compliance.
  - **FILAC Analysis Method**: Generates a rigorous academic and litigation-focused breakdown covering **Facts, Issues, Law (Rules/Precedents), Analysis, and Conclusion**.
- **📑 Preserved Formatting PDF Export**
  - Generates custom styled, high-quality, branded reports using `jsPDF`.
  - Integrates a sophisticated client-side typographic parser that renders bold (`**text**`), italic (`*text*`), and multi-emphasis (`***text***`) Markdown syntax natively in the exported PDF.
  - Standardizes bullet points (`•`) with custom legal-gold offsets and spacing.
- **🖨️ Direct Chamber Printing**
  - Formatted with a clean `@media print` CSS stylesheet allowing direct, high-contrast black-and-white printouts for offline case folders.
- **🛡️ Enterprise API Key Security**
  - Implements a server-side proxy router (`/api/summarize`) using the modern `@google/genai` SDK.
  - Sensitive API credentials never leave the server or leak to the browser.
  - Interactive **Settings Menu** in the UI allows lawyers to supply their personal Gemini API Key for high-frequency or unrestricted volume.
- **🔄 Fault-Tolerant AI Engine**
  - Built-in **Exponential Backoff and Retry** mechanism handling transient 503 (High Demand) and 429 (Resource Exhausted) errors seamlessly.
  - Smart fallback routing between `gemini-3.5-flash` and `gemini-flash-latest` to maximize response success rates.

---

## 🎨 Design Philosophy

LexSummarize departs from generic, uninspired web templates and adopts a distinguished digital chamber style:
- **Colors**: Deep, elegant slate charcoal (`#0B0F19`) background paired with regal warm-gold accents (`#C5A059`) and pristine off-white typography.
- **Typography**: Paired display typography ("Space Grotesk") for authoritative headers with crisp body copy ("Inter") and technical monospaced details ("JetBrains Mono") for case meta-indicators.
- **Motion**: Fluid, micro-interactive feedback with non-blocking exit/entry transitions powered by `motion/react` to keep the user experience smooth and professional.

---

## 🛠️ Technology Stack

- **Frontend**: [React 18](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/), [Motion/React](https://github.com/motiondivision/motion) (formerly framer-motion)
- **Backend**: [Express](https://expressjs.com/), [tsx](https://github.com/privatenumber/tsx), [esbuild](https://esbuild.github.io/)
- **AI Core**: [@google/genai](https://www.npmjs.com/package/@google/genai) (Gemini Developer SDK)
- **Document Handling**: [pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist) (Client-side extraction), [jsPDF](https://www.npmjs.com/package/jspdf) (Custom report rendering)

---

## ⚙️ Setup & Installation

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** (v9 or higher)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/lexsummarize.git
cd lexsummarize
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory (based on `.env.example`):
```env
GEMINI_API_KEY=your_server_fallback_gemini_api_key
```
*Note: Even without a fallback key configured on the server, users can fully operate the app by pasting their own Gemini API Key in the web interface's Settings panel.*

### 4. Running the App Locally

**Start Development Server (Vite + Express Proxy):**
```bash
npm run dev
```
The server will boot on **http://localhost:3000**. Open your browser and navigate there to start summarizing.

---

## 🏗️ Production Build & Deployment

To build and compile the application for production deployment:

**1. Run the production build command:**
```bash
npm run build
```
This builds the client-side SPA bundle into `dist/` and compiles the TypeScript server into a high-performance CJS file (`dist/server.cjs`) using `esbuild`.

**2. Start the production server:**
```bash
npm start
```
The production server listens on host `0.0.0.0` and port `3000`, perfect for container deployments on platforms like Cloud Run.

---

## 📖 How To Use LexSummarize

1. **Launch Settings (Optional)**: Click the **Gear Icon** in the top right corner. Enter your personal **Gemini API Key** if you intend to process very large files or wish to use your own Google Cloud developer billing quota.
2. **Choose Input Mode**:
   - **PDF Mode**: Drag and drop any Indian court order (Supreme Court, High Court, NCLT, etc.) or click the box to select a file. The application will render a page-selector, allowing you to preview and select page ranges (or analyze the entire document).
   - **Text Mode**: Switch to the text tab and paste any legal brief, ruling, or contract directly into the text editor.
3. **Select Analysis Style**:
   - **Case Summary**: Best for quick client updates, summarizing counsel arguments, and determining the direct holding.
   - **FILAC Analysis**: Best for academic research, drafting appeals, or performing a thorough, case-finding audit of a precedent.
4. **Click "Summarize Court Order"**: Watch the live generation stream. If the public API experiences transient demand, the application will automatically perform up to 3 retry attempts with exponential delay.
5. **Print or Export**:
   - Use **Print Case** to generate a beautifully aligned, print-ready document.
   - Use **Download Report** to save a local, structured PDF preservation file with bold/italic styles intact.

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/5f9f09c8-37d2-4f61-a789-f2418899b1a0

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key

---

## ⚖️ License
This project is licensed under the Apache-2.0 License. See the [LICENSE](LICENSE) file or headers for details.
4. Run the app:
   `npm run dev`
