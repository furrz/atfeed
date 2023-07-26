import {kv} from "@vercel/kv";

import * as atp from "@atproto/api";
// Some Nonsense To Make TSLint and TS-Node simultaneously happy with this import.
// I don't know why in the world I was forced to do this. :(
let AtpAgent = atp.AtpAgent;
if ((atp as any).default) AtpAgent = (atp as any).default.AtpAgent;


export async function makeClient() {

    const client = new AtpAgent({
        service: 'https://bsky.social',
        persistSession: (evt, session) => {
            kv.set("bsky_sesh", JSON.stringify(session)).then();
        }
    });

    const sesh = await kv.get<string>('bsky_sesh');
    if (sesh) {
        client.session = (typeof sesh === 'object' ? sesh : JSON.parse(sesh));
    }

    if (!client.hasSession) {
        console.log("New session D:");
        await client.login({
            identifier: process.env.BSKY_USER,
            password: process.env.BSKY_PASSWORD
        });
    }

    return client;
}

export function mergeSorted<T>(arr1: T[], arr2: T[], compareLessThan: (a: T, b: T) => boolean) {
    let merged: T[] = [];
    let index1 = 0;
    let index2 = 0;
    let current = 0;

    while (current < (arr1.length + arr2.length)) {

        let isArr1Depleted = index1 >= arr1.length;
        let isArr2Depleted = index2 >= arr2.length;

        if (!isArr1Depleted && (isArr2Depleted || compareLessThan(arr1[index1], arr2[index2]))) {
            merged[current] = arr1[index1];
            index1++;
        } else {
            merged[current] = arr2[index2];
            index2++;
        }

        current++;
    }

    return merged;
}
