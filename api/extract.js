export const config = {
  maxDuration: 30,
  api: {
    bodyParser: {
      sizeLimit: '20mb'
    }
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mediaType, mode } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'API key not configured' });

  try {
    if (mode === 'extract') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1200,
          system: `你是一個專業的表單資料擷取引擎，專門處理台灣教育機構的招生問卷。
從表單影像中擷取所有欄位，僅回傳有效 JSON，不得有任何前言或說明文字。

必須回傳以下 JSON 結構：
{
  "personal": {
    "name": "",
    "gender": "",
    "dob_roc": "",
    "dob_western": "",
    "phone": "",
    "registration_city": "",
    "current_city": ""
  },
  "survey": {
    "q1_current_status": {"code": "", "label_zh": ""},
    "q2_industry_interests": [{"code": "", "label_zh": ""}],
    "q3_visited_before": {"code": "", "label_zh": ""},
    "q4_work_style_interest": {"code": "", "label_zh": ""},
    "q5_coping_strategies": [{"code": "", "label_zh": ""}],
    "q6_desired_ai_skill": {"code": "", "label_zh": ""},
    "q7_income_goal": {"code": "", "label_zh": ""}
  },
  "meta": {
    "institution": "",
    "confidence": 0.0,
    "notes": ""
  }
}

規則：民國年 + 1911 = 西元年。只記錄明確勾選的選項。confidence 依據清晰度與完整性評分。`,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
              { type: 'text', text: '請從此招生問卷擷取所有欄位，僅回傳 JSON。' }
            ]
          }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Anthropic error:', response.status, errText);
        return res.status(502).json({ error: `Upstream error ${response.status}`, detail: errText });
      }
      const data = await response.json();
      const raw = data.content?.find(b => b.type === 'text')?.text || '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return res.status(422).json({ error: 'Could not parse extraction result', raw });
      return res.status(200).json({ result: JSON.parse(match[0]) });

    } else if (mode === 'message') {
      const { extractedData } = req.body;
      const p = extractedData.personal;
      const s = extractedData.survey;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 350,
          messages: [{
            role: 'user',
            content: `你是一位親切的招生顧問，正在為台灣的電腦教育機構撰寫個人化的 LINE 跟進訊息。

學員資料：
- 姓名：${p.name}
- 目前狀態：${s.q1_current_status.label_zh}
- 感興趣產業：${s.q2_industry_interests.map(i => i.label_zh).join('、')}
- 工作模式偏好：${s.q4_work_style_interest.label_zh}
- 因應策略：${s.q5_coping_strategies.map(i => i.label_zh).join('、')}
- 期望技能：${s.q6_desired_ai_skill.label_zh}
- 收入目標：${s.q7_income_goal.label_zh}/月

請撰寫一則溫暖自然的繁體中文 LINE 訊息（3–4 句），以「${p.name} 您好！」開頭，提及具體興趣，呼應副業動機，以預約免費諮詢作為明確下一步。只回傳訊息本文。`
          }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Anthropic error:', response.status, errText);
        return res.status(502).json({ error: `Upstream error ${response.status}` });
      }
      const data = await response.json();
      const msg = data.content?.find(b => b.type === 'text')?.text?.trim() || '';
      return res.status(200).json({ message: msg });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
