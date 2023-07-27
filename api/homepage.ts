import type {VercelRequest, VercelResponse} from '@vercel/node';
import {kv} from "@vercel/kv";
import {makeClient} from "./xrpc/_shared.js";

export default async (request: VercelRequest, response: VercelResponse) => {
    const servers = await kv.smembers("feeds");
    const client = await makeClient();

    const serverInfos = await Promise.all(servers.map(s => client.com.atproto.repo.getRecord({
        repo: client.session!.did,
        collection: "app.bsky.feed.generator",
        rkey: s
    }).then(e => ({rkey: s, ...e.data.value as any}))));

    response.status(200).setHeader("Content-type", "text/html").send(`
        <!doctype html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport"
                  content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">
            <meta http-equiv="X-UA-Compatible" content="ie=edge">
            <title>Zyntaks' Bluesky Feeds</title>
            <style>
                body {
                    font-family: sans-serif;
                    margin: 2em;
                }

                h1 {
                    font-weight: normal;
                }

                a {
                    color: #18438b;
                    text-decoration: none;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
        <h1>Bluesky Feeds</h1>
        <p>
            This is a serverless bluesky feed generator running on <a href="https://github.com/furrz/atfeed">furrz/atfeed</a>.
        </p>
        <ul>
            ${serverInfos.map(s => `<li>
                <a href="https://bsky.app/profile/${client.session.did}/feed/${s.rkey}">${s.displayName}</a>
                - ${s.description}
            </li>`).join("")}
        </ul>
        </body>
        </html>
    `);
};
