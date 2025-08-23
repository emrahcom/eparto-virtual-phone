// Enable debug logs.
// Disable this parameter before releasing.
export const DEBUG = true;

// Use this base URL if there is no custom one.
export const DEFAULT_BASE_URL = "https://app.eparto.net";

// Interval in minutes to update the presence.
export const INTERVAL_PING = 1;

// Interval in minutes to pull the intercom messages.
export const INTERVAL_INTERCOM_PULLING = 2 / 60;

// Expire time in minutes for outgoing call.
export const EXPIRE_TIME_OUTCALL = 30 / 60;

// Expire time in minutes for incoming call.
// This should be longer than EXPIRE_TIME_OUTCALL to avoid causing premature
// termination.
export const EXPIRE_TIME_INCALL = 1;

// Watch period in milliseconds for incoming call.
export const WATCH_PERIOD_INCALL = 1000;

// The initial delay in milliseconds for incoming text.
export const WATCH_DELAY_INTEXT = 30 * 1000;

// Watch period in milliseconds for incoming text.
export const WATCH_PERIOD_INTEXT = 300 * 1000;

// Expire time in minutes for incoming text.
// Text messages are stored on the server-side for a maximum of 8 hours if the
// receiver doesnt check. Checked messages are deleted immediately.
export const EXPIRE_TIME_INTEXT = 8 * 60;

// Number of allowed popups at a time.
export const NUMBER_OF_ALLOWED_POPUPS = 5;

// The size of the incoming call popup.
export const POPUP_INCALL_WIDTH = 320;
export const POPUP_INCALL_HEIGHT = 120;

// The size of the incoming text popup.
export const POPUP_INTEXT_WIDTH = 320;
export const POPUP_INTEXT_HEIGHT = 120;
