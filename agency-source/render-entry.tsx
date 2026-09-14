import { renderToString } from "react-dom/server";
import { SitePage, type PageName } from "./components/service-capture/site";
export { siteTitle, siteDescription, siteConfig } from "./config/site";
export function render(page: PageName, offline = false) {return renderToString(<SitePage page={page} offline={offline} openDemo={offline ? () => {} : undefined}/>);}
