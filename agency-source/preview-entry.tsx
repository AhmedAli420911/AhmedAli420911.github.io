import { createRoot } from "react-dom/client";
import { useEffect, useSyncExternalStore } from "react";
import { SitePage, type PageName } from "./components/service-capture/site";
import "./app/globals.css";
const pages = ["home", "services", "interactive-demo", "privacy", "terms", "accessibility", "404"];
const offline = document.documentElement.dataset.preview === "offline";
function subscribe(listener: () => void) {window.addEventListener("hashchange", listener); return () => window.removeEventListener("hashchange", listener);}
function snapshot() {return window.location.hash;}
let demoBlob = "";
function openDemo() {
  const data = document.getElementById("everwarm-data")?.textContent;
  if (!data) return;
  if (!demoBlob) {
    const bytes = Uint8Array.from(atob(data), character => character.charCodeAt(0));
    demoBlob = URL.createObjectURL(new Blob([bytes], {type: "text/html;charset=utf-8"}));
  }
  window.open(`${demoBlob}#system-demo`, "_blank", "noopener,noreferrer");
}
function Preview() {
  const hash = useSyncExternalStore(subscribe, snapshot, () => "");
  const route = offline ? hash.replace(/^#\//, "").split("?")[0] : window.location.pathname.replace(/^\/|\/$/g, "");
  const page = !route || (!hash.startsWith("#/") && offline) ? "home" : pages.includes(route) ? route as PageName : "404";
  useEffect(() => {
    if (!offline) return;
    const id = new URLSearchParams(hash.split("?")[1] || "").get("section");
    if (id) {document.getElementById(id)?.scrollIntoView(); if (id === "main-content") document.getElementById(id)?.focus();}
    else window.scrollTo(0, 0);
  }, [hash]);
  return <SitePage key={page} page={page} offline={offline} openDemo={offline ? openDemo : undefined}/>;
}
createRoot(document.getElementById("root")!).render(<Preview/>);
