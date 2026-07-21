import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; info: string; }

export class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: "" };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: "" };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("╔══════════════════════════════════════════════════════════════");
    console.error("║ [DashboardErrorBoundary] RENDER CRASH CAUGHT");
    console.error("║ message   :", error.message);
    console.error("║ name      :", error.name);
    console.error("║ stack     :", error.stack);
    console.error("║ component :", info.componentStack);
    console.error("╚══════════════════════════════════════════════════════════════");
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 px-6 text-center bg-red-50">
          <p className="text-red-700 font-bold text-lg">Dashboard render crash</p>
          <p className="text-red-600 text-sm font-mono bg-red-100 px-4 py-2 rounded-lg max-w-md break-all">
            {this.state.error.message}
          </p>
          <p className="text-xs text-red-500">Check the browser console for the full stack trace.</p>
          <button
            onClick={() => { this.setState({ error: null, info: "" }); window.location.reload(); }}
            className="bg-red-600 text-white font-semibold px-5 py-2 rounded-xl"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
