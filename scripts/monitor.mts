/** experimental, ignore me. */
import 'dotenv/config';
import atp from "@atproto/api";
import { Subscription } from '@atproto/xrpc-server'
import type {Commit,Handle,Migrate,Tombstone,Info} from "@atproto/api/dist/client/types/com/atproto/sync/subscribeRepos.js"
import { cborToLexRecord, readCar } from '@atproto/repo'
type RepoEvent = Commit|Handle|Migrate|Tombstone|Info|{ $type:string, [k: string]: unknown };

const {AtpAgent, ComAtprotoSyncSubscribeRepos: { isCommit }, AppBskyFeedPost: {isRecord: isPostRecord}} = atp;

const furListDID = "did:plc:jdkvwye2lf4mingzk7qdebzc";

async function main() {
    const agent = new AtpAgent({service: 'https://bsky.social'});
    await agent.login({
        identifier: process.env.BSKY_USER!,
        password: process.env.BSKY_PASSWORD!
    });

    const acceptableDIDs = {};

    let cursor = undefined;
    while (true) {
        console.log("Fetching more follows: ", cursor);
        const follows = await agent.api.app.bsky.graph.getFollows({ actor: furListDID, limit: 100, cursor });
        cursor = follows.data.cursor;
        for (const f of follows.data.follows) acceptableDIDs[f.did] = true;
        if (follows.data.follows.length < 100) break;
    }

    console.log("Done fetching follows: " + Object.keys(acceptableDIDs).length);

    let eventsReceived = 0;
    let startTime = new Date();

    const sub = new Subscription({
        service: 'wss://bsky.social',
        method: 'com.atproto.sync.subscribeRepos',
        getParams: () => ({}),
        validate: (value: unknown) => {
            try {
                return agent.api.xrpc.baseClient.lex.assertValidXrpcMessage<RepoEvent>('com.atproto.sync.subscribeRepos', value);
            } catch (err) {
                console.error('skipped invalid message: ', err);
            }
        },
    });

    for await (const evt of sub) {
        eventsReceived++;
        if (eventsReceived % 100 === 0) {
            console.log("Events Received:", eventsReceived);
            console.log("Events/S:", eventsReceived / ((new Date().getTime() - startTime.getTime())/1000));
        }

        if (isCommit(evt) && evt.repo in acceptableDIDs) {
            let car: Awaited<ReturnType<typeof readCar>> | null = null;
            for (const op of evt.ops) {
                if (op.action === "create" && op.path.startsWith("app.bsky.feed.post")) {
                    if (!op.cid) continue;
                    if (!car) car = await readCar(evt.blocks);

                    const recordBytes = car.blocks.get(op.cid);
                    if (!recordBytes) continue;
                    const record = cborToLexRecord(recordBytes);
                    if (!isPostRecord(record)) continue;
                    if (record.reply) continue;
                    if (!record.text.includes("🌀")) continue;
                    console.log("New Post by", evt.repo);
                    console.log("------------------------");
                    console.log(record.text);
                    console.log();
                }
            }
        }
    }
}

main().then();

