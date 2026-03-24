# 智招 IMS — 智能招生管理系統

AI-powered student intake form extraction and outreach tool.

## Deploy to Vercel (5 minutes)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "init"
gh repo create zhizao-ims --private --push --source=.
```

### 2. Import to Vercel
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your `zhizao-ims` GitHub repo
3. Leave all build settings as default — Vercel auto-detects

### 3. Add your API key
In Vercel dashboard → **Settings → Environment Variables**:
| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |

4. Click **Deploy** — done. Your URL will be `zhizao-ims.vercel.app`

---

## Local development
```bash
npm i -g vercel
vercel dev
```
Copy `.env.example` → `.env.local` and fill in your key.

## Project structure
```
zhizao/
├── api/
│   └── extract.js       # Serverless function — API key lives here only
├── public/
│   └── index.html       # Full frontend — zero API keys
├── vercel.json
└── .env.example
```

## How it works
1. User uploads a form photo (JPG/PNG/PDF/HEIC)
2. Frontend sends image to `/api/extract` (your serverless function)
3. Serverless function calls the vision model with the image
4. Extracts all fields → returns structured JSON
5. Second call generates personalised LINE outreach message
6. Frontend renders extraction, intent scores, and all downstream actions

## Customisation
- **Branding**: Edit the logo/name in `public/index.html` (search `智招 IMS`)
- **Form schema**: Adjust the JSON schema in `api/extract.js` to match your client's specific form fields
- **Language**: The prompts are in Traditional Chinese — change for other markets
