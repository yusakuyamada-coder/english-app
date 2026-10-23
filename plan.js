// Vercel サーバーレス関数：回答を受け取り、Gemini で7日間プランを作って返す
// 環境変数：GEMINI_API_KEY（発話くんと共通）

export const maxDuration = 60;

const COURSES = ["日常Vlogコース", "大人のやり直し英語55"];

function buildPrompt(p) {
  return `あなたは英語学習コミュニティ「msc（maho shadowing club）」の学習コーチです。
mscは「英語を通して、自分の可能性を広げるきっかけをつくる」場所。シャドーイングを中心に、忙しい大人が無理なく続けられる学習を大切にしています。
以下の会員の回答とルールに従って、この人だけの「7日間の学習プラン」を日本語で作ってください。

# 会員の回答
${JSON.stringify(p.answers, null, 2)}

# ルール
- 使う教材は会員が選んだ「${p.course}」だけ。（${p.courseAbout}）
- 1日の学習時間はおよそ${p.minutes}分。7日目は振り返りの日にして軽めでもよい
- 「続かなかった理由」への具体的な対策を、7日間の流れに組み込む
- ニガテ分野と取り組みやすい時間帯を反映する
- 存在しない教材・アプリ・レッスン番号を作らない
- 明るく前向きで、ワクワクする口調。上から目線にしない。絵文字は使わない

# 出力形式（JSONのみ。前置きやコードブロックは不要）
{
  "title": "この人の1週間を表す、わくわくする短い見出し（20字以内）",
  "message": "この人へのメッセージ。回答内容に触れながら2〜3文",
  "days": [{"theme": "その日のテーマ（12字以内）", "tasks": ["具体的な取り組み（1文）"]}],
  "tips": ["続けるためのコツ"]
}
daysは必ず7つ、各日のtasksは2〜3個。tipsは2〜3個。`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const p = req.body || {};
  // 他の用途に使われないよう、受け取る内容をチェック
  if (!COURSES.includes(p.course) || ![10, 20, 30, 60].includes(p.minutes) ||
      typeof p.answers !== "object" || JSON.stringify(p.answers).length > 2000 ||
      String(p.courseAbout || "").length > 300) {
    return res.status(400).json({ error: "invalid input" });
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt(p) }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.9 }
        })
      }
    );
    if (!r.ok) return res.status(502).json({ error: "gemini error", status: r.status });
    const data = await r.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map(x => x.text || "").join("");
    const plan = JSON.parse(text.replace(/```json|```/g, "").trim());
    return res.status(200).json(plan);
  } catch (e) {
    return res.status(500).json({ error: "failed" });
  }
}
