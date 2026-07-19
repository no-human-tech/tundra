// Produkcyjny serwer statyczny frontendu (ADR-0016): zastępuje nginx, żeby
// każda warstwa Tundry działała na Node.js z jednego obrazu kontenera.
// Zero zależności — tylko moduły wbudowane; uruchamiany przez tsx
// (`pnpm --filter @tundra/web run serve`) po wcześniejszym `vite build`.

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIST_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "dist");
const HOST = process.env.WEB_HOST ?? "0.0.0.0";
const PORT = Number(process.env.WEB_PORT ?? process.env.PORT ?? 8080);

const CONTENT_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".txt": "text/plain; charset=utf-8",
	".map": "application/json",
	".webmanifest": "application/manifest+json",
};

function sendFile(res: ServerResponse, filePath: string, cacheControl: string): void {
	const stats = statSync(filePath);
	res.writeHead(200, {
		"Content-Type": CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream",
		"Content-Length": stats.size,
		"Cache-Control": cacheControl,
	});
	createReadStream(filePath).pipe(res);
}

if (!existsSync(join(DIST_DIR, "index.html"))) {
	console.error(
		`Missing ${join(DIST_DIR, "index.html")} — run \`pnpm --filter @tundra/web run build\` first.`,
	);
	process.exit(1);
}

const server = createServer((req, res) => {
	const method = req.method ?? "GET";
	if (method !== "GET" && method !== "HEAD") {
		res.writeHead(405, { Allow: "GET, HEAD" }).end();
		return;
	}

	let urlPath: string;
	try {
		urlPath = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
	} catch {
		// Malformed percent-encoding (e.g. "%zz") — reject instead of crashing the process.
		res.writeHead(400).end();
		return;
	}
	const candidate = resolve(DIST_DIR, `.${urlPath}`);

	// Ścieżka po resolve musi zostać wewnątrz dist — chroni przed traversal.
	if (
		candidate === DIST_DIR ||
		candidate.startsWith(DIST_DIR + "/") ||
		candidate.startsWith(DIST_DIR + "\\")
	) {
		if (existsSync(candidate) && statSync(candidate).isFile()) {
			// Pliki z /assets/ mają hash w nazwie (Vite) — mogą być cache'owane na zawsze.
			const cache = urlPath.startsWith("/assets/")
				? "public, max-age=31536000, immutable"
				: "no-cache";
			sendFile(res, candidate, cache);
			return;
		}
	}

	// SPA fallback: każda nieznana ścieżka dostaje index.html (routing kliencki).
	sendFile(res, join(DIST_DIR, "index.html"), "no-cache");
});

server.listen(PORT, HOST, () => {
	console.log(`tundra-web: serving ${DIST_DIR} on http://${HOST}:${PORT}`);
});

// Kubernetes wysyła SIGTERM przy rolloucie — domknij połączenia i wyjdź czysto.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
	process.on(signal, () => {
		server.close(() => process.exit(0));
		setTimeout(() => process.exit(0), 5000).unref();
	});
}
