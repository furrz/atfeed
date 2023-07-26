import type { VercelRequest, VercelResponse } from '@vercel/node';
import {feedURI} from "./_shared";
import { kv } from "@vercel/kv";

export default async (request: VercelRequest, response: VercelResponse) => {
    response.status(200).json({
        did: "did:web:feed.zyntaks.ca",
        feeds: (await kv.smembers("feeds")).map(e => ({"uri": feedURI + e}))
    });
};
