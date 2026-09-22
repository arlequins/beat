import type { Metadata } from "next";
import { FictionIndex } from "~/components/blog/fiction-pages";
export const metadata: Metadata = {
  title: "Fiction · 소설 목록",
  description: "서로 다른 세계와 사람들의 이야기를 골라 읽는 소설 목록.",
};
export default function Page() {
  return <FictionIndex locale="en" />;
}
