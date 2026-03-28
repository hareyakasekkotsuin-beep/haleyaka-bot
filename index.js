// ==========================================
// はれやか接骨院 LINE AIチャットボット
// OpenAI (GPT-4o-mini) 版
// ==========================================
require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const OpenAI = require('openai');

const app = express();

// LINE設定
const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};
const lineClient = new line.messagingApi.MessagingApiClient(lineConfig);

// OpenAI設定
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 会話履歴（患者さんごとに記憶）
const histories = new Map();

// ========================================
// ★ ここを院の情報に合わせて編集してください
// ========================================
const SYSTEM_PROMPT = `あなたは「はれやか接骨院」の公式LINEアシスタントです。
患者さんからのメッセージに、明るく丁寧に答えてください。

【院の基本情報】
- 院名：はれやか接骨院
- 住所：埼玉県熊谷市（べっぷ地区）
- 電話：（← 実際の番号を入れてください）
- 営業時間：平日 9:00〜20:00、土曜 9:00〜18:00
- 定休日：日曜・祝日
- 駐車場：あり（○台）

【対応できる質問】
- 営業時間・定休日について
- アクセス・駐車場について
- 施術メニューや料金について
- 予約方法について
- その他よくある質問

【よくある質問と回答】
Q: 予約は必要ですか？
A: ご予約優先で承っております。お電話またはLINEからご連絡ください。

Q: 初めてなのですが何を持っていけばいいですか？
A: 保険証をお持ちください。動きやすい服装でお越しいただけると施術がスムーズです。

Q: 交通事故でも診てもらえますか？
A: はい、交通事故による症状にも対応しております。まずはお電話でご相談ください。

Q: 料金はいくらですか？
A: 保険適用の場合は窓口負担が数百円程度です。詳しくはお電話でご確認ください。

【回答のルール】
- 200文字以内で簡潔に答える
- 絵文字を1〜2個使って親しみやすくする
- 分からない質問は「詳しくはお電話でご確認ください😊」と案内する
- 医療的な診断・症状の判断はしない`;

// AI返答を生成する関数
async function generateReply(userId, message) {
  if (!histories.has(userId)) histories.set(userId, []);
  const hist = histories.get(userId);
  hist.push({ role: 'user', content: message });
  if (hist.length > 20) hist.splice(0, 2);

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 400,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...hist,
    ],
  });

  const reply = res.choices[0].message.content;
  hist.push({ role: 'assistant', content: reply });
  return reply;
}

// LINEからメッセージを受け取るエンドポイント
app.post('/webhook',
  line.middleware(lineConfig),
  async (req, res) => {
    res.status(200).end();
    for (const event of req.body.events) {
      if (event.type !== 'message' || event.message.type !== 'text') continue;
      try {
        const reply = await generateReply(event.source.userId, event.message.text);
        await lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: reply }],
        });
      } catch (e) {
        console.error(e);
        await lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: '申し訳ありません、少し時間をおいて再度お試しください🙏' }],
        });
      }
    }
  }
);

app.listen(process.env.PORT || 3000, () => console.log('Bot started!'));
