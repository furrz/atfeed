
import 'dotenv/config';
import { kv } from "@vercel/kv";
import chalk from "chalk";
import inquirer from "inquirer";
import * as atp from "@atproto/api";
import {readFile} from "fs/promises";
import { existsSync} from "fs";

// Some Nonsense To Make TSLint and TS-Node simultaneously happy with this import.
// I don't know why in the world I was forced to do this. :(
let AtpAgent = atp.AtpAgent;
if ((atp as any).default) AtpAgent = (atp as any).default.AtpAgent;

async function main() {
    console.log(atp);
    console.log(chalk.blueBright("--- atfeed management cli ---"));

    const feeds = await orFail("getting feeds from database...",
        () => kv.smembers("feeds"));

    const agent = new AtpAgent({service: 'https://bsky.social'});
    await orFail("logging into bluesky...", () => agent.login({ identifier: process.env.BSKY_USER!, password: process.env.BSKY_PASSWORD! }));

    let { feed } = await inquirer.prompt({
        name: "feed",
        type: "list",
        message: "Feed to manage:",
        choices: ["New Feed", new inquirer.Separator(), ...feeds]
    });

    // Create a new feed?
    if (feed === "New Feed") {
        feed = (await inquirer.prompt({
            name: "feedName",
            type: "input",
            message: "Name of the New Feed:"
        })).feedName;

        ensure(feed && !feeds.includes(feed) && (/^[a-zA-Z0-9]$/).test(feed), "Invalid Feed Name");

        await kv.sadd("feeds", feed);
        feeds.push(feed);
    }

    // Handle invalid feeds
    ensure(feeds.includes(feed), "Invalid Feed");

    let feedMembers = await orFail("Fetching feed members...", () => kv.smembers("feedusers_" + feed));
    console.log(chalk.blueBright(feed) + " - " + chalk.yellow(feedMembers.length + " members"));

    while (true) {
        let {action} = await inquirer.prompt({
            name: "action",
            type: "list",
            message: "Feed Action:",
            choices: ["New Member", "Delete Feed", "Publish Feed", "Exit", new inquirer.Separator(), ...feedMembers]
        });

        if (action === "New Member") {
            let { memberName } = await inquirer.prompt({
                name: "memberName",
                message: "New Member Name:"
            });
            const memberDid = (await orFail("Resolving member handle...", () => agent.com.atproto.identity.resolveHandle({ handle: memberName }))).data.did;

            await orFail("Adding member...", () => kv.sadd("feedusers_" + feed, memberDid + "; " + memberName));
            feedMembers.push(memberDid + "; " + memberName);
        } else if (action === "Delete Feed") {
            let {deleteFeedName} = await inquirer.prompt({
                name: "deleteFeedName",
                message: chalk.red("Are you sure? Type the name of the feed to delete:")
            });
            ensure(deleteFeedName === feed, "Oops! Wrong feed name!");
            await orFail("Deleting feed...", () => kv.srem("feeds", feed));
            process.exit(0);
        } else if (action === "Publish Feed") {
            let newAvatarPath : string | null = null;
            const record = await orFail("Checking for existing public record...",
                () => agent.api.com.atproto.repo.getRecord({
                repo: agent.session!.did,
                collection: "app.bsky.feed.generator",
                rkey: feed
            }).then(r => r.data.value).catch(e => ({
                did: process.env.FEED_DID!,
                displayName: feed,
                description: "",
                createdAt: new Date().toISOString()
            }))) as {
                displayName: string,
                did:string,
                description: string,
                avatar: any,
                createdAt: string
            };

            while (true) {
                console.log(chalk.blueBright("Display Name: ") + record.displayName);
                console.log(chalk.blueBright("Description: ") + record.description);
                console.log(chalk.blueBright("Avatar: ") + (newAvatarPath ? "To Be Set!" : (record.avatar ? "Set!" : "Not Set!")));

                const { action } = await inquirer.prompt({
                    name: "action",
                    type: "list",
                    message: "Edit:",
                    choices: ["Display Name", "Description", "Avatar", "Save Changes", "Cancel"]
                });

                if (action === "Display Name") {
                    const {nDn} = await inquirer.prompt({
                        name: "nDn",
                        message: "New Display Name"
                    });
                    record.displayName = nDn;
                } else if (action === "Description") {
                    const {nDesc} = await inquirer.prompt({
                        name: "nDesc",
                        message: "New Description"
                    });
                    record.description = nDesc;
                } else if (action === "Avatar") {
                    const {nap } = await inquirer.prompt({
                        name: "nap",
                        message: "Path to New Avatar File:",
                        validate: (input) => {
                            if (!existsSync(input)) return "No such file";
                            return true;
                        }
                    });
                    newAvatarPath = nap;
                } else if (action === "Save Changes") {
                    if (newAvatarPath !== null) {
                        const img = await readFile(newAvatarPath);
                        record.avatar = (await orFail("Uploading new avatar...", () => agent.api.com.atproto.repo.uploadBlob(img, {
                            encoding: newAvatarPath.endsWith(".png") ? "image/png" : "image/jpeg"
                        }))).data.blob;
                    }

                    const res = await orFail("Publishing changes...", () => agent.api.com.atproto.repo.putRecord({
                        repo: agent.session!.did,
                        collection: "app.bsky.feed.generator",
                        rkey: feed,
                        record
                    }));
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
            let { memberAction } = await inquirer.prompt({
                name: "memberAction",
                message: "What to do with this member?",
                type: "list",
                choices: ["Nothing", "Replace", "Delete"]
            });

            if (memberAction === "Replace") {
                let { replacementName } = await inquirer.prompt({
                    name: "replacementName",
                    message: "New Member Name:"
                });

                const replacementDid = (await orFail("Resolving member handle...", () => agent.com.atproto.identity.resolveHandle({ handle: replacementName }))).data.did;

                await orFail("Adding member...", () => kv.sadd("feedusers_" + feed, replacementDid + "; " + replacementName));
                await orFail("Removing old member...", () => kv.srem("feedusers_" + feed, member));
                feedMembers = feedMembers.filter(e => e !== member);
                feedMembers.push(replacementDid + "; " + replacementName);
            } else if (memberAction === "Delete") {
                await orFail("Removing old member...", () => kv.srem("feedusers_" + feed, member));
            }
        }
    }

    console.log("Goodbye!");
    process.exit(0);
}

async function orFail<T>(message, cb: () => Promise<T>): Promise<T> {
    process.stdout.write(message);
    try {
        const res = await cb();
        process.stdout.write("\r\x1b[K");
        console.log(chalk.green(message) + " ✅");
        return res;
    } catch (e) {
        process.stdout.write("\r\x1b[K");
        console.log(chalk.red(message) + "❌");
        process.exit(1)
    }
}

function ensure(t, message) {
    if (!t) {
        console.error(chalk.red(message));
        process.exit(1);
    }
}

main().then();
