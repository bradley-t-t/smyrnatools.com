declare global {
    const Deno: {
        env: { get(key: string): string | undefined };
        serve: (handler: (req) => Promise<Response>) => void;
    };
}

declare module "npm:*";

declare module "https://deno.land/*";

export {};
