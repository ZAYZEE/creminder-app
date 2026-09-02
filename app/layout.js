import "./globals.css";

export const metadata = { title: "Meyaad — expiry tracking" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
