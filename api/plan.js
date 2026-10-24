// Vercel サーバーレス関数：回答を受け取り、Gemini で1週間プランを作って返す
// 環境変数：GEMINI_API_KEY（発話くんと共通）

export const maxDuration = 60;

// コース情報はサーバー側で持つ（plan.html の COURSES と同じ内容に）
const COURSE_INFO = {
  "大人のやり直し英語55": {
    about: "日常英語に必要な55の英語の型（パターン）を、1週間に1つずつ、55週（約1年）かけて身につけるコース。文法も発音もあいまいな初心者向け。アプリで月〜日の曜日ごとにその日のメニューが決まっていて、1日約15分。主な教材：①mahoの文法解説ラジオ（ラジオ風に楽しく、型の使い方・動詞の使い分け・ネイティブ表現を学ぶ）②55の型でシャドーイング（イラスト付き、1文からできる）③リズムで学ぶ単語（日常英語に必要な2000語をリズムに乗せ、体を動かしながら覚える。発音や強弱も同時に身につく）④イメージして発話する瞬間英作文（その週の型の表現を、絵を見て状況をつかみ、すぐに英語で言う）⑤応用英作文（その週の型を使って、まだ習っていない表現を絵を見て即興で組み立てる）。各回は独立していて、できなかった週があっても次の月曜から新しい型で再スタートできる。アプリには常に最新20パターンが表示されるので、やり残しを気にせず進めてよい。",
    menu: [{"days": "月・火", "items": ["mahoの文法解説ラジオ", "文字ありシャドーイング", "リズム単語"]}, {"days": "水・木", "items": ["文字なしシャドーイング", "リズム単語（日本語のみ）", "瞬間英作文前半"]}, {"days": "金・土・日", "items": ["文字なしシャドーイング", "瞬間英作文後半", "応用英作文"]}]
  },
  "日常Vlogコース": {
    about: "ネイティブの日常Vlogの英語を教材に、そのまま使える日常表現を身につけるコース。文法はある程度わかっていて、リスニング力と発話力を伸ばしたい人向け。アプリで月〜日の曜日ごとにその日のメニューが決まっていて、1日約15分。特徴：①I・You・Weで始まるシンプルな文が中心で、覚えたフレーズがそのまま日常会話で使える ②単語ではなくチャンク（英語のかたまり）で覚え、リズムに乗せて耳と口に残す ③4コマイラストを見て、覚えたチャンクを瞬時に組み合わせ、目の前の出来事を説明する練習 ④ネイティブ同士のリアルな発音・音のつながり（リンキング）の音声を真似してシャドーイング。初心者は再生速度を下げて挑戦するのがおすすめ。",
    menu: [{"days": "月・火", "items": ["ネイティブ英語のヒアリング", "発音矯正＆フレーズ解説ラジオ", "文字ありシャドーイング", "リズムチャンク"]}, {"days": "水・木", "items": ["文字ありシャドーイング", "リズムチャンク（日本語のみ）"]}, {"days": "金・土・日", "items": ["文字なしシャドーイング", "リズムチャンク（日本語のみ）", "4コマ英作文", "ネイティブ速度シャドーイング"]}]
  }
};
const COMMON = "mscの共通の仕組み：その日の学習を報告するオリジナルSNS（仲間の頑張りが見える）、担当講師への質問コーナー（質問し放題）。";

function buildPrompt(p) {
  return `あなたは英語学習コミュニティ「msc（maho shadowing club）」の学習コーチです。
mscは「英語を通して、自分の可能性を広げるきっかけをつくる」場所。シャドーイングを中心に、忙しい大人が無理なく続けられる学習を大切にしています。
この会員のためだけの「1週間プラン」を作ってください。コースの紹介ではなく、この人の目標・ニガテ・生活・つまずき方から組み立てることが何より大事です。誰にでも当てはまる文章は書かないでください。

# 会員が選んだコース：${p.course}
${p.courseAbout}
${p.common}

# このコースの曜日ごとのメニュー（アプリで決まっている。1日約15分）
${p.menu.map(b => "・" + b.days + "：" + b.items.join("／")).join("\n")}
補足：「（日本語のみ）」は日本語を聞いて英語を自分で思い出して言う練習。「文字あり」はスクリプトを見ながら、「文字なし」は見ずに行うシャドーイング。

# 会員の回答
${JSON.stringify(p.answers, null, 2)}
使える時間の目安：1日約${p.minutes}分

# 作り方
1. type：回答（特に続かなかった理由・ニガテ・生活）から、この人を言い当てるオリジナルのタイプ名と説明を作る。読んだ人が「わかる、私だ」と思う内容に
2. goal：使いたい場面と目標から、1週間で達成できる具体的なゴールを1つ。「何を・どれだけ・何も見ずに言える／聞き取れる」のように、できたかどうか本人が確かめられる形に
3. focus：このコースのメニューの教材のうち、この人のニガテ・目標にとって特に大事なものを2〜3個選ぶ（教材名はメニューの表記どおり）。whyはこの人の回答に結びつけて書き、howはこの人のニガテに合わせた具体的なやり方（回数・再生速度・スクリプトを見るタイミング・できたらOKの基準など）
4. light：残りの教材から、この人は軽くでOKなものを1〜2個と、その理由・こなし方を1文で
5. week：月〜日の7日分。その曜日のメニューの範囲で、その日にやることをfocusを中心に1文で書く。時間帯は回答に合わせ、自由記述や使いたい場面に書かれた生活の様子もできるだけ反映する。忙しい曜日はbusyをtrueにして、最低限（5分程度）でOKな内容にする。minutesの目安は1日約${p.minutes}分
6. ifthen：続かなかった理由と生活から、この人がくじけそうな具体的な瞬間を予想し、「もし〜したら → これだけやる」を2〜3個。学習報告SNS・質問コーナー・できない週があっても次の月曜から再スタートできる仕組みなど、mscの仕組みも自然に使う
- メニューにない教材・アプリ・レッスン番号は作らない
- 明るく前向きで、ワクワクする口調。上から目線にしない。絵文字は使わない

# 出力形式（JSONのみ。前置きやコードブロックは不要）
{
  "title": "この人の1週間を表す、わくわくする見出し（20字以内）",
  "message": "この人へのメッセージ。回答に触れながら2文",
  "type": {"name": "タイプ名（15字以内）", "desc": "このタイプの説明と、だからこそ伸びるポイント（2文）"},
  "goal": "今週のゴール（1文）",
  "focus": [{"item": "教材名", "why": "この人にとって大事な理由（1文）", "how": "この人向けのやり方（2文）"}],
  "light": [{"item": "教材名", "note": "軽くでOKな理由とこなし方（1文）"}],
  "week": [{"day": "月", "when": "時間帯", "minutes": 数値, "busy": false, "todo": "その日にやること（1文）"}],
  "ifthen": [{"if": "もし〜したら", "then": "これだけやる"}]
}
weekは必ず月〜日の7つ。`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const p = req.body || {};
  // 他の用途に使われないよう、受け取る内容をチェック
  const info = COURSE_INFO[p.course];
  if (!info || ![10, 15, 25, 30].includes(p.minutes) ||
      typeof p.answers !== "object" || JSON.stringify(p.answers).length > 3000) {
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
