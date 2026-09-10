"use client";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { siteConfig } from "../../config/site";
import { emptyRequest, validateRequest, submitRequest, type ReviewRequest, requestSchema } from "./requests";

type ModelTool = { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean }; execute: (input: unknown) => unknown };
type ModelDocument = Document & { modelContext?: { registerTool: (tool: ModelTool, options: {signal: AbortSignal}) => void | Promise<void> } };
export function ReviewForm({ offline = false, privacyHref }: {offline?: boolean; privacyHref: string}) {
  const [values, setValues] = useState<ReviewRequest>({...emptyRequest});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const pending = useRef(false);
  useEffect(() => {
    const context = (document as ModelDocument).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tool: ModelTool = {
      name: "prepare_system_review_request", title: "Prepare a System Review request",
      description: "Stage a System Review request in the visible form and validate it. Does not send information. The visitor must review the form, give contact consent and press Request My System Review.",
      inputSchema: requestSchema, annotations: { readOnlyHint: false },
      execute(input) {
        if (pending.current) return {status: "busy"};
        if (!input || typeof input !== "object" || Array.isArray(input)) return {status: "invalid", error: "Expected request fields."};
        const record = input as Record<string, unknown>;
        if (Object.keys(record).some(key => !Object.hasOwn(requestSchema.properties, key))) return {status: "invalid", error: "Only fullName, email, company and problem can be prepared."};
        const next = {...emptyRequest};
        for (const key of Object.keys(next) as (keyof ReviewRequest)[]) {
          if (key === "consent") continue;
          if (record[key] !== undefined && typeof record[key] !== "string") return {status: "invalid", error: `Invalid ${key}.`};
          if (typeof record[key] === "string") next[key] = record[key];
        }
        const validation = validateRequest(next);
        flushSync(() => {setValues(next); setErrors(validation); setStatus("idle"); setMessage("");});
        formRef.current?.scrollIntoView({block: "start"});
        formRef.current?.querySelector<HTMLInputElement>("input")?.focus({preventScroll: true});
        return {status: "staged", errors: validation, submitted: false};
      },
    };
    try { void Promise.resolve(context.registerTool(tool, {signal: lifecycle.signal})).catch(() => { /* Progressive enhancement: the visible form remains available. */ }); }
    catch { /* Unsupported registries do not affect the visible form. */ }
    return () => lifecycle.abort();
  }, []);
  function change(key: keyof ReviewRequest, value: string | boolean) {
    setValues(previous => ({...previous, [key]: value}));
    setErrors(previous => { const next = {...previous}; delete next[key]; return next; });
    if (status !== "loading") {setStatus("idle"); setMessage("");}
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const nextErrors = validateRequest(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setStatus("error"); setMessage("Please check the highlighted fields and try again.");
      const first = Object.keys(nextErrors)[0];
      formRef.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    pending.current = true;
    setStatus("loading"); setMessage("");
    try {
      await submitRequest(values, offline ? "" : siteConfig.contactFormEndpoint, fetch,
        {provider: siteConfig.contactFormProvider, accessKey: siteConfig.contactFormAccessKey});
      setStatus("success"); setMessage("Request received. We’ll review the information and contact you using the details provided.");
      setValues({...emptyRequest});
    } catch (error) {
      setStatus("error"); setMessage(error instanceof Error ? error.message : "The request could not be sent. Please try again.");
    } finally { pending.current = false; }
  }
  const fields: {key: Exclude<keyof ReviewRequest, "consent" | "problem">; label: string; type?: string; auto?: string}[] = [
    {key: "fullName", label: "Full name", auto: "name"},
    {key: "email", label: "Business email", type: "email", auto: "email"},
    {key: "company", label: "Company name", auto: "organization"},
  ];
  return <form ref={formRef} noValidate onSubmit={submit} className="review-form" aria-label="System Review request">
    <p className="form-intro">A few details to start the conversation.<span>All fields are required. We’ll cover the remaining details during the review.</span></p>
    <fieldset disabled={status === "loading"}><legend className="sr-only">Your business and inquiry process</legend><div className="form-grid">
      {fields.map(field => <div className={field.key === "company" ? "field full" : "field"} key={field.key}>
        <label htmlFor={field.key}>{field.label}</label>
        <input id={field.key} name={field.key} type={field.type || "text"} autoComplete={field.auto} required maxLength={200} value={values[field.key]} onChange={event => change(field.key, event.target.value)} aria-invalid={Boolean(errors[field.key])} aria-describedby={errors[field.key] ? `${field.key}-error` : undefined}/>
        {errors[field.key] && <small id={`${field.key}-error`} className="field-error">{errors[field.key]}</small>}
      </div>)}
      <div className="field full"><label htmlFor="problem">Biggest inquiry-handling problem</label><textarea id="problem" name="problem" rows={4} maxLength={3000} required value={values.problem} onChange={event => change("problem", event.target.value)} aria-invalid={Boolean(errors.problem)} aria-describedby={errors.problem ? "problem-error" : "problem-hint"}/><small id="problem-hint">Describe the process. Please do not include customer information.</small>{errors.problem && <small id="problem-error" className="field-error">{errors.problem}</small>}</div>
    </div><label className="consent"><input name="consent" type="checkbox" checked={values.consent} required onChange={event => change("consent", event.target.checked)} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? "consent-error" : undefined}/><span>I agree that Service Capture Co. may contact me about this request.</span></label>{errors.consent && <small id="consent-error" className="field-error">{errors.consent}</small>}
    <p className="privacy-hint">Your details are used to review and respond to this request. <a href={privacyHref}>Privacy policy</a></p>
    <button className="button primary submit-button" type="submit">{status === "loading" ? <><LoaderCircle className="spin" size={18}/> Sending request…</> : <>Request My System Review <ArrowUpRight size={18}/></>}</button></fieldset>
    <div aria-live="polite" aria-atomic="true">{message && <p className={`form-message ${status}`} role={status === "error" ? "alert" : "status"}>{message}</p>}</div>
  </form>;
}
