export function genBarcode(products) {
  const year = new Date().getFullYear();
  return "NKH" + year + String(products.length + 1).padStart(4, "0");
}
export function BarcodeSVG({ code }) {
  if (!code) return null;
  let x = 4; const bars = [];
  for (let i = 0; i < code.length; i++) {
    const cc = code.charCodeAt(i);
    const w1 = (cc % 3) + 1, w2 = ((cc >> 2) % 3) + 1, w3 = ((cc >> 4) % 2) + 1;
    bars.push(<rect key={i + "a"} x={x} y={2} width={w1} height={32} fill="#fff" />); x += w1 + 1;
    bars.push(<rect key={i + "b"} x={x} y={2} width={w2} height={32} fill="#fff" />); x += w2 + 2;
    bars.push(<rect key={i + "c"} x={x} y={2} width={w3} height={32} fill="#fff" />); x += w3 + 1;
  }
  return (
    <div style={{ background: "#111", borderRadius: 7, padding: ".5rem", textAlign: "center" }}>
      <svg viewBox={`0 0 ${x + 4} 36`} style={{ height: 34, width: "100%" }}><rect x="0" y="0" width={x + 4} height="36" fill="#111" />{bars}</svg>
      <div style={{ color: "#fff", fontFamily: "monospace", fontSize: 11, letterSpacing: 2, marginTop: 2 }}>{code}</div>
    </div>
  );
}
