export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, total, items } = req.body;

  const BOT_TOKEN = "8700564200:AAF2KVaU8E-Cu80SA4ZqBAIR6Hvg9XvF8jk";
  const CHAT_ID = "-5110398756";

  const isYourNeed = total === "YourNeed Request";

  const itemList = items && items.length
    ? items.map((i) => "• " + (i.name || i) + (i.qty ? " ×" + i.qty : "")).join("\n")
    : "N/A";

  const message = isYourNeed
    ? "🎯 New YourNeed Request — S_Quick Mart\n\n" +
      "👤 Customer: " + name + "\n" +
      "📦 Items: " + itemList + "\n\n" +
      "⚡ Open panel to confirm!"
    : "🛒 New Order — S_Quick Mart\n\n" +
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