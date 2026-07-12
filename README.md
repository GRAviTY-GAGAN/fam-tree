# FamilyFlow — Interactive Family Tree Builder

FamilyFlow is a modern, mobile-first interactive family tree builder. It features a responsive layout, automatic node arranging (via Dagre Graph engine), seamless photo uploads directly synced with Cloudinary, support for customizable member fields, and a robust Google OAuth authentication flow.

## 🔗 Live Deployments

* **Backend API (Render):** [https://fam-tree-268p.onrender.com/](https://fam-tree-268p.onrender.com/)
* **Frontend Client (Vercel):** [https://fam-tree-iota.vercel.app/](https://fam-tree-iota.vercel.app/)

---

## 📁 Repository Structure

The project is managed as a monorepo consisting of two primary sub-folders:

```text
fam-tree/
├── backend/            # FastAPI Python server application
│   ├── app/            # Source code (models, routes, config, db initialization)
│   ├── requirements.txt# Python library dependencies (including PostgreSQL and Cloudinary SDKs)
│   └── .env            # Environment configuration (ignored in git)
└── frontend/           # Next.js TypeScript react application
    ├── src/            # App routes, custom React Flow node/edge layouts, context & utils
    └── .env.local      # Local environment configurations (ignored in git)
```

---

## 🛠️ Tech Stack & Architecture

### Backend
* **FastAPI:** High-performance, clean asynchronous Python endpoints.
* **SQLModel & SQLAlchemy:** Object-relational mapping matching standard SQL schemas.
* **PostgreSQL (Supabase):** Free-tier serverless cloud database integration with connection pooling.
* **psycopg2-binary:** PostgreSQL adapter driver.
* **Cloudinary SDK:** Stateless media/profile photo persistent storage.
* **PyJWT:** Secure JWT credentials signature generation for Google SSO login.

### Frontend
* **Next.js (App Router):** Modern React architecture.
* **React Flow:** Draggable, responsive interactive canvas node graphs.
* **Dagre Graph:** Automated hierarchy coordinates layout engine ensuring nodes never overlap.
* **Tailwind CSS & shadcn/ui:** Clean, linear-inspired design elements (styled buttons, drawers, custom inputs).

---

## 🚀 Local Development Setup

### 1. Set Up the Backend
Navigate to the `backend` folder, create a virtual environment, and install dependencies:

```bash
cd backend
python -m venv venv
```

#### Option 1: Direct Execution (Recommended & Foolproof)
You do not need to activate the virtual environment manually. You can run Uvicorn directly using the Python executable inside the virtual environment. This avoids any PowerShell script execution policy blocks:

*   **On Windows (PowerShell/CMD):**
    ```powershell
    # Install dependencies first (via venv pip):
    .\venv\Scripts\pip.exe install -r requirements.txt
    
    # Run Uvicorn directly:
    .\venv\Scripts\python.exe -m uvicorn app.main:app --port=8000 --reload
    ```
*   **On Linux/macOS:**
    ```bash
    ./venv/bin/pip install -r requirements.txt
    ./venv/bin/python -m uvicorn app.main:app --port=8000 --reload
    ```

#### Option 2: Activating the Virtual Environment First
If you prefer to activate the virtual environment first, choose the appropriate command for your terminal:

*   **On Windows PowerShell:**
    ```powershell
    # If script execution is blocked on your system, run this first in your session:
    # Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
    .\venv\Scripts\Activate.ps1
    
    # Install dependencies & start:
    pip install -r requirements.txt
    uvicorn app.main:app --port 8000 --reload
    ```
*   **On Windows CMD:**
    ```cmd
    .\venv\Scripts\activate.bat
    pip install -r requirements.txt
    uvicorn app.main:app --port 8000 --reload
    ```
*   **On Linux/macOS:**
    ```bash
    source venv/bin/activate
    pip install -r requirements.txt
    uvicorn app.main:app --port 8000 --reload
    ```

Create a `backend/.env` file with the following variables:
```env
DATABASE_URL="postgresql://postgres.[your-project-ref]:[password]@aws-1-[region].pooler.supabase.com:5432/postgres?sslmode=require"
CLOUDINARY_URL="cloudinary://[api_key]:[api_secret]@[cloud_name]"
JWT_SECRET="your-jwt-signing-secret"
GOOGLE_CLIENT_ID="[your-google-oauth-client-id]" # Optional in local bypass mode
```

*Note: In local development, if `GOOGLE_CLIENT_ID` is left empty, the server automatically enables the **"Developer Login Bypass"** option, using a local mock user profile so you do not need Google developer registration to test features.*

### 2. Set Up the Frontend
Navigate to the `frontend` folder, install standard npm dependencies, and start the dev server:

```bash
cd ../frontend
npm install
npm run dev
```

Create a `frontend/.env.local` file with the following variables:
```env
NEXT_PUBLIC_API_URL="http://localhost:8000"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="[your-google-oauth-client-id]" # Optional in local bypass mode
```

---

## ☁️ Production Deployment Config

### Backend (Render Web Service)
* **Root Directory:** `backend`
* **Build Command:** `pip install -r requirements.txt`
* **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
* **Environment Variables:**
  * Must set `DATABASE_URL` (using the Supabase IPv4 compatibility Connection Pooler address on port `5432` or `6543` to bypass IPv6 network routing issues on Render's side).
  * Must set `CLOUDINARY_URL`, `JWT_SECRET`, and `GOOGLE_CLIENT_ID`.

### Frontend (Vercel / Next.js)
* **Root Directory:** `frontend`
* **Build Command:** `npm run build`
* **Output Directory:** `.next`
* **Environment Variables:**
  * Must set `NEXT_PUBLIC_API_URL` pointing to your deployed Render API (e.g. `https://fam-tree-268p.onrender.com`).
  * Must set `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
