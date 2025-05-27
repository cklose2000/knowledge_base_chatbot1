# Get LLMWhisperer API Key

## 🔑 Step 1: Sign Up for LLMWhisperer

1. **Visit**: https://unstract.com/llmwhisperer/
2. **Click "Get Started"** or "Sign Up"
3. **Create Account** with your email
4. **Verify Email** if required

## 🎯 Step 2: Get Your API Key

1. **Login** to your LLMWhisperer dashboard
2. **Navigate** to API Keys section
3. **Create New API Key** or copy existing one
4. **Copy the key** - it should look like: `llmw_xxxxxxxxxxxxxxxxxxxxx`

## ⚙️ Step 3: Add to Environment

1. **Create .env file** in the ai-analyst-chat directory:
   ```bash
   # Copy from .env.example
   cp .env.example .env
   ```

2. **Edit .env file** and add your key:
   ```env
   LLMWHISPERER_API_KEY=llmw_your_actual_key_here
   VITE_LLMWHISPERER_API_KEY=llmw_your_actual_key_here
   ```

## 🧪 Step 4: Test

1. **Restart servers**:
   ```bash
   # Kill existing processes
   taskkill /f /im node.exe
   
   # Start proxy
   node server/llmwhisperer-proxy.cjs
   
   # Start React app (in new terminal)
   npm run dev
   ```

2. **Upload PDF** and watch for:
   ```
   ✅ [LLMWhisperer Proxy] Extraction successful
   📊 [LLMWhisperer Proxy] Extracted 15,000+ characters
   ```

## 🆓 Free Tier

- LLMWhisperer offers a **free tier**
- Usually includes several hundred pages per month
- Perfect for testing and development

## 🔧 Alternative: Use Demo Key

If you want to test immediately, you can try using a demo/test key, but you'll need to get a real one for production use. 