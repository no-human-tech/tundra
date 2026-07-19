/**
 * Auth context and provider for the Tundra web app.
 *
 * Manages the current user session. On mount the provider calls the `viewer`
 * query to restore an existing session from the HTTP-only cookie (if any). The
 * three actions — `login`, `register`, `logout` — call the REST endpoints and
 * then refresh the viewer on success.
 *
 * `useAuth()` throws at development time if used outside the provider so
 * missing wrappers surface immediately rather than silently returning null.
 */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { graphqlRequest } from "../api/client.js";
import { loginRequest, logoutRequest, registerRequest } from "../api/auth.js";
import type { ApiViewer } from "../api/queries.js";

const VIEWER_QUERY = /* GraphQL */ `
	query Viewer {
		viewer {
			userId
			displayName
			workspaceRole
			permissions
			isWorkspaceAdmin
		}
	}
`;

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
	status: AuthStatus;
	viewer: ApiViewer | null;
}

/** Value exposed by the auth context. */
export interface AuthContextValue extends AuthState {
	/**
	 * Attempt to log in with email + password. Returns `{}` on success or
	 * `{ error }` on failure (the raw `error` code from the API).
	 */
	login(email: string, password: string): Promise<{ error?: string }>;
	/**
	 * Create a new account. Returns `{}` on success or `{ error }` on failure.
	 */
	register(email: string, password: string, displayName: string): Promise<{ error?: string }>;
	/** Log out and clear the session cookie. */
	logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Wrap the app (or a subtree) to make auth state available via `useAuth()`. */
export function AuthProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<AuthState>({ status: "loading", viewer: null });
	// Guards the one-time session check below (StrictMode double-invokes
	// effects in development) so it never re-triggers.
	const checkedRef = useRef(false);

	useEffect(() => {
		if (checkedRef.current) return;
		checkedRef.current = true;
		graphqlRequest<{ viewer: ApiViewer }>(VIEWER_QUERY)
			.then(({ viewer }) => {
				setState({ status: "authenticated", viewer });
			})
			.catch(() => {
				setState({ status: "unauthenticated", viewer: null });
			});
	}, []);

	const fetchViewer = async (): Promise<ApiViewer | null> => {
		try {
			const { viewer } = await graphqlRequest<{ viewer: ApiViewer }>(VIEWER_QUERY);
			return viewer;
		} catch {
			return null;
		}
	};

	const login = async (email: string, password: string): Promise<{ error?: string }> => {
		const result = await loginRequest(email, password);
		if ("error" in result) {
			return { error: result.error };
		}
		const viewer = await fetchViewer();
		setState({
			status: "authenticated",
			viewer: viewer ?? {
				userId: result.userId,
				displayName: email,
				workspaceRole: null,
				permissions: [],
				isWorkspaceAdmin: false,
			},
		});
		return {};
	};

	const register = async (
		email: string,
		password: string,
		displayName: string,
	): Promise<{ error?: string }> => {
		const result = await registerRequest(email, password, displayName);
		if ("error" in result) {
			return { error: result.error };
		}
		const viewer = await fetchViewer();
		setState({
			status: "authenticated",
			viewer: viewer ?? {
				userId: result.userId,
				displayName,
				workspaceRole: null,
				permissions: [],
				isWorkspaceAdmin: false,
			},
		});
		return {};
	};

	const logout = async (): Promise<void> => {
		await logoutRequest();
		setState({ status: "unauthenticated", viewer: null });
	};

	return (
		<AuthContext.Provider value={{ ...state, login, register, logout }}>
			{children}
		</AuthContext.Provider>
	);
}

/** Access the auth context. Must be called inside an `AuthProvider`. */
export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error("useAuth must be called inside an AuthProvider");
	}
	return ctx;
}
