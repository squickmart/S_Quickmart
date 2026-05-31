export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, total, items } = req.body;

  const BOT_TOKEN = "8700564200:AAF2KVaU8E-Cu80SA4ZqBAIR6Hvg9XvF8jk";
  const CHAT_ID = "5153397698";

  const itemList = items
    ? items.map((i) => i.name + " x" + i.qty).join(", ")
    : "N/A";

  const message =
    "🛒 New Order — S_Quick Mart\n\n" +
    "👤 Customer: " + name + "\n" +
    "💰 Total: ₹" + total + "\n" +
    "📦 Items: " + itemList + "\n\n" +
    "⚡ Open panel to assign delivery!";

  await fetch(
    "https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text: message }),
    }
  );

  res.status(200).json({ ok: true });
}