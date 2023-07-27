import 'dotenv/config';
import {kv} from "@vercel/kv";
import chalk from "chalk";
import inquirer from "inquirer";
import {readFile} from "fs/promises";
import {existsSync} from "fs";
import atp from "@atproto/api";

const {AtpAgent} = atp;

async function main() {
    console.log(chalk.blueBright("--- atfeed management cli ---"));

    const feeds = await kv.smembers("feeds").orFail("getting feeds from database...");

    const agent = new AtpAgent({service: 'https://bsky.social'});
    await agent.login({
        identifier: process.env.BSKY_USER!,
        password: process.env.BSKY_PASSWORD!
    }).orFail("logging into bluesky...");

    let feed = await promptChoice("Feed to manage:", ["New Feed", new inquirer.Separator(), ...feeds]);

    // Create a new feed?
    if (feed === "New Feed") {
        feed = await promptText("Name of the New Feed:");

        ensure(feed && !feeds.includes(feed) && (/^[a-zA-Z0-9]$/).test(feed), "Invalid Feed Name");

        await kv.sadd("feeds", feed);
        feeds.push(feed);
    }

    // Handle invalid feeds
    ensure(feeds.includes(feed), "Invalid Feed");

    let feedMembers = await kv.smembers("feedusers_" + feed)
        .orFail("Fetching feed members...");

    console.log(chalk.blueBright(feed) + " - " + chalk.yellow(feedMembers.length + " members"));

    while (true) {
        let action = await promptChoice("Feed Action:", ["New Member", "Delete Feed", "Publish Feed", "Exit", new inquirer.Separator(), ...feedMembers]);

        if (action === "New Member") {
            let memberName = await promptText("New Member Name:");
            const memberDid = (await agent.com.atproto.identity.resolveHandle({handle: memberName})
                .orFail("Resolving member handle...")).data.did;

            await kv.sadd("feedusers_" + feed, memberDid + "; " + memberName)
                .orFail("Adding member...");

            feedMembers.push(memberDid + "; " + memberName);
        } else if (action === "Delete Feed") {
            let deleteFeedName = await promptText(chalk.red("Are you sure? Type the name of the feed to delete:"));
            ensure(deleteFeedName === feed, "Oops! Wrong feed name!");
            await kv.srem("feeds", feed)
                .orFail("Deleting feed...");
            process.exit(0);
        } else if (action === "Publish Feed") {
            let newAvatarPath: string | null = null;
            const record = await agent.api.com.atproto.repo.getRecord({
                    repo: agent.session!.did,
                    collection: "app.bsky.feed.generator",
                    rkey: feed
                })
                .then(r => r.data.value)
                .catch(_ => ({
                    did: process.env.FEED_DID!,
                    displayName: feed,
                    description: "",
                    createdAt: new Date().toISOString()
                })) as {
                displayName: string,
                did: string,
                description: string,
                avatar: any,
                createdAt: string
            };

            while (true) {
                console.log(chalk.blueBright("Display Name: ") + record.displayName);
                console.log(chalk.blueBright("Description: ") + record.description);
                console.log(chalk.blueBright("Avatar: ") + (newAvatarPath ? "To Be Set!" : (record.avatar ? "Set!" : "Not Set!")));

                const action = await promptChoice("Edit:", ["Display Name", "Description", "Avatar", "Save Changes", "Cancel"]);

                if (action === "Display Name") {
                    record.displayName = await promptText("New Display Name:");
                } else if (action === "Description") {
                    record.description = await promptText("New Description:");
                } else if (action === "Avatar") {
                    newAvatarPath = await promptText("Path to New Avatar File:", (input) => {
                        if (!existsSync(input)) return "No such file";
                        return true;
                    });
                } else if (action === "Save Changes") {
                    if (newAvatarPath !== null) {
                        const img = await readFile(newAvatarPath);
                        record.avatar = (await agent.api.com.atproto.repo.uploadBlob(img, {
                            encoding: newAvatarPath.endsWith(".png") ? "image/png" : "image/jpeg"
                        }).orFail("Uploading new avatar...")).data.blob;
                    }

                    await agent.api.com.atproto.repo.putRecord({
                        repo: agent.session!.did,
                        collection: "app.bsky.feed.generator",
                        rkey: feed,
                        record
                    }).orFail("Publishing changes...");
                    break;
                } else if (action === "Cancel") {
                    break;
                } else {
                    ensure(false, "Invalid Action");
                }
            }
        } else if (action === "Exit") {
            break;
        } else {
            ensure(feedMembers.includes(action), "Invalid Feed Member or Action");

            const member = action;
            let memberAction = await promptChoice("What to do with this member?", ["Nothing", "Replace", "Delete"]);

            if (memberAction === "Replace") {
                const replacementName = await promptText("New Member Name:");
                const replacementDid = (await agent.com.atproto.identity.resolveHandle({handle: replacementName})
                    .orFail("Resolving member handle..."))
                    .data.did;

                await kv.sadd("feedusers_" + feed, replacementDid + "; " + replacementName)
                    .orFail("Adding member...");

                await kv.srem("feedusers_" + feed, member)
                    .orFail("Removing old member...");

                feedMembers = feedMembers.filter(e => e !== member);
                feedMembers.push(replacementDid + "; " + replacementName);
            } else if (memberAction === "Delete") {
                await kv.srem("feedusers_" + feed, member)
                    .orFail("Removing old member...");
            }
        }
    }

    console.log("Goodbye!");
    process.exit(0);
}

const promptText = (message: string, validate?: (a: string) => (boolean | string)) => inquirer.prompt({ name: "r", message, validate }).then(({r}) => r as string)
const promptChoice = (message: string, choices: (string | inquirer.Separator)[]) => inquirer.prompt({ name: "r", type: "list", message, choices }).then(({ r }) => r as string)

declare global {
    interface Promise<T> {
        orFail(message:string): Promise<T>;
    }
}
Promise.prototype.orFail = async function <T>(message: string): Promise<T> {
    process.stdout.write(message);

    try {
        const res = await this;
        process.stdout.write("\r\x1b[K");
        console.log(chalk.green(message) + " ✅");
        return res;
    } catch (_) {
        process.stdout.write("\r\x1b[K");
        console.log(chalk.red(message) + "❌");
        process.exit(1)
    }
}


function ensure(t: boolean, message: string) {
    if (!t) {
        console.error(chalk.red(message));
        process.exit(1);
    }
}

main().then();
