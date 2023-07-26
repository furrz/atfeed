import type {VercelRequest, VercelResponse} from '@vercel/node';
import {AppBskyFeedGetAuthorFeed, AtpAgent} from "@atproto/api";
import {FeedViewPost} from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import {mergeSorted} from "./_shared";
import {kv} from "@vercel/kv";

const client = new AtpAgent({
    service: 'https://bsky.social',
    persistSession: (evt, session) => {
        kv.set("bsky_sesh", JSON.stringify(session)).then();
    }
});

export default async (request: VercelRequest, response: VercelResponse) => {
    const {feed} = request.query;

    const feedParts = feed.toString().split("/");
    const feedName = feedParts[feedParts.length - 1];
    if (!await kv.sismember("feeds", feedName)) {
        response.status(400).json({
            error: "No such feed"
        });
        return;
    }

    const sesh = await kv.get<string>('bsky_sesh');
    if (sesh) {
        client.session = (typeof sesh === 'object' ? sesh : JSON.parse(sesh));
    }

    if (!client.hasSession) {
        console.log("New session D:");
        await client.login({
            identifier: "zyntaks.ca",
            password: process.env.BSKY_PASSWORD
        });
    }

    const cursor = request.query.cursor?.toString() ?? undefined;
    const limit = request.query.limit ? parseInt(request.query.limit.toString()) : undefined;

    let feedData: FeedViewPost[] = [];
    let feedCursor: Date | null = null;
    let feedCursorFull: string | null = null;

    const actors = await kv.smembers("feedusers_" + feedName);

    const datas = (await Promise.allSettled(actors.map(actor =>
        client.api.app.bsky.feed.getAuthorFeed({ actor, cursor, limit }).catch(e => console.error(e))
    )))
        .filter(e => e.status === "fulfilled")
        .map(e => (e as PromiseFulfilledResult<AppBskyFeedGetAuthorFeed.Response>).value);

    for (const data of datas) {
        try {
            feedData = mergeSorted(feedData, data.data.feed.filter(e => !e.reason && !e.reply), (a, b) => new Date(a.post.indexedAt) > new Date(b.post.indexedAt));
            if (data.data.cursor && (!feedCursor || (new Date(parseInt(data.data.cursor.split('::')[0], 10)) > feedCursor))) {
                feedCursor = (new Date(parseInt(data.data.cursor.split('::')[0], 10)));
                feedCursorFull = data.data.cursor;
            }
        } catch (e) {
            console.error(e);
        }
    }

    response.status(200).json({
        cursor: feedCursorFull ? feedCursorFull : undefined,
        feed: feedData.map(({post}) => ({post: post.uri}))
    });
};
