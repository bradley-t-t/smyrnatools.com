declare global {
    const Deno: {
        env: { get(key: string): string | undefined };
        serve: (handler: (req: Request) => Response | Promise<Response>) => void;
    };
}

declare module "npm:*";

declare module "https://deno.land/*";

export {};
