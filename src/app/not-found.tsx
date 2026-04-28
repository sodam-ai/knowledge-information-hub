import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center space-y-6">
        <div>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-100 rounded-2xl mb-4">
            <span className="text-2xl font-bold text-zinc-300">404</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-900">페이지를 찾을 수 없습니다</h1>
          <p className="mt-2 text-sm text-zinc-500">
            요청하신 페이지가 존재하지 않거나 이동되었습니다
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors"
        >
          대시보드로 이동
        </Link>
      </div>
    </div>
  );
}
