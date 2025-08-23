// @ts-ignore
import {createClient} from "npm:@supabase/supabase-js@2.45.4";

const userUtility = {
    generateUUID() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
            const arr = new Uint8Array(16);
            crypto.getRandomValues(arr);
            arr[6] = arr[6] & 0x0f | 0x40;
            arr[8] = arr[8] & 0x3f | 0x80;
            return [
                userUtility._byteToHex(arr[0]),
                userUtility._byteToHex(arr[1]),
                userUtility._byteToHex(arr[2]),
                userUtility._byteToHex(arr[3]),
                '-',
                userUtility._byteToHex(arr[4]),
                userUtility._byteToHex(arr[5]),
                '-',
                userUtility._byteToHex(arr[6]),
                userUtility._byteToHex(arr[7]),
                '-',
                userUtility._byteToHex(arr[8]),
                userUtility._byteToHex(arr[9]),
                '-',
                userUtility._byteToHex(arr[10]),
                userUtility._byteToHex(arr[11]),
                userUtility._byteToHex(arr[12]),
                userUtility._byteToHex(arr[13]),
                userUtility._byteToHex(arr[14]),
                userUtility._byteToHex(arr[15])
            ].join('');
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : r & 0x3 | 0x8).toString(16);
        });
    },
    _byteToHex(byte) {
        return byte.toString(16).padStart(2, '0');
    },
    isValidUUID(uuid) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
    },
    safeUUID(uuid) {
        return !uuid || uuid === '' || uuid === '0' ? null : uuid;
    }
};
console.info('User Utility Edge Function initialized');
Deno.serve(async (req) => {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/user-utility\/?/, '');
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });
    }
    switch (path) {
        case 'generate-uuid':
            return handleGenerateUUID();
        case 'validate-uuid':
            return handleValidateUUID(req);
        case 'safe-uuid':
            return handleSafeUUID(req);
        default:
            return new Response(JSON.stringify({
                available_endpoints: [
                    '/user-utility/generate-uuid',
                    '/user-utility/validate-uuid',
                    '/user-utility/safe-uuid'
                ]
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
    }
});

function handleGenerateUUID() {
    const uuid = userUtility.generateUUID();
    return new Response(JSON.stringify({
        uuid
    }), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

async function handleValidateUUID(req) {
    try {
        let uuid;
        if (req.method === 'GET') {
            const url = new URL(req.url);
            uuid = url.searchParams.get('uuid');
        } else if (req.method === 'POST') {
            const body = await req.json();
            uuid = body.uuid;
        }
        if (!uuid) {
            return new Response(JSON.stringify({
                error: 'UUID parameter is required'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
        const isValid = userUtility.isValidUUID(uuid);
        return new Response(JSON.stringify({
            uuid,
            isValid
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

async function handleSafeUUID(req) {
    try {
        let uuid;
        if (req.method === 'GET') {
            const url = new URL(req.url);
            uuid = url.searchParams.get('uuid');
        } else if (req.method === 'POST') {
            const body = await req.json();
            uuid = body.uuid;
        }
        if (uuid === undefined) {
            return new Response(JSON.stringify({
                error: 'UUID parameter is required'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
        const safeUuid = userUtility.safeUUID(uuid);
        return new Response(JSON.stringify({
            original: uuid,
            safeUuid
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
