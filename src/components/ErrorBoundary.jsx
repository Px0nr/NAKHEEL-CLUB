import { Component } from "react";
import { C } from "../constants/theme.js";
import { Btn } from "./ui.jsx";

// يمنع خطأً في صفحة واحدة من إسقاط النظام كله بشاشة بيضاء —
// يُعاد تصيير الصفحة تلقائياً عند تغيير مفتاحها (resetKey) كي يعمل التنقّل الطبيعي كمخرج من الخطأ.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Nakheel — خطأ في الصفحة:", error, info);
  }
  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: C.cd, border: `0.5px solid ${C.bc}`, borderRadius: 13, padding: "2.5rem 1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.red, marginBottom: 6 }}>حدث خطأ غير متوقع في هذه الصفحة</div>
          <div style={{ fontSize: 12.5, color: C.mt, marginBottom: 18 }}>لم يتأثر باقي النظام أو بياناتك المحفوظة — جرّب العودة للوحة التحكم أو إعادة تحميل الصفحة.</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {this.props.onReset && <Btn gold onClick={this.props.onReset}>◂ العودة للوحة التحكم</Btn>}
            <Btn onClick={() => window.location.reload()}>⟳ إعادة تحميل الصفحة</Btn>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
