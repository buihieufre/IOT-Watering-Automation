"use client";

import "./globals.css";
import type { ReactNode } from "react";
import { Toaster } from "react-hot-toast";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <title>Điều Khiển Tưới Cây Tự Động</title>
      </head>
      <body className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 text-slate-900">
        <div className="max-w-md mx-auto p-4">{children}</div>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#fff",
              color: "#333",
              borderRadius: "12px",
              padding: "12px 16px",
              fontSize: "14px",
            },
            success: {
              iconTheme: {
                primary: "#10b981",
                secondary: "#fff",
              },
            },
            error: {
              iconTheme: {
                primary: "#ef4444",
                secondary: "#fff",
              },
            },
          }}
        />
      </body>
    </html>
  );
}
