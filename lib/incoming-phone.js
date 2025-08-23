// -----------------------------------------------------------------------------
// Imports and globals
// -----------------------------------------------------------------------------
import { callMessageHandler } from "./incoming-call.js";

// -----------------------------------------------------------------------------
// phoneMessageHandler (alias for callMessageHandler)
// -----------------------------------------------------------------------------
export async function phoneMessageHandler(msg) {
  await callMessageHandler(msg);
}
