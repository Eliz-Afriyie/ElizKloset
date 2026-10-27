import type { Metadata } from "next";
import Storefront from "../components/Storefront";

export const metadata: Metadata = { title: "Contact Us | ElizKloset", description: "Connect with ElizKloset on Instagram and TikTok for questions about our fashion collections." };

export default function ContactPage() { return <Storefront isContact />; }
