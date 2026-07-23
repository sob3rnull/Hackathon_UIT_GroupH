import type { Locale } from "./context";

type T = (key: string, vars?: Record<string, string | number>) => string;

/**
 * API routes always answer in English (`{ ok: false, error: "..." }`) — the
 * server doesn't know the caller's locale, and threading it through every
 * route handler for a handful of static strings isn't worth it. This maps
 * the known literals back to the dictionary when displaying them; anything
 * unrecognized (Zod's auto-generated field messages, Supabase Auth SDK
 * text) passes through in English rather than showing a broken translation.
 */
const KNOWN: Record<string, string> = {
  "Body must be JSON": "errors.bodyMustBeJson",
  "Invalid input": "errors.invalidInput",
  "Failed to load": "errors.failedToLoad",
  "Update failed": "errors.updateFailed",
  "Dispatch failed": "errors.dispatchFailed",
  "Donation failed": "errors.donationFailed",
  "Triage failed": "errors.triageFailed",
  "Transcription failed": "errors.transcriptionFailed",
  "Ranking failed": "errors.rankingFailed",
  "Routes request failed": "errors.routesRequestFailed",
  "No route returned": "errors.noRouteReturned",
  "No transcription key configured": "errors.noTranscriptionKey",
  "Body must be multipart form data": "errors.mustBeMultipart",
  "Attach the recording as the 'audio' field": "errors.attachRecording",
  "Invalid or expired verification code": "errors.invalidOtp",
  "Please tell us your name": "errors.pleaseGiveName",
  "Amount must be positive": "errors.amountMustBePositive",
  "Describe the patient": "errors.describePatient",
};

export function translateApiError(message: string, t: T, locale: Locale): string {
  if (locale === "en") return message;
  const key = KNOWN[message];
  return key ? t(key) : message;
}
