// Public configuration only: everything in this file ships to the browser.
// Never put credentials, API keys or the private inquiry mailbox here. The
// recipient mailbox and the email-provider key live server-side in
// ../cloudflare/wrangler.jsonc (vars) and Cloudflare secrets.
// See README.md for accepted URL formats, form contract and launch requirements.
export const siteConfig = {
  websiteDomain: "https://servicecaptureco.com",
  businessEmail: "hello@servicecaptureco.com",
  businessPhone: "+1 647-510-1465",
  mailingAddress: "",
  calendarUrl: "https://calendar.app.google/j1aRFzNcKrRw3qVg9",
  contactFormEndpoint: "/api/review",
  everWarmDemoUrl: "/demo/#system-demo",
  analyticsId: "",
  analyticsConsentApproach: "",
};
export const siteTitle = "HVAC Websites and Inquiry Systems | Service Capture Co.";
export const siteDescription = "Service Capture Co. helps independent HVAC companies improve how customers find them, request service and move through the inquiry process, with websites, inquiry-capture systems and custom workflow automation.";
