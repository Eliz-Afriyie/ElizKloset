import Icon from "./Icon";

export default function ContentIcon({ name }: { name: string }) {
  const aliases: Record<string, Parameters<typeof Icon>[0]["name"]> = { gem: "diamond", diamond: "diamond", truck: "truck", lock: "lock", "credit-card": "card", card: "card", headset: "headset", headphones: "headset", heart: "heart", user: "user", whatsapp: "headset", phone: "headset", "arrow-right": "arrow" };
  return <Icon name={aliases[name] || "diamond"} />;
}
