// Vercel サーバーレス関数：回答を受け取り、Gemini で7日間プランを作って返す
// 環境変数：GEMINI_API_KEY（発話くんと共通）

export const maxDuration = 60;

// コース情報はサーバー側で持つ（plan.html の COURSES と同じ内容に）
const COURSE_INFO = {
  "大人のやり直し英語55": {
    about: "日常英語に必要な55の英語の型（パターン）を、1週間に1つずつ、55週（約1年）かけて身につけるコース。文法も発音もあいまいな初心者向け。アプリで月〜日の曜日ごとにその日のメニューが決まっていて、1日約15分。主な教材：①mahoの文法解説ラジオ（ラジオ風に楽しく、型の使い方・動詞の使い分け・ネイティブ表現を学ぶ）②55の型でシャドーイング（イラスト付き、1文からできる）③リズムで学ぶ単語（日常英語に必要な2000語をリズムに乗せ、体を動かしながら覚える。発音や強弱も同時に身につく）④イメージして発話する瞬間英作文（その週の型の表現を、絵を見て状況をつかみ、すぐに英語で言う）⑤応用英作文（その週の型を使って、まだ習っていない表現を絵を見て即興で組み立てる）。各回は独立していて、できなかった週があっても次の月曜から新しい型で再スタートできる。アプリには常に最新20パターンが表示されるので、やり残しを気にせず進めてよい。",
    menu: ""
  },
  "日常Vlogコース": {
    about: "ネイティブの日常Vlogの英語を教材に、そのまま使える日常表現を身につけるコース。文法はある程度わかっていて、リスニング力と発話力を伸ばしたい人向け。アプリで月〜日の曜日ごとにその日のメニューが決まっていて、1日約15分。特徴：①I・You・Weで始まるシンプルな文が中心で、覚えたフレーズがそのまま日常会話で使える ②単語ではなくチャンク（英語のかたまり）で覚え、リズムに乗せて耳と口に残す ③4コマイラストを見て、覚えたチャンクを瞬時に組み合わせ、目の前の出来事を説明する練習 ④ネイティブ同士のリアルな発音・音のつながり（リンキング）の音声を真似してシャドーイング。初心者は再生速度を下げて挑戦するのがおすすめ。",
    menu: ""
  }
};
const COMMON = "mscの共通の仕組み：その日の学習を報告するオリジナルSNS（仲間の頑張りが見える）、担当講師への質問コーナー（質問し放題）。";

function buildPrompt(p) {
  return `あなたは英語学習コミュニティ「msc（maho shadowing club）」の学習コーチです。
mscは「英語を通して、自分の可能性を広げるきっかけをつくる」場所。シャドーイングを中心に、忙しい大人が無理なく続けられる学習を大切にしています。
以下の会員の回答とルールに従って、この人が「今日からすぐ真似できる」7日間の学習プランを日本語で作ってください。

# 会員が選んだコース：${p.course}
${p.courseAbout}
${p.common}
${p.menu ? "曜日ごとのメニュー：\n" + p.menu : ""}

# 会員の回答
${JSON.stringify(p.answers, null, 2)}

# ルール
- 新しい教材や勉強法を足すのではなく、コースで毎日決まっている約15分のメニューを「どうやると効果が上がるか」を深掘りする。コースの説明にない教材・アプリ・レッスン番号は作らない
- 「1日のやり方」は合計約${p.minutes}分。3〜5ステップに分け、各ステップの分数の合計を${p.minutes}分にする。15分を超える時間は、その日の教材の復習（同じ音声でもう1周シャドーイングする、言えなかった文だけ繰り返す など）に使う。15分より短い場合は、その日のメニューのどこを優先するかを示す
- 各ステップのやり方は、読んだらそのまま真似できるくらい具体的に書く（例：何回聞くか、スクリプトやイラストをいつ見るか、再生速度、声の大きさ、どこで止めるか）
- 7日間は3つのフェーズに分ける：フェーズ1＝Day1〜2、フェーズ2＝Day3〜5、フェーズ3＝Day6〜7。1日のやり方は同じまま、フェーズごとに「特に意識すること・変えること」を書く
- 「続かなかった理由」への対策を、忙しい日の最低ラインとコツに反映する。学習報告SNS・質問コーナー・できない週があっても再スタートできる仕組みなど、mscの仕組みを自然に活かす
- ニガテ分野と取り組みやすい時間帯を反映する
- 明るく前向きで、ワクワクする口調。上から目線にしない。絵文字は使わない

# 出力形式（JSONのみ。前置きやコードブロックは不要）
{
  "title": "この人の1週間を表す、わくわくする短い見出し（20字以内）",
  "message": "この人へのメッセージ。回答内容に触れながら2〜3文",
  "routine": [{"minutes": 数値, "step": "ステップ名（10字以内）", "how": "具体的なやり方（1〜2文）"}],
  "phases": [{"name": "フェーズ名（8字以内）", "goal": "このフェーズのゴール（1文）", "focus": "1日のやり方の中で特に意識すること・変えること（1〜2文）"}],
  "minimum": "忙しい日はこれだけでOK、という最低ライン（1文）",
  "tips": ["続けるためのコツ"]
}
routineは3〜5個、phasesは必ず3つ、tipsは2〜3個。`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const p = req.body || {};
  // 他の用途に使われないよう、受け取る内容をチェック
  const info = COURSE_INFO[p.course];
  if (!info || ![10, 15, 25, 30].includes(p.minutes) ||
      typeof p.answers !== "object" || JSON.stringify(p.answers).length > 2000) {
    return res.status(400).json({ error: "invalid input" });
  }
  // コース情報はページから送られたものではなく、サーバー側の内容を使う
  p.courseAbout = info.about; p.menu = info.menu; p.common = COMMON;

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
