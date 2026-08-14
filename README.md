# ChaosKey+ Mobile Application

A modern, privacy-first mobile application for managing cryptographic identities and transactions on Starknet. Built with React and FastAPI for the STRK20 Hackathon.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (Frontend)
- Python 3.9+ (Backend)
- MongoDB (for data persistence)

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

The React app will open at `http://localhost:3000`

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your configuration
uvicorn main:app --reload --port 8000
```

API will be available at `http://localhost:8000`

## 📋 Features

### 01 - APPLY
- Repository URL registration
- Telegram username integration for notifications
- One-time pull request application (no deployment required)

### 02 - BUILD IN PUBLIC
- Live repository integration with 30-minute refresh cycle
- Real-time stack, contract, and demo visibility
- Public transparency dashboard

### 03 - SHIP TO MAINNET
- Smart contract deployment verification
- Live pool transaction testing
- Demo transaction tracking and validation

### 04 - SUBMISSION READY
- Complete `strk20.json` with demo metadata
- Video walkthrough and contract hashes
- Transaction evidence and deployment proof

## 🏗️ Architecture

```
Chaoskeyplus-appbuild/
├── frontend/                 # React 18 + Tailwind CSS
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/                  # FastAPI + MongoDB
│   ├── requirements.txt
│   ├── main.py
│   └── models/
├── contracts/                # Starknet smart contracts
├── .env.example             # Configuration template
├── strk20.json              # Hackathon submission metadata
└── README.md
```

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Backend
MONGODB_URL=mongodb://localhost:27017
BACKEND_PORT=8000
BACKEND_HOST=0.0.0.0

# Frontend
REACT_APP_API_URL=http://localhost:8000

# Starknet
STARKNET_RPC_URL=https://mainnet.starknet.io
ACCOUNT_ADDRESS=your_account_address
PRIVATE_KEY=your_private_key

# Telegram Notifications
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## 🧪 Testing

### Frontend
```bash
cd frontend
npm test
```

### Backend
```bash
cd backend
pytest tests/
```

## 📦 Deployment

### Docker (Recommended)

```bash
docker-compose up -d
```

### Manual Deployment

1. Build frontend: `cd frontend && npm run build`
2. Start backend: `cd backend && gunicorn main:app`
3. Serve frontend from `frontend/build/` directory

## 🔐 Security

- All sensitive credentials stored in `.env` (see `.gitignore`)
- API endpoints protected with rate limiting
- Private key management handled securely
- No credentials committed to version control

## 📱 Mobile Features

- QR code generation and scanning
- Real-time transaction notifications via Telegram
- Responsive design for all devices
- Framer Motion animations for smooth UX

## 🎯 Hackathon Timeline

- **Day 1-7**: Application & Repository Setup ✅
- **Day 8-14**: Smart Contract Development & Testing
- **Day 15-21**: Mainnet Deployment & Demo
- **Day 22-30**: Documentation & Submission Polish
- **Day 31**: Final Submission

## 📞 Support & Documentation

- [Starknet Docs](https://docs.starknet.io)
- [Cairo Language](https://book.cairo-lang.org)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [React Documentation](https://react.dev)

## 📝 License

MIT License - See LICENSE file for details

## 👤 Author

**Doodabug** - Starknet Developer

---

**Last Updated**: August 13, 2026
**Status**: Pre-Submission (18 days to deadline)