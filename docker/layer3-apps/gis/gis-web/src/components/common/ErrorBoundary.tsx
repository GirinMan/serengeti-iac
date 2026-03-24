import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
          <div className="text-lg font-semibold text-red-600">오류가 발생했습니다</div>
          <div className="max-w-md text-center text-sm text-gray-600">
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
