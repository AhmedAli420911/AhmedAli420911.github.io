import type { Metadata } from "next";
import { siteTitle, siteDescription, siteConfig } from "../config/site";
import "./globals.css";
export const metadata: Metadata = {title: siteTitle, description: siteDescription, icons: {icon: "/favicon.svg"}, ...(siteConfig.websiteDomain ? {metadataBase: new URL(siteConfig.websiteDomain)} : {})};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
 return <html lang="en"><body>{children}</body></html>;
}
