"use client";

import { useEffect } from "react";
import { signOut } from "@/app/actions";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const LAST_ACTIVITY_KEY = "pocket-ledger-last-activity";
const TAB_ID_KEY = "pocket-ledger-session-tab-id";
const ACTIVE_TABS_KEY = "pocket-ledger-active-tabs";
const LAST_TAB_CLOSED_KEY = "pocket-ledger-last-tab-closed";
const TAB_HEARTBEAT_MS = 15 * 1000;
const STALE_TAB_MS = 60 * 1000;

export function SessionTimeout() {
  useEffect(() => {
    let timer: number | undefined;
    let signingOut = false;
    let activeTabs = readActiveTabs();
    const existingTabId = sessionStorage.getItem(TAB_ID_KEY);
    const tabId = existingTabId ?? crypto.randomUUID();
    let lastActivity = Number(sessionStorage.getItem(LAST_ACTIVITY_KEY));

    const closedTabAt = Number(localStorage.getItem(LAST_TAB_CLOSED_KEY));
    const isRecentLastTabClose =
      !existingTabId &&
      Number.isFinite(closedTabAt) &&
      closedTabAt > 0 &&
      Date.now() - closedTabAt < IDLE_TIMEOUT_MS &&
      Object.keys(activeTabs).length === 0;
    if (isRecentLastTabClose) {
      localStorage.removeItem(LAST_TAB_CLOSED_KEY);
      void signOut().catch((error: unknown) => {
        console.error("Could not sign out after the last dashboard tab closed.", error);
      });
      return;
    }

    sessionStorage.setItem(TAB_ID_KEY, tabId);
    localStorage.removeItem(LAST_TAB_CLOSED_KEY);
    activeTabs[tabId] = Date.now();
    saveActiveTabs(activeTabs);

    if (!Number.isFinite(lastActivity) || lastActivity <= 0) {
      lastActivity = Date.now();
      sessionStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivity));
    }

    const expireSession = () => {
      if (signingOut) return;
      signingOut = true;
      sessionStorage.removeItem(LAST_ACTIVITY_KEY);
      void signOut().catch((error: unknown) => {
        signingOut = false;
        console.error("Could not sign out after inactivity.", error);
        timer = window.setTimeout(expireSession, 5000);
      });
    };

    const scheduleExpiry = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivity);
      if (remaining <= 0) {
        expireSession();
        return;
      }
      timer = window.setTimeout(expireSession, remaining);
    };

    const recordActivity = () => {
      if (signingOut) return;
      if (Date.now() - lastActivity < 1000) return;
      lastActivity = Date.now();
      sessionStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivity));
      scheduleExpiry();
    };

    const checkExpiry = () => {
      if (Date.now() - lastActivity >= IDLE_TIMEOUT_MS) {
        expireSession();
      } else {
        scheduleExpiry();
      }
    };

    const heartbeat = window.setInterval(() => {
      activeTabs = readActiveTabs();
      activeTabs[tabId] = Date.now();
      saveActiveTabs(activeTabs);
    }, TAB_HEARTBEAT_MS);

    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) return;
      activeTabs = readActiveTabs();
      delete activeTabs[tabId];
      saveActiveTabs(activeTabs);
      if (Object.keys(activeTabs).length === 0) {
        localStorage.setItem(LAST_TAB_CLOSED_KEY, String(Date.now()));
      }
    };

    const initialTimer = window.setTimeout(checkExpiry, 0);
    const activityEvents = [
      "pointerdown",
      "pointermove",
      "keydown",
      "scroll",
      "touchstart",
    ] as const;
    activityEvents.forEach((event) =>
      window.addEventListener(event, recordActivity, { passive: true }),
    );
    document.addEventListener("visibilitychange", checkExpiry);
    window.addEventListener("pagehide", handlePageHide);
    scheduleExpiry();

    return () => {
      window.clearTimeout(initialTimer);
      if (timer !== undefined) window.clearTimeout(timer);
      window.clearInterval(heartbeat);
      activityEvents.forEach((event) =>
        window.removeEventListener(event, recordActivity),
      );
      document.removeEventListener("visibilitychange", checkExpiry);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  return null;
}

function readActiveTabs() {
  try {
    const saved = localStorage.getItem(ACTIVE_TABS_KEY);
    const parsed: Record<string, number> = saved ? JSON.parse(saved) : {};
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, timestamp]) =>
          Number.isFinite(timestamp) && now - timestamp < STALE_TAB_MS,
      ),
    );
  } catch (error) {
    console.error("Could not read active dashboard tabs.", error);
    return {};
  }
}

function saveActiveTabs(tabs: Record<string, number>) {
  try {
    localStorage.setItem(ACTIVE_TABS_KEY, JSON.stringify(tabs));
  } catch (error) {
    console.error("Could not update active dashboard tabs.", error);
  }
}
