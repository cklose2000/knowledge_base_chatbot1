# AI Analyst Chat Interface POC

A professional ChatGPT-style chat interface designed for investment banking and financial analysis. Built with React, TypeScript, and Tailwind CSS.

![AI Analyst Chat Interface](https://img.shields.io/badge/Status-Working%20POC-brightgreen)
![React](https://img.shields.io/badge/React-18.x-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.x-blue)

## 🎯 Features

### ✅ **Core Functionality**
- **Professional Chat Interface** - Clean, modern ChatGPT-style design
- **Real-time Messaging** - Instant message exchange with simulated AI responses
- **Dark Theme** - Professional dark theme optimized for financial professionals
- **Responsive Design** - Works seamlessly on desktop and mobile devices

### ✅ **User Interface**
- **Login System** - Simple authentication with demo user capability
- **Sidebar Navigation** - Collapsible chat history with sample conversations
- **Message History** - Persistent chat sessions with timestamps
- **Auto-expanding Input** - Text area that grows with content and resets after sending

### ✅ **Enterprise Integrations**
- **File Upload** - Direct file and photo upload capability
- **Cloud Storage** - Integration buttons for:
  - 📄 Google Drive
  - 📁 Microsoft OneDrive
  - 📦 Dropbox
  - ☁️ Salesforce
  - 🗂️ SharePoint

### ✅ **Sample Data**
- **Pre-loaded Chat History** - Sample financial analysis conversations:
  - Q3 Financial Report Analysis
  - Portfolio Risk Assessment
  - Market Trends Summary

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/cklose2000/knowledge_base_chatbot1.git
   cd knowledge_base_chatbot1/ai-analyst-chat
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

## 🎮 Usage

### Login
1. Click "Login as Demo User" on the welcome screen
2. Enter any username (demo authentication)

### Chat Interface
1. **Send Messages** - Type in the input area and press Enter or click Send
2. **View History** - Click the hamburger menu (☰) to see chat history
3. **New Chat** - Click "New Chat" in the sidebar or the + button
4. **File Integration** - Click the + button in the input area to access file upload and cloud storage options

### Navigation
- **Sidebar Toggle** - Click hamburger menu to open/close chat history
- **Close Sidebar** - Click X button or click outside the sidebar
- **Logout** - Click "Sign Out" in the top-right corner

## 🏗️ Technical Architecture

### Tech Stack
- **Frontend Framework** - React 18 with TypeScript
- **Styling** - Tailwind CSS 3.x (stable version)
- **State Management** - Zustand with persistence
- **Icons** - Lucide React
- **Build Tool** - Vite
- **Routing** - React Router DOM

### Project Structure
```
ai-analyst-chat/
├── src/
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatInput.tsx      # Main input interface
│   │   │   ├── Message.tsx        # Individual message component
│   │   │   └── MessageList.tsx    # Message container
│   │   ├── layout/
│   │   │   ├── Header.tsx         # Top navigation
│   │   │   └── Sidebar.tsx        # Chat history sidebar
│   │   └── ui/
│   │       └── Button.tsx         # Reusable button component
│   ├── pages/
│   │   ├── Login.tsx              # Authentication page
│   │   └── Chat.tsx               # Main chat interface
│   ├── store/
│   │   ├── authStore.ts           # Authentication state
│   │   ├── chatStore.ts           # Chat messages and history
│   │   └── fileStore.ts           # File handling state
│   ├── types/
│   │   └── index.ts               # TypeScript type definitions
│   └── App.tsx                    # Main application component
├── public/
├── package.json
└── README.md
```

### Key Components

#### ChatInput
- Auto-expanding textarea
- Integration panel with file upload and cloud storage options
- Clean ChatGPT-style design with borderless input

#### Sidebar
- Fixed positioning (doesn't scroll with chat)
- Sample chat history with timestamps
- Smooth open/close animations

#### Message System
- User and AI message differentiation
- Timestamp display
- File attachment support

## 🎨 Design Features

### Visual Design
- **Professional Dark Theme** - Optimized for financial professionals
- **ChatGPT-inspired Interface** - Familiar and intuitive user experience
- **Clean Typography** - Easy-to-read fonts and proper spacing
- **Smooth Animations** - Polished transitions and interactions

### User Experience
- **Responsive Layout** - Works on all screen sizes
- **Keyboard Shortcuts** - Enter to send, Shift+Enter for new line
- **Auto-scroll** - Messages automatically scroll to bottom
- **Loading States** - Visual feedback during AI responses

## 🔧 Development Notes

### Recent Fixes
- ✅ **Tailwind CSS Compatibility** - Downgraded from v4 alpha to stable v3.4.15
- ✅ **Text Visibility** - Added fallback CSS for dark theme text rendering
- ✅ **Component Stability** - Fixed timestamp handling and message rendering
- ✅ **Sidebar Positioning** - Resolved overlay issues with fixed positioning
- ✅ **Input Auto-resize** - Textarea properly resets after message submission

### Known Limitations
- **Simulated AI Responses** - Currently returns placeholder responses
- **File Upload** - Integration buttons log to console (ready for backend implementation)
- **Authentication** - Demo mode only (no real user management)

## 🚀 Future Enhancements

### Planned Features
- **Real AI Integration** - Connect to actual AI/LLM services
- **File Processing** - Implement actual file upload and analysis
- **User Management** - Real authentication and user profiles
- **Message Search** - Search through chat history
- **Export Functionality** - Export conversations and analysis
- **Advanced Analytics** - Financial data visualization and insights

### Technical Improvements
- **Backend Integration** - REST API for data persistence
- **Real-time Updates** - WebSocket support for live collaboration
- **Performance Optimization** - Message virtualization for large conversations
- **Testing Suite** - Comprehensive unit and integration tests

## 📝 License

This project is a proof of concept for investment banking chat interfaces.

## 🤝 Contributing

This is a POC project. For questions or suggestions, please open an issue.

---

**Built with ❤️ for the financial industry**
