import type { Metadata } from "next";
import { FictionIndex } from "~/components/blog/fiction-pages";
export const metadata: Metadata = {
  title: "Fiction · 여백의 사람들",
  description: "하나의 세계, 저마다의 삶. 짧은 판타지 옴니버스.",
};
export default function Page() {
  return <FictionIndex locale="en" />;
}
