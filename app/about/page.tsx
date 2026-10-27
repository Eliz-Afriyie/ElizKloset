import type { Metadata } from "next";
import Storefront from "../components/Storefront";

export const metadata: Metadata = {
  title: "About Us | ElizKloset",
  description: "Meet ElizKloset, the Ghanaian fashion business led by CEO Ms. Elizabeth Afriyie, offering corporate wear and everyday essentials for women and men.",
};

export default function AboutPage() { return <Storefront isAbout />; }

