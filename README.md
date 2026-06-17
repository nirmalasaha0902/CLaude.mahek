# Mahekk Industry Drawing Quotation Scanner

Engineering drawing quotation automation for Mahekk Industry. This project automatically extracts pricing parameters from drawing files using AI and generates custom formatted Excel sheets with pricing calculations.

## Project Structure

This project follows an industry-standard separate frontend and backend structure:

```
.
├── backend/                  # Node.js Express.js API & Business Logic
│   ├── formulas/             # Pricing and layout Excel formulas
│   ├── uploads/              # Temporary file upload storage
│   ├── drawing_analyses/     # Saved reports
│   ├── Dockerfile            # Backend Docker instructions
│   ├── server.js             # Main server entrypoint
│   └── package.json          # Backend dependencies
│
├── frontend/                 # Frontend User Interface
│   ├── public/               # Static assets (HTML, CSS, JS, Images, templates)
│   ├── Dockerfile            # Nginx static server Docker instructions
│   └── nginx.conf            # Nginx server routing & reverse proxy configuration
│
├── docker-compose.yml        # Multi-container local/production orchestration
├── .env                      # Local environmental secrets (ignore in version control)
├── .env.example              # References for expected env variables
└── package.json              # Root workspace shortcuts
```

## Running the Application

### 1. Locally (Development Mode)

Make sure you have Node.js installed, then:

1. Clone or copy files into your workspace.
2. Create a `.env` file under the `backend/` directory and populate your Gemini API Key:
   ```env
   GEMINI_API_KEY=AIzaSy...
   ```
3. Install backend dependencies and run the server using npm workspaces shortcuts:
   ```bash
   # From the project root folder:
   npm run install:backend
   npm run start:backend
   ```
4. Access the web interface at `http://localhost:3000`.

### 2. Using Docker (DevOps Production Mode)

To run the entire application isolated in Docker:

1. Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=AIzaSy...
   ```
2. Launch the docker-compose orchestrator:
   ```bash
   docker-compose up --build
   ```
3. Access the web application at `http://localhost` (port 80).
4. The Nginx server in `frontend` container serves the client assets and transparently proxies api routes `/api/*` to the `backend` container.

## Calculations & Logic

Pricing calculation logic relies on dynamic parameters configured in the `backend/formulas/` folder (handling circular, rectangular, and slotted shims according to Mahekk Industry specifications).
