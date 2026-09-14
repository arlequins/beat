import { FictionGuide } from "~/components/blog/fiction-guide-pages";
export const metadata = {
  title: "설정집 · 여백의 사람들",
  description: "검토 전 초안: 세계관, 지도, 국가, 인물과 한국어 문체 기준",
};
export default function Page() {
  return <FictionGuide locale="en" />;
}
