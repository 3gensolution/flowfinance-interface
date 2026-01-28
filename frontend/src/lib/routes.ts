const API_VERSION = "api";

// TODO: Add other routes spec as needed
export const ROUTES_SPEC = {
  generateLink: `/${API_VERSION}/kyc/links/generate`,
} as const;

export const ROUTES = Object.fromEntries(Object.keys(ROUTES_SPEC).map((key) => [key, key])) as {
  [K in keyof typeof ROUTES_SPEC]: K;
};

type DynamicRoute<T extends string[] = string[]> = (...args: T) => string;
type RouteValueParameters<T> = T extends DynamicRoute<infer P> ? P : [];

/**
 * Resolves a route key to a URL string.
 * If the route is a string, returns it directly.
 * If the route is a function, calls it with the given arguments.
 *
 * @param key - The key of the route to resolve
 * @param args - Parameters required if the route is a function
 * @returns The fully resolved URL string
 */
export function resolveRoute<K extends keyof typeof ROUTES_SPEC>(
  key: K,
  ...args: RouteValueParameters<(typeof ROUTES_SPEC)[K]>
): string {
  const route = ROUTES_SPEC[key];

  if (typeof route === "string") {
    return route;
  }

  // @ts-expect-error - route is a function when not a string, args typing is complex
  return route(...args);
}

