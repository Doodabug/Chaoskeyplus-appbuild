# Development Setup Guide

## System Requirements

| Component | Version | Purpose |
|-----------|---------|----------|
| Node.js | 18+ | React frontend runtime |
| Python | 3.9+ | FastAPI backend |
| MongoDB | 5.0+ | Database |
| Git | 2.30+ | Version control |

## Installation Steps

### 1. Clone Repository

```bash
git clone https://github.com/doodabug/Chaoskeyplus-appbuild.git
cd Chaoskeyplus-appbuild
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit with your configuration
nano .env
```

### 3. Backend Setup

```bash
cd backend

# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start development server (this repo's app is server.py, not main.py)
uvicorn server:app --reload --port 8000
```

**Backend will be available at**: `http://localhost:8000`

**API Documentation**: `http://localhost:8000/docs`

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

**Frontend will be available at**: `http://localhost:3000`

## MongoDB Setup

### Option A: Local Installation

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Ubuntu/Debian:**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

### Option B: Docker

```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### Verify Connection

```bash
mongosh  # MongoDB shell
> show dbs  # Should list databases
```

## Development Workflow

### Running Everything

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

**Terminal 3 - MongoDB (if local):**
```bash
mongod
```

### Testing

**Backend Tests:**
```bash
cd backend
pytest tests/ -v
```

**Frontend Tests:**
```bash
cd frontend
npm test
```

### Building for Production

**Frontend Build:**
```bash
cd frontend
npm run build
# Output in frontend/build/
```

**Backend Production:**
```bash
cd backend
gunicorn main:app --workers 4 --bind 0.0.0.0:8000
```

## Code Structure

```
frontend/
├── src/
│   ├── components/        # React components
│   ├── pages/            # Page components
│   ├── services/         # API calls
│   ├── styles/           # Tailwind CSS
│   └── App.jsx
├── public/               # Static assets
└── package.json

backend/
├── models/               # Pydantic models
├── routes/               # API endpoints
├── services/             # Business logic
├── utils/                # Helper functions
├── main.py               # FastAPI app
└── requirements.txt
```

## Common Issues

### Issue: MongoDB Connection Failed
```
Solution: Check MONGODB_URL in .env matches your MongoDB instance
mongosh "mongodb://localhost:27017"
```

### Issue: Port Already in Use
```bash
# Find process using port 8000
lsof -i :8000
kill -9 <PID>

# Or use different port
uvicorn main:app --port 8001
```

### Issue: Module Not Found (Python)
```bash
# Ensure virtual environment is activated
source venv/bin/activate
pip install -r requirements.txt
```

### Issue: npm Dependencies Conflict
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Debugging

### Enable Debug Mode
```
In .env:
DEBUG=True
LOG_LEVEL=DEBUG
```

### API Testing
```bash
# Using curl
curl http://localhost:8000/api/health

# Using Python requests
python3
>>> import requests
>>> requests.get("http://localhost:8000/api/health").json()
```

### Browser DevTools
- React: Install React Developer Tools extension
- Network: Check XHR requests to backend
- Console: Monitor for errors

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and commit
git add .
git commit -m "feat: description of changes"

# Push to remote
git push origin feature/your-feature

# Create Pull Request on GitHub
```

## Pre-Submission Checklist

- [ ] `.env.example` properly configured with all required variables
- [ ] Backend runs without errors: `uvicorn main:app --reload`
- [ ] Frontend builds without warnings: `npm run build`
- [ ] All tests pass: `npm test` and `pytest`
- [ ] No secrets committed to git
- [ ] README.md is comprehensive and up-to-date
- [ ] `strk20.json` contains all required metadata
- [ ] Demo video recorded and accessible
- [ ] Smart contracts deployed to mainnet
- [ ] Transaction hashes verified and documented

## Support

For issues or questions:
1. Check existing GitHub Issues
2. Review error logs in `logs/` directory
3. Enable debug mode for detailed output
4. Create a new GitHub Issue with error details

---

**Last Updated**: August 13, 2026
**Next Deadline**: August 31, 2026