// Enable debug logs.
export const DEBUG = true;

// Use this base URL if there is no custom one.
export const DEFAULT_BASE_URL = "https://app.eparto.net";

// Expire time in minutes for incoming text.
export const INTEXT_EXPIRE_TIME = 8 * 60;

// Expire time in minutes for incoming call.
export const INCALL_EXPIRE_TIME = 1;

// Expire time in minutes for outgoing call.
export const OUTCALL_EXPIRE_TIME = 0.5;

// Number of allowed popups at a time.
export const NUMBER_OF_ALLOWED_POPUPS = 5;

// Ping interval in minutes to update the presence.
export const INTERVAL_PING = 1;

// Pull interval in minutes to pull the intercom messages.
export const INTERVAL_INTERCOM_PULL = 0.030;

// Call popup size in pixel
export const CALL_POPUP_WIDTH = 320;
export const CALL_POPUP_HEIGHT = 120;

// Text popup size in pixel
export const TEXT_POPUP_WIDTH = 320;
export const TEXT_POPUP_HEIGHT = 120;
