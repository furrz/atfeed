import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from "@vercel/kv";

const feedURI = "at://" + process.env.FEED_DID! + "/app.bsky.feed.generator/";


export default async (request: VercelRequest, response: VercelResponse) => {
    response.status(200).json({
        did: process.env.FEED_DID!,
        feeds: (await kv.smembers("feeds")).map(e => ({"uri": feedURI + e}))
    });
};
