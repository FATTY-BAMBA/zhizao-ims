export const config = {
  maxDuration: 30,
  api: { bodyParser: { sizeLimit: '20mb' } }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mediaType, mode, extractedData } = req.body;
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
          max_tokens: 1500,
          system: `你是一個專業的表單資料擷取引擎，專門處理聯成電腦的手寫招生問卷。
根據對數百份真實問卷的分析，以下是你需要了解的關鍵知識：

【表單版面位置】
- 問卷分為左右兩半：左側為活動宣傳圖，右側為問卷內容
- 個人資料區在問卷右側最下方，包含：姓名、性別、出生日期、戶籍縣市、手機、現居縣市
- Q1-Q7 問題在個人資料區上方，由上至下排列

【手寫欄位辨識規則】
姓名：
- 繁體中文，通常 2-3 個字
- 可能為韓文音譯漢字（如金志訓、嚴成珉）
- 筆跡風格多樣，包含楷書和草書

出生日期：
- 格式：民國XX年X月X日
- 常見民國年：73-90年（西元1984-2001）
- 民國年 + 1911 = 西元年
- 若民國年超過100（如109年=西元2020）代表填寫者可能年齡不符，需在 notes 中標記為「疑似填寫錯誤」

手機號碼：
- 台灣格式：09 開頭，共 10 碼
- 書寫方式多樣：0912345678 或 0912-345-678 或 0932 975 625
- 統一輸出為無分隔符號的10碼格式

縣市欄位：
- 戶籍縣市與現居縣市是兩個獨立欄位，務必分別讀取
- 常見縣市：台北市、新北市、桃園市、台中市、台南市、高雄市、新竹市、南投縣等
- 若只寫「北」代表台北市，「新北」代表新北市
- 若欄位顯示數字（如「86」寫在縣市欄）代表資料填寫錯誤，輸出空字串並在 low_confidence_fields 中標記
- 若為非台灣城市（如南韓首爾、大田市）照實填寫

【勾選框辨識 — 非常重要】
本表單中出現過的勾選符號包含：
- 標準勾號 ✓
- V 形記號
- N 形記號（N 字加斜線）
- 小型勾號（可能較淡）
- 打叉 ✗
以上全部視為「已勾選」。未填任何符號的方框視為「未選」。
若整張表單的 Q1-Q7 全部空白，不要猜測，全部回傳空值。

【問卷選項完整列表】
Q1 目前身分（單選）：①在職 ②待業 ③學生(高中及以下) ④學生(大學以上) ⑤軍公教 ⑥自由業
Q2 感興趣產業（可複選）：①動漫電繪 ②遊戲設計 ③UI/UX介面設計 ④影視特效 ⑤室內景觀 ⑥產品設計 ⑦RHCE網管 ⑧人工智慧軟體開發 ⑨文書行政 ⑩電商經營實務
Q3 曾否到訪（單選）：①有曾經去過 ②未曾去過 ③我是聯成學員
Q4 工作模式（單選）：①嚮往「在家工作」時間地點彈性 ②嚮往經營「自媒體」增加第二份收入 ③希望成為擅長AI技術的人 ④還是喜歡傳統上班族的工作模式
Q5 因應策略（可複選）：①培養AI技術，轉換跑道 ②培養第二專長，接案或經營自媒體 ③透過打工兼職增加收入 ④設法減少日常開支
Q6 期望AI能力（單選）：①設計AI應用程式 ②AI生成圖文 ③AI生成影音 ④AI生成動畫
Q7 收入目標（單選）：①3.5萬-4萬 ②4萬-6萬 ③6萬-8萬 ④年薪百萬

【信心評分規則】
- name_confidence：姓名清晰可讀=1.0，草書但可辨=0.85，模糊=0.6
- phone_confidence：10碼完整=1.0，有空格但完整=0.95，部分模糊=0.7
- dob_confidence：清晰=1.0，年份可疑（如超過100）=0.5
- 整體 confidence = 各欄位加權平均
- low_confidence_fields：列出所有信心低於 0.8 的欄位名稱
- 若問卷 Q1-Q7 全空白，在 notes 中填「問卷題目未填寫」

僅回傳有效 JSON，禁止任何前言或說明文字：
{
  "personal": {
    "name": "",
    "name_confidence": 0.0,
    "gender": "",
    "dob_roc": "",
    "dob_western": "",
    "dob_confidence": 0.0,
    "phone": "",
    "phone_confidence": 0.0,
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
    "institution": "聯成電腦",
    "confidence": 0.0,
    "low_confidence_fields": [],
    "notes": ""
  }
}`,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
              { type: 'text', text: '請仔細辨識此聯成電腦招生問卷的所有欄位。重點注意：(1)右側問卷區的7個問題勾選狀況，(2)最下方手寫的姓名、出生日期、手機號碼、戶籍縣市、現居縣市（這兩個縣市是獨立欄位）。僅回傳 JSON。' }
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
      const p = extractedData.personal;
      const s = extractedData.survey;
      const hasInterests = s.q2_industry_interests && s.q2_industry_interests.length > 0;
      const hasCoping = s.q5_coping_strategies && s.q5_coping_strategies.length > 0;

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
            content: `你是一位親切的招生顧問，正在為聯成電腦撰寫個人化的 LINE 跟進訊息。

學員資料：
- 姓名：${p.name}
- 目前狀態：${s.q1_current_status?.label_zh || '未知'}
- 感興趣產業：${hasInterests ? s.q2_industry_interests.map(i => i.label_zh).join('、') : '（未填寫）'}
- 工作模式偏好：${s.q4_work_style_interest?.label_zh || '（未填寫）'}
- 因應策略：${hasCoping ? s.q5_coping_strategies.map(i => i.label_zh).join('、') : '（未填寫）'}
- 期望技能：${s.q6_desired_ai_skill?.label_zh || '（未填寫）'}
- 收入目標：${s.q7_income_goal?.label_zh || '（未填寫）'}/月

若部分資料顯示「未填寫」，請根據現有資料撰寫訊息，不要提及未填寫的欄位。
請撰寫一則溫暖自然的繁體中文 LINE 訊息（3-4 句），以「${p.name} 您好！」開頭，提及具體興趣，以預約免費諮詢作為明確下一步。只回傳訊息本文。`
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
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
