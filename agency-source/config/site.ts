// Public configuration only. Never put credentials or API keys in this file.
// See README.md for accepted URL formats, form contract and launch requirements.
export const siteConfig = {
  websiteDomain: "",
  businessEmail: "",
  businessPhone: "",
  mailingAddress: "",
  calendarUrl: "",
  contactFormEndpoint: "",
  // Adapter for an endpoint that cannot return {"accepted":true}. Leave
  // contactFormProvider empty for a plain endpoint that already can.
  contactFormProvider: "" as "" | "web3forms",
  // Public by design: a Web3Forms access key identifies the destination
  // inbox and is meant to ship in the browser bundle. Not a secret, and
  // not a substitute for one — never put a private API key here.
  contactFormAccessKey: "",
  everWarmDemoUrl: "/demo/#system-demo",
  analyticsId: "",
  analyticsConsentApproach: "",
};
export const siteTitle = "HVAC Inquiry and Missed-Call Systems | Service Capture Co.";
export const siteDescription = "Service Capture Co. builds website and call-intake systems that help independent HVAC companies capture, route and track customer inquiries.";
