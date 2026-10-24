import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import "./styles/globals.css";

const AppRoutes = lazy(() => import("./routes/AppRoutes"));

const hasSupabaseConfig = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function App() {
  if (!hasSupabaseConfig) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section className="max-w-lg rounded-xl bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Clinic setup required</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Add your Supabase project URL and anon key to <code>frontend/.env</code>, then restart the dev server.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-100 p-4 text-xs text-slate-700">VITE_SUPABASE_URL=your-project-url{"\n"}VITE_SUPABASE_ANON_KEY=your-anon-key</pre>
        </section>
      </main>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<main className="min-h-screen bg-slate-50" />}>
        <AppRoutes />
      </Suspense>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

