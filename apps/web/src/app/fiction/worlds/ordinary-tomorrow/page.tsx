import {
  OrdinaryTomorrowGuide,
  ordinaryTomorrowMetadata,
} from "~/components/blog/ordinary-tomorrow-guide";

export const metadata = ordinaryTomorrowMetadata;

export default function Page() {
  return <OrdinaryTomorrowGuide locale="en" />;
}
