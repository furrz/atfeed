import { kv } from "@vercel/kv";
import 'dotenv/config'

kv.sadd("feedusers_all", process.argv[2])
    .then(() => console.log("Added!"))
    .catch(e => console.error("Failed to add: ", e));
