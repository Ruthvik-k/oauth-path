import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">No guide here yet</h1>
      <p className="mt-2 text-slate-600">
        This guide doesn&apos;t exist, or it was generated on another server instance. Search for the app on the home page and an agent
        will research it live.
      </p>
      <Link href="/" className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">
        Find or generate a guide
      </Link>
    </div>
  );
}
