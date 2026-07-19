import type { ReactNode } from "react";
import { act, render, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * Matches the future flags apps/web/src/main.tsx opts into for the real
 * BrowserRouter, so tests exercise the same routing behavior and don't print
 * React Router's v7 deprecation warnings for opt-ins this app already made.
 */
export const ROUTER_FUTURE_FLAGS = {
	v7_startTransition: true,
	v7_relativeSplatPath: true,
} as const;

/**
 * Flushes pending async work (rejected-fetch chains, i18next's own internal
 * promise hops on `changeLanguage`) inside an `act()` boundary.
 *
 * Every route tree that mounts `AuthProvider` kicks off a `viewer` fetch on
 * mount; `vitest.setup.ts` stubs `fetch` to reject immediately so that settles
 * fast, but the rejection still travels through several chained
 * `.then()`/`.catch()` hops (the GraphQL client, then the page's own loader,
 * then its component state setter) before it reaches a `setState` call. A
 * test that asserts immediately after `render()` (no `await`/`findBy`) closes
 * over `render()`'s own `act()` scope before those microtasks finish
 * draining, so the resulting state update fires outside any `act()` — React's
 * "not wrapped in act(...)" warning. A macrotask tick (`setTimeout`) only runs
 * once every currently-queued microtask has drained, however many hops they
 * take, so awaiting one inside `act()` reliably flushes the chain.
 */
export async function flushEffects(): Promise<void> {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

/** Render `ui` at `path` inside a MemoryRouter with the app's future flags set, then flush. */
export async function renderAtPath(path: string, ui: ReactNode): Promise<RenderResult> {
	const utils = render(
		<MemoryRouter initialEntries={[path]} future={ROUTER_FUTURE_FLAGS}>
			{ui}
		</MemoryRouter>,
	);
	await flushEffects();
	return utils;
}
