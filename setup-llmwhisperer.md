# LLMWhisperer Setup Instructions

## 🚀 Quick Setup

1. **Get LLMWhisperer API Key**
   - Visit: https://unstract.com/llmwhisperer/
   - Sign up for a free account
   - Get your API key from the dashboard

2. **Create .env file**
   ```bash
   # Copy from .env.example
   cp .env.example .env
   ```

3. **Add your API key to .env**
   ```env
   LLMWHISPERER_API_KEY=your_actual_api_key_here
   VITE_LLMWHISPERER_API_KEY=your_actual_api_key_here
   ```

4. **Start the proxy server and app**
   ```bash
   # Option 1: Start both together
   npm run dev:full
   
   # Option 2: Start separately
   npm run proxy    # Terminal 1
   npm run dev      # Terminal 2
   ```

## 🧪 Testing

1. **Test proxy server**
   - Visit: http://localhost:3001/health
   - Should show: `{"status":"ok","service":"LLMWhisperer Proxy"}`

2. **Upload a PDF**
   - Use the "Add photos and files" button
   - Upload any PDF file
   - Watch console for LLMWhisperer extraction logs

## 🔧 Troubleshooting

### Proxy not starting?
- Check if port 3001 is available
- Ensure .env file exists with API key
- Run: `node server/llmwhisperer-proxy.js` directly

### API key issues?
- Verify key is correct in .env file
- Check LLMWhisperer dashboard for usage limits
- Ensure key has PDF processing permissions

### CORS errors?
- Make sure proxy server is running on port 3001
- Check browser console for detailed error messages
- Verify React app is running on port 5173

## 📊 Expected Flow

1. **PDF Upload** → React App (port 5173)
2. **Proxy Request** → Express Server (port 3001)
3. **API Call** → LLMWhisperer API
4. **Text Extraction** → Back to React App
5. **RAG Processing** → Finance analysis

## 🎯 Success Indicators

✅ Proxy server starts without errors
✅ Health check returns OK
✅ PDF upload shows LLMWhisperer logs
✅ Extracted text appears in console
✅ RAG processing creates financial chunks
✅ Chat queries return relevant results 