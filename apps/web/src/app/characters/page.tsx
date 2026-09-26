import type { Metadata } from "next";
import { CharacterGallery } from "~/components/blog/character-gallery";
import { localizedAlternates } from "~/lib/seo";

export const metadata: Metadata = {
  alternates: localizedAlternates("en", "/characters/"),
  title: "Characters · Arlequin × Lumen",
  description:
    "Meet Arlequin and Lumen, the human and AI collaborator behind this portfolio.",
};

export default function CharactersPage() {
  return <CharacterGallery locale="en" />;
}
