import type {VercelRequest, VercelResponse} from '@vercel/node';
import {AppBskyFeedGetAuthorFeed} from "@atproto/api";
import {FeedViewPost} from "@atproto/api/dist/client/types/app/bsky/feed/defs.js";
import {makeClient, mergeSorted} from "./_shared.js";
import {kv} from "@vercel/kv";

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

    const client = await makeClient();

    const cursor = request.query.cursor?.toString() ?? undefined;
    const limit = request.query.limit ? parseInt(request.query.limit.toString()) : undefined;

    let feedData: FeedViewPost[] = [];
    let feedCursor: Date | null = null;
    let feedCursorFull: string | null = null;

    const actors = (await kv.smembers("feedusers_" + feedName)).map(k => k.split(";")[0]);

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

    if (limit && feedData.length > limit) {
        feedData.length = limit;
    }

    response.status(200).json({
        cursor: feedCursorFull ? feedCursorFull : undefined,
        feed: feedData.map(({post}) => ({post: post.uri}))
    });
};
