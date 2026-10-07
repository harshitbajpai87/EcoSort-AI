# EcoSort AI 🌱

**AI-powered Smart Waste Management Platform** — IBM Internship Project

[![SDG 11](https://img.shields.io/badge/SDG-11%20Sustainable%20Cities-orange)](https://sdgs.un.org/goals/goal11)
[![SDG 12](https://img.shields.io/badge/SDG-12%20Responsible%20Consumption-yellow)](https://sdgs.un.org/goals/goal12)
[![SDG 13](https://img.shields.io/badge/SDG-13%20Climate%20Action-green)](https://sdgs.un.org/goals/goal13)
[![IBM watsonx.ai](https://img.shields.io/badge/Powered%20by-IBM%20watsonx.ai-blue)](https://www.ibm.com/watsonx)

---

## 🎯 Overview

EcoSort AI is a complete, production-style smart waste management platform that uses computer vision and IBM watsonx.ai to:

- **Classify** waste from uploaded/captured images (10 categories)
- **Guide** users on correct disposal and bin selection
- **Gamify** recycling with EcoPoints, badges, and community challenges
- **Coordinate** waste pickups between users and collectors
- **Chat** via IBM watsonx.ai (Granite 13B) powered EcoChat assistant
- **Report** environmental impact and sustainability metrics
- **Localise** in English, Hindi (हिंदी), and Hinglish

---

## 🏗️ Architecture

```
ecosort-ai/
├── backend/              FastAPI + Python backend
│   ├── app/
│   │   ├── api/v1/       REST API routers
│   │   ├── core/         Config, security, dependencies
│   │   ├── database/     SQLAlchemy session
│   │   ├── models/       ORM models
│   │   └── services/     ML service + watsonx service
│   ├── ml/               PyTorch model checkpoint
│   └── tests/            pytest test suite
├── frontend/             React + TypeScript + Tailwind
│   └── src/
│       ├── api/          Typed API modules
│       ├── components/   Sidebar, NotificationBell, LangSwitcher
│       ├── contexts/     AuthContext, LangContext
│       └── pages/        All application pages
├── ml/                   Model cards + training scripts
└── docs/                 Documentation
```

### Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React 18 + TypeScript + Tailwind CSS + Vite |
| Backend   | FastAPI + Python 3.11 |
| Database  | SQLite (dev) → PostgreSQL (production) |
| ML        | PyTorch + torchvision ResNet50 (+ heuristic fallback) |
| AI Chat   | IBM watsonx.ai — Granite 13B Chat |
| Auth      | JWT (access + refresh tokens) + bcrypt |
| Deploy    | Vercel (frontend) + Render (backend) |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend

```bash
cd ecosort-ai/backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # Edit with your settings
uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/api/docs

### Frontend

```bash
cd ecosort-ai/frontend
npm install
cp .env.example .env.local # Edit VITE_API_BASE_URL if needed
npm run dev
```

App available at: http://localhost:5173

---

## ⚙️ Environment Variables

### Backend (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./ecosort.db` | SQLite or PostgreSQL connection string |
| `SECRET_KEY` | change-me | JWT signing secret (use 64-char random hex in prod) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | JWT access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | JWT refresh token lifetime |
| `CORS_ORIGINS` | localhost variants | Comma-separated allowed origins |
| `IBM_WATSONX_APIKEY` | *(empty)* | IBM watsonx.ai API key |
| `IBM_WATSONX_PROJECT_ID` | *(empty)* | IBM watsonx.ai project ID |
| `IBM_WATSONX_URL` | `https://us-south.ml.cloud.ibm.com` | watsonx endpoint |

### Frontend (`.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | *(empty — proxied)* | Backend URL for production |

---

## 📡 API Reference

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register new account |
| POST | `/api/v1/auth/login` | Login → JWT tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET  | `/api/v1/auth/me` | Get current user profile |
| POST | `/api/v1/auth/logout` | Logout (client-side) |

### Classifications (Waste Scanner)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/classifications/predict` | Classify waste image |
| GET  | `/api/v1/classifications/` | List user's scan history |

### EcoChat
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/chat/` | Chat with EcoChat AI |

### Pickups
| Method | Path | Description |
|--------|------|-------------|
| POST  | `/api/v1/pickups/` | Create pickup request (+5 pts) |
| GET   | `/api/v1/pickups/` | List my pickups |
| GET   | `/api/v1/pickups/{id}` | Get pickup detail |
| PATCH | `/api/v1/pickups/{id}/cancel` | Cancel pending pickup |
| GET   | `/api/v1/pickups/collector/queue` | Collector: pending queue |
| PATCH | `/api/v1/pickups/{id}/status` | Collector: update status |

### EcoPoints & Leaderboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/ecopoints/me` | My balance + badges |
| GET | `/api/v1/ecopoints/leaderboard` | Global leaderboard |
| GET | `/api/v1/ecopoints/history` | My point event history |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/analytics/dashboard` | Dashboard stats |
| GET | `/api/v1/analytics/impact` | Environmental impact |
| GET | `/api/v1/analytics/ml` | ML model metrics |

### Feedback
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/feedback/` | Submit scan feedback (+pts) |
| GET  | `/api/v1/feedback/` | My feedback history |
| GET  | `/api/v1/feedback/ml-queue` | ML training queue (admin) |

### Notifications
| Method | Path | Description |
|--------|------|-------------|
| GET   | `/api/v1/notifications/` | List notifications |
| PATCH | `/api/v1/notifications/{id}/read` | Mark as read |
| POST  | `/api/v1/notifications/read-all` | Mark all read |
| GET   | `/api/v1/notifications/unread-count` | Unread count |

### Challenges
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/api/v1/challenges/` | Active challenges |
| GET  | `/api/v1/challenges/my` | My participation status |
| POST | `/api/v1/challenges/{id}/join` | Join challenge |
| POST | `/api/v1/challenges/` | Create challenge (admin) |

### Recycling Centers
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/api/v1/recycling-centers/` | List centers |
| GET  | `/api/v1/recycling-centers/{id}` | Get center detail |
| POST | `/api/v1/recycling-centers/` | Add center (admin) |
| PUT  | `/api/v1/recycling-centers/{id}` | Update center (admin) |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET   | `/api/v1/admin/stats` | Platform statistics |
| GET   | `/api/v1/admin/users` | List all users |
| PATCH | `/api/v1/admin/users/{id}/role` | Change user role |
| GET   | `/api/v1/admin/pickups` | List all pickups |
| PATCH | `/api/v1/admin/pickups/{id}/status` | Update pickup status |
| GET   | `/api/v1/admin/feedbacks` | List all feedbacks |

---

## 🤖 ML System

### Classification Pipeline

1. **PyTorch Model** (primary): ResNet50 fine-tuned on 10 waste categories.
   Loaded from `backend/ml/model.pt` if present.

2. **Heuristic Fallback** (always available): deterministic colour-analysis algorithm.
   Same image always returns the same category — reproducible for demos.

### Categories
`plastic` · `paper` · `cardboard` · `glass` · `metal` · `organic` · `textile` · `e-waste` · `battery` · `hazardous`

### Feedback Loop
- Users submit corrections via the Scanner feedback widget
- Corrections are stored in `scan_feedbacks` table
- Admin reviews via `/api/v1/admin/feedbacks`
- Unreviewed corrections exported via `/api/v1/feedback/ml-queue`
- Use exported data to retrain the PyTorch model

---

## 🎮 Gamification

### EcoPoints

| Action | Points |
|--------|--------|
| Scan waste image | +10 pts |
| Submit scan feedback | +10 pts |
| Correct wrong prediction | +5 pts bonus |
| Request pickup | +5 pts |
| Pickup completed | +50 pts |
| Complete challenge | +challenge reward pts |

### Badges (by points threshold)

| Badge | Points | Description |
|-------|--------|-------------|
| 🌱 Seedling | 10 | First points earned |
| ♻️ Recycler | 50 | Active recycler |
| 🦸 Eco Hero | 200 | Growing impact |
| 🌿 Green Warrior | 500 | Committed ecologist |
| 🌍 Planet Saver | 1,000 | Meaningful impact |
| 🏆 Eco Champion | 2,500 | Community leader |
| 🌟 Sustainability Master | 5,000 | True master |

---

## 🔐 Security

- Passwords hashed with **bcrypt** (passlib)
- JWT access tokens (15-min) + refresh tokens (30-day)
- **Role-based access control**: `USER` · `COLLECTOR` · `ADMIN`
- Sliding-window **rate limiting** on auth endpoints (10 req/min/IP)
- CORS whitelist configured per environment
- SQL injection prevented by SQLAlchemy ORM parameterisation
- File upload validation: MIME type + size limit (10 MB)

---

## 🧪 Tests

```bash
cd ecosort-ai/backend
pytest tests/ -v
```

Test coverage includes:
- Auth: register, login, refresh, role-based access
- Classifications: predict, eco-points award, validation
- Pickups: create, list, cancel, collector access
- EcoPoints: balance, leaderboard, notifications

---

## 🚢 Deployment

### Backend — Render

1. Create a new **Web Service** on [Render](https://render.com)
2. Connect your GitHub repository
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables from `.env.example`
6. Add a **PostgreSQL** database and copy the connection string to `DATABASE_URL`

### Frontend — Vercel

1. Import your repository on [Vercel](https://vercel.com)
2. Set the root directory to `ecosort-ai/frontend`
3. Add environment variable: `VITE_API_BASE_URL=https://your-backend.render.com`
4. Deploy

---

## 🌍 SDG Impact

| SDG | How EcoSort AI Contributes |
|-----|--------------------------|
| **SDG 11** — Sustainable Cities | Smart pickup routing, waste stream analytics, collector management |
| **SDG 12** — Responsible Consumption | AI guidance on correct sorting, feedback loop, recycling center locator |
| **SDG 13** — Climate Action | CO₂ savings tracking, methane diversion from landfill, sustainability reports |

---

## 📄 License

MIT — IBM Internship Project 2024
