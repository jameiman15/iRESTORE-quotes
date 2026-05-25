export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { pdfUrl, mode } = req.body;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  const prompts = {
    info: '從這份報價單 PDF 中找出客戶資訊，回傳純 JSON 物件，不要有任何其他文字或 markdown。格式：{"client_name":"診所名稱","contact":"聯絡人","phone":"電話","address":"地址","title":"抬頭","taxid":"統一編號","date":"日期YYYY-MM-DD"}。找不到的欄位填空字串。',
    items: '從這份報價單 PDF 中找出所有品項，回傳純 JSON 陣列，不要有任何其他文字或 markdown。格式：[{"pid":"品號","name":"品名","price":單價數字,"qty":數量數字}]。找不到品號就填空字串。價格只填數字不含符號。',
  };

  try {
    // 下載 PDF 轉 base64
    const pdfResp = await fetch(pdfUrl);
    if (!pdfResp.ok) throw new Error('PDF 下載失敗');
    const buffer = await pdfResp.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // 呼叫 Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: 'application/pdf', data: base64 } },
              { text: prompts[mode] || prompts.info }
            ]
          }]
        })
      }
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json({ result: parsed });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
