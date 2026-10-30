import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GraphRAG — Source-Grounded Knowledge Assistant',
  description: 'Grounded retrieval-augmented generation powered by knowledge graphs and Groq LLM inference',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
        {children}
      </body>
    </html>
  );
}

