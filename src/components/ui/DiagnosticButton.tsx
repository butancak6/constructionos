import { useApp } from "../../context/AppContext";

export default function DiagnosticButton() {
  const { runDiagnostics } = useApp();

  return (
    <button
      onClick={runDiagnostics}
      className="fixed top-4 left-4 z-[99999] bg-red-600 text-white p-4 rounded-full shadow-xl font-bold text-xs hover:scale-110 transition-transform active:scale-95"
    >
      TEST CONNECTION
    </button>
  );
}
