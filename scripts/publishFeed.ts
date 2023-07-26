import {AtpAgent} from "@atproto/api";
import {readFile} from "fs/promises";
import 'dotenv/config'

(async () => {
    const agent = new AtpAgent({service: 'https://bsky.social'});
    await agent.login({ identifier: "zyntaks.ca", password: process.env.BSKY_PASSWORD! });

    await agent.api.app.bsky.feed.describeFeedGenerator()

    const img = await readFile("./scripts/avatar.png");
    const blob = (await agent.api.com.atproto.repo.uploadBlob(img, {
        encoding: "image/png"
    })).data.blob;

    const res = await agent.api.com.atproto.repo.putRecord({
        repo: agent.session!.did,
        collection: "app.bsky.feed.generator",
        rkey: "gooey",
        record: {
            did: "did:web:feed.zyntaks.ca",
            displayName: "Gooey Furs",
            description: "Drippy, gooey, rubbery...~",
            avatar: blob,
            createdAt: new Date().toISOString()
        }
    });

    console.log(res);

    console.log("Done!");
})();