export function BrandMark(props: { className?: string }) {
  return (
    <span aria-hidden="true" className={`brand-mark ${props.className ?? ""}`}>
      <span className="brand-mark__diamond brand-mark__diamond--coral" />
      <span className="brand-mark__diamond brand-mark__diamond--cyan" />
      <span className="brand-mark__light" />
    </span>
  );
}
