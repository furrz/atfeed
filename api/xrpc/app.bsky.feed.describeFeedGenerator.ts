import type { VercelRequest, VercelResponse } from '@vercel/node';
import {feedURI} from "./_shared.js";
import { kv } from "@vercel/kv";

export default async (request: VercelRequest, response: VercelResponse) => {
    response.status(200).json({
        did: process.env.FEED_DID!,
        feeds: (await kv.smembers("feeds")).map(e => ({"uri": feedURI + e}))
    });
};
